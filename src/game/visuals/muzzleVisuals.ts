import * as THREE from 'three'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildMuzzle(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 14, 8)
  const mz = morphLerp('muzzleSize', resolveMorph(opts.morph, 'muzzleSize'))
  const ml = morphLerp('muzzleLength', resolveMorph(opts.morph, 'muzzleLength'))

  if (partId === 'muzzle_comet') {
    // 둥근 베이스 + 세 겹 도넛 + 고정 주황 안전 구슬
    const baseGeo = new THREE.CylinderGeometry(0.032 * mz, 0.032 * mz, 0.07 * ml, seg)
    baseGeo.rotateX(Math.PI / 2)
    geos.push(baseGeo)
    const base = new THREE.Mesh(baseGeo, fixedMaterial(PLACEHOLDER))
    base.position.z = -0.035 * ml
    primary.push(base)
    group.add(base)
    const ringGeo = new THREE.TorusGeometry(0.04 * mz, 0.006 * mz, 7, seg)
    geos.push(ringGeo)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
      ring.position.z = -0.018 * ml - i * 0.025 * ml
      accent.push(ring)
      group.add(ring)
    }
    const orbGeo = new THREE.SphereGeometry(0.022 * mz, seg, Math.max(6, seg - 2))
    geos.push(orbGeo)
    const orb = new THREE.Mesh(orbGeo, fixedMaterial(0xff8a2b))
    orb.position.z = -0.085 * ml
    group.add(orb)
  } else if (partId === 'muzzle_turbine') {
    // 굵은 중심 링 주위를 도는 네 개의 주황 동력 방울
    const baseGeo = new THREE.CylinderGeometry(0.05 * mz, 0.043 * mz, 0.065 * ml, seg)
    baseGeo.rotateX(Math.PI / 2)
    geos.push(baseGeo)
    const base = new THREE.Mesh(baseGeo, fixedMaterial(PLACEHOLDER))
    base.position.z = -0.0325 * ml
    primary.push(base)
    group.add(base)
    const ringGeo = new THREE.TorusGeometry(0.058 * mz, 0.009 * mz, 7, seg)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.z = -0.064 * ml
    accent.push(ring)
    group.add(ring)
    const orbGeo = new THREE.SphereGeometry(0.012 * mz, Math.max(8, seg - 2), Math.max(6, seg - 4))
    geos.push(orbGeo)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const orb = new THREE.Mesh(orbGeo, fixedMaterial(0xff8a2b))
      orb.position.set(Math.cos(a) * 0.058 * mz, Math.sin(a) * 0.058 * mz, -0.068 * ml)
      group.add(orb)
    }
  } else if (partId === 'muzzle_duo') {
    // 나란한 두 안전 팁. 트윈 튜브와 섞어도 과장된 토이 얼굴처럼 보인다.
    const tubeGeo = new THREE.CylinderGeometry(0.027 * mz, 0.027 * mz, 0.06 * ml, seg)
    tubeGeo.rotateX(Math.PI / 2)
    geos.push(tubeGeo)
    const ringGeo = new THREE.TorusGeometry(0.03 * mz, 0.007 * mz, 7, seg)
    geos.push(ringGeo)
    for (const sx of [-1, 1]) {
      const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
      tube.position.set(sx * 0.036 * mz, 0, -0.03 * ml)
      primary.push(tube)
      group.add(tube)
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(0xff8a2b))
      ring.position.set(sx * 0.036 * mz, 0, -0.06 * ml)
      group.add(ring)
    }
  } else if (partId === 'muzzle_bubble') {
    // 통통한 방울 셸 + 주황 안전 립
    const bubbleGeo = new THREE.SphereGeometry(0.055 * mz, seg, Math.max(8, seg - 2), 0, Math.PI * 2, 0, Math.PI * 0.72)
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.scale.z = 1.15 * ml
    bubble.rotation.x = Math.PI
    bubble.position.z = -0.025 * ml
    primary.push(bubble)
    group.add(bubble)
    const lipGeo = new THREE.TorusGeometry(0.043 * mz, 0.009 * mz, 8, seg)
    geos.push(lipGeo)
    const lip = new THREE.Mesh(lipGeo, fixedMaterial(0xff8a2b))
    lip.position.z = -0.075 * ml
    group.add(lip)
  } else if (partId === 'muzzle_booster') {
    const coneGeo = new THREE.CylinderGeometry(0.055 * mz, 0.04 * mz, 0.08 * ml, seg)
    coneGeo.rotateX(Math.PI / 2)
    geos.push(coneGeo)
    const cone = new THREE.Mesh(coneGeo, fixedMaterial(PLACEHOLDER))
    cone.position.set(0, 0, -0.04 * ml)
    primary.push(cone)
    group.add(cone)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const finGeo = new THREE.BoxGeometry(0.012 * mz, 0.05 * mz, 0.06 * ml)
      geos.push(finGeo)
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      // 콘 반경 밖으로 밀어 세워 실제로 보이게 (원점 회전이라 안 보이던 버그 수정)
      const rr = 0.05 * mz
      fin.position.set(Math.sin(a) * rr, Math.cos(a) * rr, -0.04 * ml)
      fin.rotation.z = a
      accent.push(fin)
      group.add(fin)
    }
  } else if (partId === 'muzzle_star') {
    const baseGeo = new THREE.CylinderGeometry(0.035 * mz, 0.035 * mz, 0.04 * ml, seg)
    baseGeo.rotateX(Math.PI / 2)
    geos.push(baseGeo)
    const base = new THREE.Mesh(baseGeo, fixedMaterial(PLACEHOLDER))
    base.position.set(0, 0, -0.02 * ml)
    primary.push(base)
    group.add(base)
    const starGeo = new THREE.OctahedronGeometry(0.035 * mz, 0)
    geos.push(starGeo)
    const star = new THREE.Mesh(starGeo, fixedMaterial(PLACEHOLDER))
    // 베이스 앞면(-0.04*ml)에 별이 물리게 (길고 작을 때 분리되던 버그 수정)
    star.position.set(0, 0, -0.04 * ml - 0.021 * mz)
    accent.push(star)
    group.add(star)
  } else if (partId === 'muzzle_ring') {
    // 도넛 링 — 짧은 둥근 목 + 앞뒤로 겹친 두 고리
    const neckGeo = new THREE.CylinderGeometry(0.03 * mz, 0.03 * mz, 0.045 * ml, seg)
    neckGeo.rotateX(Math.PI / 2)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.z = -0.0225 * ml
    primary.push(neck)
    group.add(neck)
    const ringGeo = new THREE.TorusGeometry(0.052 * mz, 0.011 * mz, 8, seg)
    geos.push(ringGeo)
    for (const z of [-0.04 * ml, -0.065 * ml]) {
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(z < -0.05 * ml ? 0xff8a2b : PLACEHOLDER))
      ring.position.z = z
      if (z >= -0.05 * ml) accent.push(ring)
      group.add(ring)
    }
  } else {
    // 나팔 팁 — 트럼펫 모양 flare (넓은 벨 입구가 전방 -Z, 립 링과 정렬)
    const hornGeo = new THREE.CylinderGeometry(0.06 * mz, 0.035 * mz, 0.08 * ml, seg, 1, true)
    hornGeo.rotateX(-Math.PI / 2)
    geos.push(hornGeo)
    const horn = new THREE.Mesh(hornGeo, fixedMaterial(PLACEHOLDER))
    horn.position.set(0, 0, -0.04 * ml)
    primary.push(horn)
    group.add(horn)
    const lipGeo = new THREE.TorusGeometry(0.06 * mz, 0.008 * mz, 8, seg)
    geos.push(lipGeo)
    const lip = new THREE.Mesh(lipGeo, fixedMaterial(PLACEHOLDER))
    lip.position.set(0, 0, -0.08 * ml)
    accent.push(lip)
    group.add(lip)
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 탄창(다트 팩) — 몸통 아래 급탄구에 부착, -Y 로 매달림 ────
