// Outlines drawn around parts after the scene is rendered: one style per kind of status.
//   frozen     parts of bodies the user has frozen (cyan)
//   loose      parts not attached to the rest of the model (red)
//   blocked    two parts that would have run into each other, shown briefly (red)
// Each style is its own outline pass; a pass with nothing to outline is switched off.

import { Camera, Color, HalfFloatType, NormalBlending, Object3D, Scene, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

interface OutlineStyle {
  colour: number; // where the outline can be seen
  hiddenColour: number; // where it's behind other parts
  strength: number;
  thickness: number;
}

const STYLES = {
  frozen: { colour: 0x00b4ff, hiddenColour: 0x006a96, strength: 10, thickness: 2.5 },
  loose: { colour: 0xff0000, hiddenColour: 0xa00000, strength: 10, thickness: 3 },
  blocked: { colour: 0xff0000, hiddenColour: 0xa00000, strength: 10, thickness: 3 },
  driven: { colour: 0x22b14c, hiddenColour: 0x146b2e, strength: 10, thickness: 2.5 },
};

export type OutlineKind = keyof typeof STYLES;

export class Outlines {
  private composer: EffectComposer;
  private passes = new Map<OutlineKind, OutlinePass>();

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    // Render into a multisampled target so edges stay smooth with post-processing.
    const size = renderer.getSize(new Vector2());
    const target = new WebGLRenderTarget(size.x, size.y, { samples: 4, type: HalfFloatType });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    for (const kind of Object.keys(STYLES) as OutlineKind[]) {
      const style: OutlineStyle = STYLES[kind];
      const pass = new OutlinePass(size.clone(), scene, camera);
      pass.visibleEdgeColor = new Color(style.colour);
      pass.hiddenEdgeColor = new Color(style.hiddenColour);
      pass.edgeStrength = style.strength;
      pass.edgeThickness = style.thickness;
      pass.edgeGlow = 0;
      pass.downSampleRatio = 1; // full resolution, for crisp lines
      // Paint the outline's colour over the scene, rather than adding to it (which turns
      // red over a light part pink).
      pass.overlayMaterial.blending = NormalBlending;
      pass.enabled = false;
      this.passes.set(kind, pass);
      this.composer.addPass(pass);
    }
    this.composer.addPass(new OutputPass());
    // The composer takes the target's size as given; this sizes it, and every pass, for the
    // screen's pixel ratio (else a 2x screen renders at half resolution until a resize).
    this.composer.setSize(size.x, size.y);
  }

  // Which objects get this kind of outline (replacing any before).
  set(kind: OutlineKind, objects: Object3D[]) {
    const pass = this.passes.get(kind)!;
    pass.selectedObjects = objects;
    pass.enabled = objects.length > 0;
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }
}
