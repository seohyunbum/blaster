import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildStock(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 12, 8)
  const sLen = morphLerp('stockLength', resolveMorph(opts.morph, 'stockLength'))
  const sTh = morphLerp('stockThick', resolveMorph(opts.morph, 'stockThick'))

  if (partId === 'stock_comet') {
    // 길게 뻗은 둥근 꼬리 + 별구슬 쿠션
    const armGeo = new THREE.CapsuleGeometry(0.024 * sTh, 0.16 * sLen, 3, seg)
    armGeo.rotateX(Math.PI / 2)
    geos.push(armGeo)
    const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
    arm.position.z = 0.08 * sLen - 0.01
    primary.push(arm)
    group.add(arm)
    const orbGeo = new THREE.SphereGeometry(0.052 * sTh, seg, seg)
    geos.push(orbGeo)
    const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
    orb.scale.y = 1.25
    orb.position.z = 0.18 * sLen
    secondary.push(orb)
    group.add(orb)
  } else if (partId === 'stock_turbine') {
    // 평행한 두 지지대 + 넓은 원형 쿠션
    const armGeo = new THREE.CapsuleGeometry(0.014 * sTh, 0.14 * sLen, 3, seg)
    armGeo.rotateX(Math.PI / 2)
    geos.push(armGeo)
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
      arm.position.set(sx * 0.035 * sTh, 0, 0.07 * sLen - 0.008)
      primary.push(arm)
      group.add(arm)
    }
    const padGeo = new THREE.CylinderGeometry(0.072 * sTh, 0.072 * sTh, 0.035, seg)
    padGeo.rotateX(Math.PI / 2)
    geos.push(padGeo)
    const pad = new THREE.Mesh(padGeo, fixedMaterial(PLACEHOLDER))
    pad.scale.y = 1.2
    pad.position.z = 0.15 * sLen
    secondary.push(pad)
    group.add(pad)
  } else if (partId === 'stock_buzz') {
    // 몸통 뒤에 바로 붙는 초소형 방울
    const buzzGeo = new THREE.SphereGeometry(0.052 * sTh, seg, seg)
    geos.push(buzzGeo)
    const buzz = new THREE.Mesh(buzzGeo, fixedMaterial(PLACEHOLDER))
    buzz.scale.set(1.1, 1, 1.25 * sLen)
    buzz.position.z = 0.055 * sLen - 0.008
    primary.push(buzz)
    group.add(buzz)
  } else if (partId === 'stock_reverse') {
    // 큰 고리와 뒤쪽 말랑 방울
    const loopGeo = new THREE.TorusGeometry(0.052 * sTh, 0.012 * sTh, 7, seg)
    geos.push(loopGeo)
    const loop = new THREE.Mesh(loopGeo, fixedMaterial(PLACEHOLDER))
    loop.scale.y = 1.18
    loop.position.z = 0.09 * sLen
    primary.push(loop)
    group.add(loop)
    const orbGeo = new THREE.SphereGeometry(0.032 * sTh, seg, seg)
    geos.push(orbGeo)
    const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
    orb.position.set(0, -0.055 * sTh, 0.15 * sLen)
    secondary.push(orb)
    group.add(orb)
  } else if (partId === 'stock_wire') {
    // 위·아래 선이 뒤에서 만나는 둥근 접이 고리
    const zEnd = 0.17 * sLen
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.008),
      new THREE.Vector3(0, 0.065 * sTh, zEnd * 0.48),
      new THREE.Vector3(0, 0.052 * sTh, zEnd),
      new THREE.Vector3(0, -0.052 * sTh, zEnd),
      new THREE.Vector3(0, -0.065 * sTh, zEnd * 0.48),
      new THREE.Vector3(0, 0, -0.008),
    ], true, 'centripetal')
    const loopGeo = new THREE.TubeGeometry(loopCurve, seg * 2, 0.009 * sTh, Math.max(6, seg - 2), true)
    geos.push(loopGeo)
    const loop = new THREE.Mesh(loopGeo, fixedMaterial(PLACEHOLDER))
    primary.push(loop)
    group.add(loop)
    const padGeo = new THREE.CapsuleGeometry(0.018 * sTh, 0.085 * sTh, 3, seg)
    geos.push(padGeo)
    const pad = new THREE.Mesh(padGeo, fixedMaterial(PLACEHOLDER))
    pad.position.set(0, 0, zEnd)
    secondary.push(pad)
    group.add(pad)
  } else if (partId === 'stock_racer') {
    // 낮은 알약형 지지대 + 납작한 지느러미 쿠션
    const armGeo = new THREE.CapsuleGeometry(0.02 * sTh, 0.13 * sLen, 3, seg)
    armGeo.rotateX(Math.PI / 2)
    geos.push(armGeo)
    const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
    arm.position.set(0, -0.018, 0.065 * sLen - 0.008)
    primary.push(arm)
    group.add(arm)
    const finGeo = new RoundedBoxGeometry(0.045 * sTh, 0.075 * sTh, 0.07, 2, 0.012)
    geos.push(finGeo)
    const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
    fin.position.set(0, 0.015, 0.14 * sLen)
    fin.rotation.x = -0.25
    secondary.push(fin)
    group.add(fin)
  } else if (partId === 'stock_spring') {
    // 둥근 중심축을 감싸는 세 개의 통통한 스프링 고리
    const armGeo = new THREE.CapsuleGeometry(0.018 * sTh, 0.14 * sLen, 3, seg)
    armGeo.rotateX(Math.PI / 2)
    geos.push(armGeo)
    const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
    arm.position.z = 0.07 * sLen - 0.008
    primary.push(arm)
    group.add(arm)
    const ringGeo = new THREE.TorusGeometry(0.038 * sTh, 0.009 * sTh, 7, seg)
    geos.push(ringGeo)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
      ring.position.z = (0.045 + i * 0.04) * sLen
      secondary.push(ring)
      group.add(ring)
    }
  } else if (partId === 'stock_skeleton') {
    // 두 개의 열린 지지대와 도넛형 끝 받침
    const armGeo = new THREE.CapsuleGeometry(0.011 * sTh, 0.15 * sLen, 3, seg)
    armGeo.rotateX(Math.PI / 2)
    geos.push(armGeo)
    for (const sy of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
      arm.position.set(0, sy * 0.032 * sTh, 0.075 * sLen - 0.008)
      arm.rotation.x = sy * 0.12
      primary.push(arm)
      group.add(arm)
    }
    const padGeo = new THREE.TorusGeometry(0.046 * sTh, 0.012 * sTh, 7, seg)
    geos.push(padGeo)
    const pad = new THREE.Mesh(padGeo, fixedMaterial(PLACEHOLDER))
    pad.scale.y = 1.18
    pad.position.z = 0.155 * sLen
    secondary.push(pad)
    group.add(pad)
  } else if (partId === 'stock_balloon') {
    // 풍선 스톡 — 큰 구 (뒤로 매달림)
    const balloonGeo = new THREE.SphereGeometry(0.075 * sTh, seg, seg)
    geos.push(balloonGeo)
    const b = new THREE.Mesh(balloonGeo, fixedMaterial(PLACEHOLDER))
    b.scale.set(1, 1.1, 1.2 * sLen)
    // 구 앞면이 몸통 뒷면(z=0)에 살짝 겹치게
    b.position.set(0, 0.0, 0.075 * sTh * 1.2 * sLen - 0.006)
    primary.push(b)
    group.add(b)
  } else {
    const armGeo = new THREE.BoxGeometry(0.05 * sTh, 0.05 * sTh, 0.14 * sLen)
    geos.push(armGeo)
    const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
    // arm 앞면(z=-half)이 몸통 뒷면(z=0)에 붙게
    arm.position.set(0, 0.0, 0.07 * sLen - 0.006)
    primary.push(arm)
    group.add(arm)
    const padGeo = new RoundedBoxGeometry(0.055 * sTh, 0.1 * sTh, 0.04, 2, 0.015)
    geos.push(padGeo)
    const pad = new THREE.Mesh(padGeo, fixedMaterial(PLACEHOLDER))
    pad.position.set(0, 0.0, 0.14 * sLen + 0.014)
    secondary.push(pad)
    group.add(pad)
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 머즐 (배럴 끝에 부착, -Z 로 뻗음) ──────────────────────
