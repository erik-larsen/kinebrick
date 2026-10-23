// How parts look. Each kind of information gets its own channel, so they never fight:
//   fill colour  which body a part belongs to (body colours), or its own LEGO colours
//   yellow glow  what the pointer is on: the hovered part, and faintly the rest of its body
//   outline      status: frozen (cyan), the part kept turning (green) and loose (red)
//   badge        status, as an icon pinned to the part: 📌 frozen, ⚠ loose (a part kept
//                turning has no badge: its turning shows it)
//   see-through  with drivetrain focus, the parts the last drag or spin didn't move

import { Box3, Color, LineSegments, Material, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Mechanism } from './mechanism.ts';
import { Outlines } from './outlines.ts';

// One colour per body; the frame is first. Repeats if there are more bodies than colours.
const BODY_COLOURS = [
  0x8a94a6, 0xe8833a, 0x2a9d8f, 0x7b5ea7, 0x5b8e7d, 0x9c6644, 0x8ab547, 0xedae49, 0x6b705c, 0xcb997e, 0x264653, 0xb5838d,
];
const HOVER_GLOW = new Color(0xffd23f);
const GLOW_STRENGTH = { part: 0.55, body: 0.15 };
// How solid a part outside the drivetrain focus is drawn.
const FADED_OPACITY = 0.12;

export class Appearance {
  showBodyColours = true;
  hoveredPart = -1;
  frozenBodies = new Set<number>();
  looseParts = new Set<number>();
  drivenPart = -1; // the part kept turning (Ctrl-click), or -1
  focusBodies: Set<number> | null = null; // with drivetrain focus, the bodies drawn solid (null: all)

  private partObjects: Object3D[];
  private meshesOfPart: Mesh[][] = [];
  private linesOfPart: Object3D[][] = []; // its edges
  private originalMaterial = new Map<Mesh, Material | Material[]>();
  private bodyMaterials: MeshStandardMaterial[];
  private mech: Mechanism;
  private outlines: Outlines;
  private badges: CSS2DObject[] = [];
  private glowCache = new Map<string, Material>();
  private blockedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(partObjects: Object3D[], mech: Mechanism, outlines: Outlines) {
    this.partObjects = partObjects;
    this.mech = mech;
    this.outlines = outlines;
    partObjects.forEach((obj, i) => {
      const meshes: Mesh[] = [];
      const lines: Object3D[] = [];
      obj.traverse((child) => {
        if ((child as Mesh).isMesh) {
          meshes.push(child as Mesh);
          this.originalMaterial.set(child as Mesh, (child as Mesh).material);
        } else if ((child as LineSegments).isLineSegments) {
          lines.push(child);
        }
      });
      this.meshesOfPart[i] = meshes;
      this.linesOfPart[i] = lines;
    });
    this.bodyMaterials = [];
    this.setMechanism(mech);
  }

  // Switches to a mechanism worked out afresh (after a shift): the bodies may have changed.
  setMechanism(mech: Mechanism) {
    this.mech = mech;
    while (this.bodyMaterials.length < mech.bodies.length) {
      const i = this.bodyMaterials.length;
      this.bodyMaterials.push(new MeshStandardMaterial({ color: BODY_COLOURS[i % BODY_COLOURS.length], roughness: 0.6 }));
    }
    this.frozenBodies.clear();
    this.focusBodies = null;
    this.looseParts = new Set(mech.loose);
  }

  // Applies everything above. Call after changing any of the public fields.
  update() {
    // Fill, with a yellow glow on the hovered part and a fainter one on the rest of its body
    const hoveredBody = this.hoveredPart >= 0 ? this.mech.bodyOf[this.hoveredPart] : -1;
    this.meshesOfPart.forEach((meshes, part) => {
      const body = this.mech.bodyOf[part];
      const glow = part === this.hoveredPart ? 'part' : body === hoveredBody ? 'body' : null;
      const faded = this.focusBodies !== null && !this.focusBodies.has(body) && glow === null;
      const look = (m: Material) => (faded ? this.fading(m) : this.glowing(m, glow));
      for (const mesh of meshes) {
        const base = this.showBodyColours ? this.bodyMaterials[body] : this.originalMaterial.get(mesh)!;
        mesh.material = Array.isArray(base) ? base.map(look) : look(base);
      }
      for (const line of this.linesOfPart[part]) line.visible = !faded;
    });

    // Outlines
    const partsOf = (test: (part: number) => boolean) => this.partObjects.filter((_, part) => test(part));
    this.outlines.set('frozen', partsOf((p) => this.frozenBodies.has(this.mech.bodyOf[p])));
    this.outlines.set('loose', partsOf((p) => this.looseParts.has(p)));
    // Only the part that was Ctrl-clicked, not the rest of its body.
    this.outlines.set('driven', partsOf((p) => p === this.drivenPart));

    // Badges: one ⚠ per loose part, one 📌 per frozen body (on its biggest part).
    for (const badge of this.badges) badge.removeFromParent();
    this.badges = [];
    for (const part of this.looseParts) this.addBadge(part, '⚠', 'loose');
    for (const body of this.frozenBodies) this.addBadge(this.biggestPart(body), '📌', 'frozen');
  }

  // Outlines two parts in red for a moment: they'd have run into each other, so the drag stopped.
  flashBlocked(parts: number[]) {
    this.outlines.set('blocked', parts.map((p) => this.partObjects[p]));
    clearTimeout(this.blockedTimer);
    this.blockedTimer = setTimeout(() => this.outlines.set('blocked', []), 700);
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

  // A see-through copy of the material, for a part outside the drivetrain focus. Copies are cached.
  private fading(material: Material): Material {
    const key = material.uuid + 'faded';
    let copy = this.glowCache.get(key);
    if (!copy) {
      copy = material.clone();
      copy.transparent = true;
      copy.opacity = FADED_OPACITY;
      copy.depthWrite = false;
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
