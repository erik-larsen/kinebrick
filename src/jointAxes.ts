// Draws each joint's axis as a thin rod, visible through the parts around it (for a ball
// joint, three short rods crossing at its centre).

import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { Joint } from './mechanism.ts';

const ROD_RADIUS = 1.2; // LDU
const OVERHANG = 16; // how far the rod sticks out past the joint at each end, in LDU

export function makeJointAxes(joints: Joint[]): Group {
  const group = new Group();
  const material = new MeshBasicMaterial({ color: 0xe0218a, depthTest: false, transparent: true, opacity: 0.85 });
  for (const joint of joints) {
    if (joint.kind === 'ball') {
      // A ball joint has no axis: a ring of rods round its centre, one per direction.
      for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
        const rod = new Mesh(new CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 2 * OVERHANG, 12), material);
        rod.position.copy(joint.from);
        rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis);
        add(rod, joint.bodyA);
      }
      continue;
    }
    const dir = new Vector3().subVectors(joint.to, joint.from);
    const length = dir.length() + 2 * OVERHANG;
    dir.normalize();
    const rod = new Mesh(new CylinderGeometry(ROD_RADIUS, ROD_RADIUS, length, 12), material);
    rod.position.addVectors(joint.from, joint.to).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); // the geometry runs along y
    // The axis moves with the joint's first body (it's fixed in both).
    add(rod, joint.bodyA);
  }
  return group;

  function add(rod: Mesh, body: number) {
    rod.renderOrder = 10; // draw after the parts so it shows through them
    rod.updateMatrix();
    rod.userData.body = body;
    rod.userData.startMatrix = rod.matrix.clone();
    group.add(rod);
  }
}
