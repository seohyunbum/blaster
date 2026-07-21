import * as THREE from 'three'
import type { PartId } from '../types.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildStrap(_partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const radial = segFor(opts.lod, 8, 5)

  // 앵커 원점은 몸통 오른쪽 옆면. 끝점은 몸통에 닿고 중앙은 바깥(+X)·아래(-Y)로
  // 넉넉하게 늘어져 썸네일에서도 '어깨에 메는 끈' 실루엣이 읽힌다.
  const points = [
    new THREE.Vector3(0, 0, -0.2),
    new THREE.Vector3(0.025, -0.07, -0.15),
    new THREE.Vector3(0.045, -0.29, 0),
    new THREE.Vector3(0.025, -0.07, 0.15),
    new THREE.Vector3(0, 0, 0.2),
  ]
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const strapGeo = new THREE.TubeGeometry(curve, segFor(opts.lod, 28, 14), 0.01, radial, false)
  geos.push(strapGeo)
  const strap = new THREE.Mesh(strapGeo, fixedMaterial(PLACEHOLDER))
  primary.push(strap)
  group.add(strap)

  // 앞·뒤 체결 고리 — 끈 끝과 몸통의 접점을 또렷하게 보여 주는 포인트색.
  const ringGeo = new THREE.TorusGeometry(0.018, 0.0055, 6, radial + 2)
  ringGeo.rotateY(Math.PI / 2)
  geos.push(ringGeo)
  for (const z of [-0.2, 0.2]) {
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0.002, 0, z)
    accent.push(ring)
    group.add(ring)
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}
