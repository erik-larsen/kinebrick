// Draws each joint's axis as a thin rod, visible through the parts around it.

import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Joint } from './mechanism.ts';

const ROD_RADIUS = 1.2; // LDU
const OVERHANG = 16; // how far the rod sticks out past the joint at each end, in LDU

export function makeJointAxes(joints: Joint[]): Group {
  const group = new Group();
  const material = new MeshBasicMaterial({ color: 0xe0218a, depthTest: false, transparent: true, opacity: 0.85 });
  for (const joint of joints) {
    const dir = new Vector3().subVectors(joint.to, joint.from);
    const length = dir.length() + 2 * OVERHANG;
    dir.normalize();
    const rod = new Mesh(new CylinderGeometry(ROD_RADIUS, ROD_RADIUS, length, 12), material);
    rod.position.addVectors(joint.from, joint.to).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); // the geometry runs along y
    rod.renderOrder = 10; // draw after the parts so it shows through them
    group.add(rod);
  }
  return group;
}
