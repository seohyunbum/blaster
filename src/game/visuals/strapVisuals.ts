import * as THREE from 'three'
import type { PartId } from '../types.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

// 어깨끈 5종 — 모두 몸통 오른쪽 옆면의 앞·뒤 접점(z=±0.2)을 잇고 아래(-Y)로 넉넉히
// 늘어지는 U자 밴드를 공유하되, 장식(고리/버클/구슬/리본/별)으로 실루엣을 구분한다.
// 성능 계약: 파츠당 메시 ≤3 (밴드 1 + 장식 2) — 완전 장착 합(56) 여유가 없어 상한을 지킨다.
export function buildStrap(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const radial = segFor(opts.lod, 8, 5)
  const tubeSeg = segFor(opts.lod, 28, 14)

  // 공통 U자 밴드(끈 본체). 변형별로 굵기·늘어짐만 조금 바꾼다.
  function addBand(dip: number, tubeR: number): void {
    const points = [
      new THREE.Vector3(0, 0, -0.2),
      new THREE.Vector3(0.025, -0.07, -0.15),
      new THREE.Vector3(0.045, dip, 0),
      new THREE.Vector3(0.025, -0.07, 0.15),
      new THREE.Vector3(0, 0, 0.2),
    ]
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const geo = new THREE.TubeGeometry(curve, tubeSeg, tubeR, radial, false)
    geos.push(geo)
    const band = new THREE.Mesh(geo, fixedMaterial(PLACEHOLDER))
    primary.push(band)
    group.add(band)
  }

  if (partId === 'strap_sport') {
    // 스포티: 네모 버클 클립이 앞·뒤에 물린 날렵한 끈
    addBand(-0.28, 0.011)
    const clipGeo = new THREE.BoxGeometry(0.03, 0.03, 0.014)
    geos.push(clipGeo)
    for (const z of [-0.2, 0.2]) {
      const clip = new THREE.Mesh(clipGeo, fixedMaterial(PLACEHOLDER))
      clip.position.set(0.003, 0, z)
      accent.push(clip)
      group.add(clip)
    }
  } else if (partId === 'strap_beads') {
    // 구슬: 늘어진 부분에 동글 구슬 두 알
    addBand(-0.28, 0.009)
    const beadGeo = new THREE.SphereGeometry(0.024, radial + 2, radial)
    geos.push(beadGeo)
    for (const z of [-0.09, 0.09]) {
      const bead = new THREE.Mesh(beadGeo, fixedMaterial(PLACEHOLDER))
      bead.position.set(0.042, -0.2, z)
      accent.push(bead)
      group.add(bead)
    }
  } else if (partId === 'strap_ribbon') {
    // 리본: 도톰한 밴드 + 위쪽 가운데 리본 매듭(두 잎)
    addBand(-0.28, 0.02)
    const loopGeo = new THREE.BoxGeometry(0.05, 0.032, 0.014)
    geos.push(loopGeo)
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(loopGeo, fixedMaterial(PLACEHOLDER))
      loop.position.set(0.05, 0.01, s * 0.03)
      loop.rotation.y = s * 0.5
      accent.push(loop)
      group.add(loop)
    }
  } else if (partId === 'strap_star') {
    // 별: 끝에 반짝 별(팔면체) 참이 작은 고리에 대롱대롱
    addBand(-0.28, 0.01)
    const linkGeo = new THREE.TorusGeometry(0.014, 0.004, 6, radial)
    geos.push(linkGeo)
    const link = new THREE.Mesh(linkGeo, fixedMaterial(PLACEHOLDER))
    link.position.set(0.045, -0.3, 0)
    accent.push(link)
    group.add(link)
    const charmGeo = new THREE.OctahedronGeometry(0.032, 0)
    charmGeo.scale(1, 1, 0.45) // 납작한 별 참
    geos.push(charmGeo)
    const charm = new THREE.Mesh(charmGeo, fixedMaterial(PLACEHOLDER))
    charm.position.set(0.045, -0.34, 0)
    accent.push(charm)
    group.add(charm)
  } else {
    // strap_comfy (기본): 폭신한 끈 + 앞·뒤 체결 고리 2개
    addBand(-0.29, 0.01)
    const ringGeo = new THREE.TorusGeometry(0.018, 0.0055, 6, radial + 2)
    ringGeo.rotateY(Math.PI / 2)
    geos.push(ringGeo)
    for (const z of [-0.2, 0.2]) {
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
      ring.position.set(0.002, 0, z)
      accent.push(ring)
      group.add(ring)
    }
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}
