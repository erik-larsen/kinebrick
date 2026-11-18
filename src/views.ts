// The Views card's views (see main.ts): besides the viewer's own camera (Default), the view
// from each minifig's eyes, the way its face points, and from the front of each train, looking
// the way it goes. A view moves with the model: the camera is put in its place every frame.

import { Box3, Matrix4, Object3D, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { trainsOf } from './inference/trains.ts';
import type { Mechanism } from './mechanism.ts';

// A minifig head's eyes, in the head's own LDraw coordinates, from the LDraw library's parts:
// the standard face print (s/3626ap01s01.dat) draws its eyes as discs at y 10, x ±3.5, on the
// -z side of the head, which is a cylinder of radius 13 (3626c.dat). So its face looks along -z,
// and the camera goes between the eyes, 1 LDU in front of the head's surface, so the head itself
// isn't in front of the camera's near plane (1 LDU, see main.ts).
const EYES = new Vector3(0, 10, -(13 + 1));
const FACE = new Vector3(0, 0, -1);
// The camera's field of view in a minifig's or a train's view (degrees): wider than the viewer's
// own, as from inside a cab.
const VIEW_FOV = 70;
// A train's parts this near its leading wheelset (LDU, as for wheelsets of one train, see trainsOf)
// are its leading car's. The camera goes in front of the car's frontmost part, at the eyes of a
// minifig riding in it (its driver), or with none, at the car's top.
const CAR_REACH = 300;
// How far in front of the car the camera goes (LDU): half a stud, so the car isn't in front of
// the camera's near plane.
const AHEAD = 10;
// How far on along the track from the camera it looks (LDU), at the rail heads there, which keeps
// the track in the middle of the view round curves and over ramps: as far as a car reaches.
const LOOK_AHEAD = CAR_REACH;

// Looking round in a view goes no further up or down than this (radians, from level), so the
// view never turns over the top.
const STEEPEST = (85 * Math.PI) / 180;
const UP = new Vector3(0, 1, 0);

type Place = { eye: Vector3; look: Vector3 };

// A view's name as the address gives it (?view=, see main.ts): "Minifig 3" is minifig3.
export const viewKey = (name: string) => name.toLowerCase().replace(/ /g, '');

export class Views {
  // The views' names, as in the dropdown under Default, the viewer's own camera, which is chosen as
  // '' (as the home button chooses it).
  readonly names: string[] = [];
  private places = new Map<string, () => Place>();
  private chosen = '';
  private saved = { position: new Vector3(), target: new Vector3(), fov: 0 };
  // Told of each change of view, with its name ('' for home): main.ts keeps it in the address.
  onChange = (_name: string) => {};
  private menu = document.getElementById('view-menu') as HTMLSelectElement;
  // How far a drag has turned the view from where the view looks (radians: round to the left, and
  // up), until another view is chosen; and the drag doing it.
  private yaw = 0;
  private pitch = 0;
  private looking: { pointer: number; x: number; y: number } | null = null;

  constructor(
    mech: Mechanism,
    private partObjects: Object3D[],
    titles: string[],
    private camera: PerspectiveCamera,
    private controls: OrbitControls,
  ) {
    // The minifigs: one for each head ("Minifig Head", not "Minifig Headgear" and the like).
    const heads = titles.flatMap((t, i) => (/^Minifig Head\b/.test(t) ? [i] : []));
    heads.forEach((part, k) => this.add(`Minifig ${k + 1}`, () => this.minifigPlace(part)));
    // The trains: each with a train view (numbered when there are more than one).
    const trains = trainsOf(mech).filter((t) => t.riders.length);
    trains.forEach((train, k) => this.add(trains.length > 1 ? `Train ${k + 1}` : 'Train', this.trainPlace(mech, train, heads)));
    // The Views card's row (see index.html): home (Default), the previous and the next view in the
    // dropdown (round from its last to its first), and the dropdown, Default at its top.
    this.menu.append(new Option('Default', ''), ...this.names.map((name) => new Option(name, name)));
    this.menu.onchange = () => this.choose(this.menu.value);
    document.getElementById('view-home')!.onclick = () => this.choose('');
    document.getElementById('view-previous')!.onclick = () => this.step(-1);
    document.getElementById('view-next')!.onclick = () => this.step(1);
    // In a view, a drag looks round: the scene follows the pointer, a drag the height of the
    // window turning it as far as the camera sees from top to bottom. Escape goes home, unless
    // it's for a box being typed in or the model menu.
    const canvas = controls.domElement as HTMLElement;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.chosen || this.looking || e.button !== 0) return;
      this.looking = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.looking?.pointer) return;
      const perPixel = (this.camera.fov * Math.PI) / 180 / canvas.clientHeight;
      this.yaw += (e.clientX - this.looking.x) * perPixel;
      this.pitch = Math.max(-2 * STEEPEST, Math.min(2 * STEEPEST, this.pitch + (e.clientY - this.looking.y) * perPixel));
      this.looking.x = e.clientX;
      this.looking.y = e.clientY;
      this.update();
    });
    const stop = (e: PointerEvent) => {
      if (e.pointerId === this.looking?.pointer) this.looking = null;
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.chosen && !(e.target as Element).closest?.('input, select, textarea, #model')) this.choose('');
    });
  }

  // True in a view other than Default: parts aren't hovered or picked then (see interaction.ts).
  inView() {
    return this.chosen !== '';
  }

  private add(name: string, place: () => Place) {
    this.names.push(name);
    this.places.set(name, place);
  }

  // The view before or after this one in the dropdown, Default included.
  private step(by: number) {
    const list = ['', ...this.names];
    this.choose(list[(list.indexOf(this.chosen) + by + list.length) % list.length]);
  }

  // Switches to a view, or home (''). Leaving home keeps where its camera was, to go back to.
  choose(name: string) {
    if (name === this.chosen || (name && !this.places.has(name))) return;
    if (!this.chosen) {
      this.saved = { position: this.camera.position.clone(), target: this.controls.target.clone(), fov: this.camera.fov };
    }
    this.chosen = name;
    this.menu.value = name;
    // Each view starts as it is, however the last was looked round.
    this.yaw = 0;
    this.pitch = 0;
    this.looking = null;
    if (!name) {
      this.camera.position.copy(this.saved.position);
      this.controls.target.copy(this.saved.target);
      this.camera.fov = this.saved.fov;
      this.controls.enabled = true;
    } else this.camera.fov = VIEW_FOV;
    this.camera.updateProjectionMatrix();
    this.update();
    this.onChange(name);
  }

  // Each frame, after the parts have moved: the camera to the chosen view's place. The mouse
  // doesn't turn the camera in a view (the view would only snap back).
  update() {
    const place = this.places.get(this.chosen);
    if (!place) return;
    const { eye, look } = place();
    // Turned as a drag has looked round: about the upright, then up or down, never past steep.
    const dir = look.clone().sub(eye);
    const reach = dir.length();
    dir.normalize().applyAxisAngle(UP, this.yaw);
    const level = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    const tilt = Math.max(-STEEPEST, Math.min(STEEPEST, level + this.pitch)) - level;
    dir.applyAxisAngle(dir.clone().cross(UP).normalize(), tilt);
    this.camera.position.copy(eye);
    this.controls.target.copy(eye).addScaledVector(dir, reach);
    this.controls.enabled = false;
  }

  // From a minifig's eyes, the way its face points.
  private minifigPlace(part: number): Place {
    const head = this.partObjects[part];
    head.updateWorldMatrix(true, false);
    const eye = EYES.clone().applyMatrix4(head.matrixWorld);
    const face = FACE.clone().transformDirection(head.matrixWorld);
    return { eye, look: eye.clone().addScaledVector(face, 100) };
  }

  // Just in front of a train's leading car, looking the way the train goes. The train leads with
  // one end or the other: with the end whose wheelset last moved outwards, away from the train.
  private trainPlace(mech: Mechanism, train: ReturnType<typeof trainsOf>[number], heads: number[]): () => Place {
    // Each wheelset's middle, carried by one of its body's parts, in that part's own coordinates
    // (from where the part was as built: its startMatrix, see main.ts).
    const middles = train.riders.map((r) => {
      const part = mech.bodies[r.body].parts[0];
      const obj = this.partObjects[part];
      const built: Matrix4 = obj.userData.startMatrix ?? obj.matrix;
      return { obj, local: r.center.clone().applyMatrix4(built.clone().invert()) };
    });
    const middleNow = (k: number) => {
      middles[k].obj.updateWorldMatrix(true, false);
      return middles[k].local.clone().applyMatrix4(middles[k].obj.matrixWorld);
    };
    // The two ends: the wheelsets farthest apart as built, each with its nearest other wheelset.
    let ends = [0, 0];
    train.riders.forEach((a, i) => train.riders.forEach((b, j) => {
      if (a.center.distanceTo(b.center) > train.riders[ends[0]].center.distanceTo(train.riders[ends[1]].center)) ends = [i, j];
    }));
    const nextTo = ends.map((e) => {
      const others = train.riders.map((_, k) => k).filter((k) => k !== e);
      return others.sort((a, b) => train.riders[a].center.distanceTo(train.riders[e].center) - train.riders[b].center.distanceTo(train.riders[e].center))[0];
    });
    const parts = train.bodies.flatMap((b) => mech.bodies[b].parts).map((p) => this.partObjects[p]);
    const riding = heads.filter((h) => train.bodies.includes(mech.bodyOf[h])); // the minifigs in the train
    // The track, to keep in the middle of the view: the place of a point some way along it from
    // the leading wheelset, in the world, ahead of the wheelset (null off a track, or before the
    // solver has placed the wheelset on it, see Track.near). The track's frame is carried by a
    // part of its body, as the solver's poses[0].
    const track = mech.track;
    const ground = this.partObjects[mech.bodies[0].parts[0]];
    const alongTrack = (distance: number, front: Vector3, ahead: Vector3): Vector3 | null => {
      const place = track?.placeOf(mech.riders!.indexOf(train.riders[ends[leading]]));
      if (!track || !place) return null;
      const built: Matrix4 = ground.userData.startMatrix ?? ground.matrix;
      const frame = ground.matrix.clone().multiply(built.clone().invert());
      ground.updateWorldMatrix(true, false);
      // Either way along the line from the wheelset: the one ahead.
      const points = [distance, -distance].map((d) => {
        const to = track.walk(place.line, place.s, d);
        const point = track.pointAt(to.line, to.s).point.applyMatrix4(frame);
        const under = track.under(point, frame); // on a ramp, its height there
        if (under) point.y = under.y;
        return point.applyMatrix4(ground.parent!.matrixWorld);
      });
      return points.sort((a, b) => b.clone().sub(front).dot(ahead) - a.clone().sub(front).dot(ahead))[0];
    };
    let leading = 0;
    let last = ends.map(middleNow);
    return () => {
      const now = ends.map(middleNow);
      // Which way each end faces, outwards, level (a lone wheelset faces across its axle).
      const outwards = ends.map((e, i) => {
        const out = nextTo[i] === undefined ? train.riders[e].axis.clone().transformDirection(middles[e].obj.matrixWorld).cross(new Vector3(0, 1, 0)) : now[i].clone().sub(middleNow(nextTo[i]));
        return out.setY(0).normalize();
      });
      const moved = now.map((p, i) => p.clone().sub(last[i]).dot(outwards[i]));
      if (Math.abs(moved[0]) > 1e-3 || Math.abs(moved[1]) > 1e-3) leading = moved[0] >= moved[1] ? 0 : 1;
      last = now;
      const front = now[leading];
      const ahead = outwards[leading];
      // The leading car: the train's parts near its leading wheelset, ahead of its far side.
      let reach = 0;
      let top = front.y;
      const box = new Box3();
      for (const obj of parts) {
        box.setFromObject(obj);
        if (box.isEmpty() || box.getCenter(new Vector3()).distanceTo(front) > CAR_REACH) continue;
        const corner = new Vector3(ahead.x > 0 ? box.max.x : box.min.x, 0, ahead.z > 0 ? box.max.z : box.min.z);
        reach = Math.max(reach, corner.sub(front).setY(0).dot(ahead));
        top = Math.max(top, box.max.y);
      }
      // At the eyes of a minifig riding in the leading car, the highest if more than one.
      const drivers = riding.map((h) => this.minifigPlace(h).eye).filter((e) => e.distanceTo(front) < CAR_REACH);
      const height = drivers.length ? Math.max(...drivers.map((e) => e.y)) : top;
      // Over the track, just in front of the car, looking at the track further on; off a track,
      // straight ahead.
      const rails = alongTrack(0, front, ahead);
      const over = alongTrack(reach + AHEAD, front, ahead);
      const on = alongTrack(reach + AHEAD + LOOK_AHEAD, front, ahead);
      if (rails && over && on) return { eye: over.clone().setY(over.y + height - rails.y), look: on };
      const eye = front.clone().addScaledVector(ahead, reach + AHEAD).setY(height);
      return { eye, look: eye.clone().addScaledVector(ahead, LOOK_AHEAD) };
    };
  }
}
