// How parts look. Each kind of information gets its own channel, so they never fight:
//   fill colour  which body a part belongs to (body colours), or its own LEGO colours
//   yellow glow  what the pointer is on: the hovered part, and faintly the rest of its body
//   outline      status: held (cyan) and loose (red)
//   badge        status, as an icon pinned to the part: 📌 held, ⚠ loose

import { Box3, Color, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Mechanism } from './mechanism.ts';
import { Outlines } from './outlines.ts';

// One colour per body; the frame is first. Repeats if there are more bodies than colours.
const BODY_COLOURS = [0x8a94a6, 0xe8833a, 0x2a9d8f, 0x7b5ea7, 0x5b8e7d, 0x9c6644, 0x8ab547, 0xedae49];
const HOVER_GLOW = new Color(0xffd23f);
const GLOW_STRENGTH = { part: 0.55, body: 0.15 };

export class Appearance {
  showBodyColours = true;
  hoveredPart = -1;
  heldBodies = new Set<number>();
  looseParts = new Set<number>();

  private partObjects: Object3D[];
  private meshesOfPart: Mesh[][] = [];
  private originalMaterial = new Map<Mesh, Material | Material[]>();
  private bodyMaterials: MeshStandardMaterial[];
  private mech: Mechanism;
  private outlines: Outlines;
  private badges: CSS2DObject[] = [];
  private glowCache = new Map<string, Material>();

  constructor(partObjects: Object3D[], mech: Mechanism, outlines: Outlines) {
    this.partObjects = partObjects;
    this.mech = mech;
    this.outlines = outlines;
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

  // Applies everything above. Call after changing any of the public fields.
  update() {
    // Fill, with a yellow glow on the hovered part and a fainter one on the rest of its body
    const hoveredBody = this.hoveredPart >= 0 ? this.mech.bodyOf[this.hoveredPart] : -1;
    this.meshesOfPart.forEach((meshes, part) => {
      const body = this.mech.bodyOf[part];
      const glow = part === this.hoveredPart ? 'part' : body === hoveredBody ? 'body' : null;
      for (const mesh of meshes) {
        const base = this.showBodyColours ? this.bodyMaterials[body] : this.originalMaterial.get(mesh)!;
        mesh.material = Array.isArray(base) ? base.map((m) => this.glowing(m, glow)) : this.glowing(base, glow);
      }
    });

    // Outlines
    const partsOf = (test: (part: number) => boolean) => this.partObjects.filter((_, part) => test(part));
    this.outlines.set('held', partsOf((p) => this.heldBodies.has(this.mech.bodyOf[p])));
    this.outlines.set('loose', partsOf((p) => this.looseParts.has(p)));

    // Badges: one ⚠ per loose part, one 📌 per held body (on its biggest part).
    for (const badge of this.badges) badge.removeFromParent();
    this.badges = [];
    for (const part of this.looseParts) this.addBadge(part, '⚠', 'loose');
    for (const body of this.heldBodies) this.addBadge(this.biggestPart(body), '📌', 'held');
  }

  // A copy of the material that glows yellow, a lot (part) or a little (body). Copies are cached.
  private glowing(material: Material, glow: 'part' | 'body' | null): Material {
    if (!glow || !(material instanceof MeshStandardMaterial)) return material;
    const key = material.uuid + glow;
    let copy = this.glowCache.get(key);
    if (!copy) {
      const lit = material.clone();
      lit.emissive = HOVER_GLOW;
      lit.emissiveIntensity = GLOW_STRENGTH[glow];
      copy = lit;
      this.glowCache.set(key, copy);
    }
    return copy;
  }

  private addBadge(part: number, icon: string, kind: string) {
    const element = document.createElement('div');
    element.className = `badge badge-${kind}`;
    element.textContent = icon;
    const badge = new CSS2DObject(element);
    // At the middle of the part, in the part's own coordinates so it moves with the part.
    const obj = this.partObjects[part];
    obj.updateWorldMatrix(true, true);
    const centre = new Box3().setFromObject(obj).getCenter(new Vector3());
    badge.position.copy(obj.worldToLocal(centre));
    obj.add(badge);
    this.badges.push(badge);
  }

  // The part of a body with the largest bounding box, where its badge goes.
  private biggestPart(body: number): number {
    let best = this.mech.bodies[body].parts[0];
    let bestSize = -1;
    for (const part of this.mech.bodies[body].parts) {
      const size = new Box3().setFromObject(this.partObjects[part]).getSize(new Vector3()).length();
      if (size > bestSize) {
        best = part;
        bestSize = size;
      }
    }
    return best;
  }
}
