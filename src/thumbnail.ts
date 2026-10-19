// A picture of the model, for its card in the README (see scripts/thumbs.ts): the view as the
// page opens, cropped to the model with a little room round it, 4:3, as a WebP data URL. The
// page takes it when opened with ?thumb.

import { Mesh, Object3D, PerspectiveCamera, Vector3 } from 'three';

const WIDTH = 480; // the picture's size, in pixels
const HEIGHT = 360;
const MARGIN = 0.08; // room round the model, as a share of its width or height on the screen
const QUALITY = 0.82; // WebP quality, 0 to 1

export async function thumbnail(canvas: HTMLCanvasElement, camera: PerspectiveCamera, model: Object3D): Promise<string> {
  // A frame or two for everything to be drawn, then a copy of the canvas, taken in the same
  // frame it's drawn in (WebGL clears it once the frame is on the screen).
  for (let i = 0; i < 2; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  const copy = await new Promise<HTMLCanvasElement>((resolve) =>
    requestAnimationFrame(() => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      c.getContext('2d')!.drawImage(canvas, 0, 0);
      resolve(c);
    }),
  );

  // Where the model lies on the canvas: every point of every visible mesh, projected.
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  const v = new Vector3();
  model.updateMatrixWorld(true);
  model.traverseVisible((obj) => {
    if (!(obj instanceof Mesh)) return;
    const position = obj.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(obj.matrixWorld).project(camera);
      const x = ((v.x + 1) / 2) * copy.width;
      const y = ((1 - v.y) / 2) * copy.height;
      [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
    }
  });

  // That, with room round it, widened or heightened to 4:3, scaled down to the picture.
  let width = (right - left) * (1 + 2 * MARGIN);
  let height = (bottom - top) * (1 + 2 * MARGIN);
  if (width / height > WIDTH / HEIGHT) height = (width * HEIGHT) / WIDTH;
  else width = (height * WIDTH) / HEIGHT;
  const picture = document.createElement('canvas');
  picture.width = WIDTH;
  picture.height = HEIGHT;
  const g = picture.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(copy, (left + right) / 2 - width / 2, (top + bottom) / 2 - height / 2, width, height, 0, 0, WIDTH, HEIGHT);
  return picture.toDataURL('image/webp', QUALITY);
}
