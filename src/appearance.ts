// Decides which material each part is drawn with: its own LDraw colours or its body's
// debug colour, plus a highlight for the hovered part and a faint tint for its body.

import { Color, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { Mechanism } from './mechanism.ts';

// One colour per body; the frame is first. Repeats if there are more bodies than colours.
const BODY_COLOURS = [0x8a94a6, 0xe8833a, 0x2a9d8f, 0x7b5ea7, 0xd1495b, 0x3f88c5, 0x8ab547, 0xedae49];
const HIGHLIGHT = new Color(0xffd23f);

type Highlight = 'none' | 'body' | 'part';

export class Appearance {
  showBodyColours = true;
  hoveredPart = -1;

  private meshesOfPart: Mesh[][] = [];
  private originalMaterial = new Map<Mesh, Material | Material[]>();
  private bodyMaterials: MeshStandardMaterial[];
  private tintedCache = new Map<string, Material>();
  private mech: Mechanism;

  constructor(partObjects: Object3D[], mech: Mechanism) {
    this.mech = mech;
    partObjects.forEach((obj, i) => {
      const meshes: Mesh[] = [];
      obj.traverse((child) => {
        if ((child as Mesh).isMesh) {
          meshes.push(child as Mesh);
          this.originalMaterial.set(child as Mesh, (child as Mesh).material);
        }
      });
      this.meshesOfPart[i] = meshes;
    });
    this.bodyMaterials = mech.bodies.map(
      (_, i) => new MeshStandardMaterial({ color: BODY_COLOURS[i % BODY_COLOURS.length], roughness: 0.6 }),
    );
  }

  // Reassigns every part's material. Call after changing showBodyColours or hoveredPart.
  update() {
    const hoveredBody = this.hoveredPart >= 0 ? this.mech.bodyOf[this.hoveredPart] : -1;
    this.meshesOfPart.forEach((meshes, part) => {
      const body = this.mech.bodyOf[part];
      let highlight: Highlight = 'none';
      if (part === this.hoveredPart) highlight = 'part';
      else if (body === hoveredBody) highlight = 'body';
      for (const mesh of meshes) {
        const base = this.showBodyColours ? this.bodyMaterials[body] : this.originalMaterial.get(mesh)!;
        mesh.material = Array.isArray(base) ? base.map((m) => this.tinted(m, highlight)) : this.tinted(base, highlight);
      }
    });
  }

  // A copy of the material that glows a little (body) or a lot (part). Copies are cached.
  private tinted(material: Material, highlight: Highlight): Material {
    if (highlight === 'none' || !(material instanceof MeshStandardMaterial)) return material;
    const key = material.uuid + highlight;
    let copy = this.tintedCache.get(key);
    if (!copy) {
      const glow = material.clone();
      glow.emissive = HIGHLIGHT;
      glow.emissiveIntensity = highlight === 'part' ? 0.55 : 0.15;
      copy = glow;
      this.tintedCache.set(key, copy);
    }
    return copy;
  }
}
