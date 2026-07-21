import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildGrip(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 10, 6)
  const banana = partId === 'grip_banana'
  const chunky = partId === 'grip_chunky'
  const gLen = morphLerp('gripLength', resolveMorph(opts.morph, 'gripLength'))
  const gThick = morphLerp('gripThick', resolveMorph(opts.morph, 'gripThick'))
  const gAng = morphLerp('gripAngle', resolveMorph(opts.morph, 'gripAngle'))

  // ── 미니건 손잡이 — 몸통 위(gripTop 앵커)에 얹히는 스페이드형 톱 핸들 ──
  // 수직 기둥 2 + 가로 그립 바 + 그립링. +Y 로 자라 몸통 위로 솟는다(아래 그립과 반대).
  if (partId === 'grip_minigun') {
    // 몸통 안으로 깊게 파묻어(0.04) 곡면 몸통·기울기 극단에서도 뜨지 않게(공중부양 방지)
    const embed = 0.04
    const barY = 0.06 + 0.05 * gLen // 그립 바 높이(몸통 윗면 기준)
    const span = 0.035 + 0.02 * gLen // 앞뒤 반경(핸들 길이) — 뒤로 뻗어도 곡면서 안 뜨게 상한
    const postR = 0.009 * gThick
    const barR = 0.013 * gThick
    group.rotation.x = (gAng - 0.4) * 0.5 // 기본 0 근처, 기울기 슬라이더로 앞뒤로

    const postGeo = new THREE.CylinderGeometry(postR, postR * 1.15, barY + embed, seg)
    geos.push(postGeo)
    for (const pz of [-span, span]) {
      const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
      post.position.set(0, (barY - embed) / 2, pz)
      primary.push(post)
      group.add(post)
    }
    const barGeo = new THREE.CylinderGeometry(barR, barR, span * 2 + barR * 2, seg)
    barGeo.rotateX(Math.PI / 2) // 길이축 = Z
    geos.push(barGeo)
    const bar = new THREE.Mesh(barGeo, fixedMaterial(PLACEHOLDER))
    bar.position.set(0, barY, 0)
    primary.push(bar)
    group.add(bar)
    // 그립 링 — 바가 Z축이라 토러스는 회전 없이(기본 XY평면=구멍축 Z) 바를 감싼다
    for (let i = 0; i < 2; i++) {
      const ringGeo = new THREE.TorusGeometry(barR * 1.35, barR * 0.34, 6, seg)
      geos.push(ringGeo)
      const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
      ring.position.set(0, barY, (i === 0 ? -1 : 1) * span * 0.5)
      accent.push(ring)
      group.add(ring)
    }
    return {
      group,
      zones: { primary, accent },
      anchors: {},
      dispose: () => geos.forEach((geo) => geo.dispose()),
    }
  }

  if (partId === 'grip_turbine') {
    // 넓은 U자 받침 — 둥근 기둥 둘과 가로 바 하나
    const postR = 0.011 * gThick
    const postGeo = new THREE.CapsuleGeometry(postR, 0.055 * gLen, 3, seg)
    geos.push(postGeo)
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
      post.position.set(sx * 0.026 * gThick, -0.04 * gLen, 0.01)
      primary.push(post)
      group.add(post)
    }
    const barGeo = new THREE.CapsuleGeometry(0.013 * gThick, 0.052 * gThick, 3, seg)
    barGeo.rotateZ(Math.PI / 2)
    geos.push(barGeo)
    const bar = new THREE.Mesh(barGeo, fixedMaterial(PLACEHOLDER))
    bar.position.set(0, -0.085 * gLen, 0.01)
    primary.push(bar)
    group.add(bar)
    const ringGeo = new THREE.TorusGeometry(0.016 * gThick, 0.004, 6, seg)
    ringGeo.rotateY(Math.PI / 2)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, -0.085 * gLen, 0.01)
    accent.push(ring)
    group.add(ring)
    return { group, zones: { primary, accent }, anchors: {}, dispose: () => geos.forEach((geo) => geo.dispose()) }
  }

  if (partId === 'grip_buzz') {
    // 짧은 목 + 손바닥 방울
    const stemGeo = new RoundedBoxGeometry(0.025 * gThick, 0.04 * gLen, 0.03 * gThick, 2, 0.009)
    geos.push(stemGeo)
    const stem = new THREE.Mesh(stemGeo, fixedMaterial(PLACEHOLDER))
    stem.position.y = -0.018 * gLen
    primary.push(stem)
    group.add(stem)
    const orbGeo = new THREE.SphereGeometry(0.032 * gThick, seg, seg)
    geos.push(orbGeo)
    const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
    orb.scale.y = 1.15 * gLen
    orb.position.set(0, -0.056 * gLen, 0.006)
    primary.push(orb)
    group.add(orb)
    return { group, zones: { primary, accent }, anchors: {}, dispose: () => geos.forEach((geo) => geo.dispose()) }
  }

  if (partId === 'grip_reverse') {
    // 뒤로 기운 캡슐 + 균형 방울
    const rr = 0.025 * gThick
    const ang = 0.38 + gAng * 0.2
    const bodyGeo = new THREE.CapsuleGeometry(rr, 0.082 * gLen, 3, seg)
    geos.push(bodyGeo)
    const body = new THREE.Mesh(bodyGeo, fixedMaterial(PLACEHOLDER))
    body.rotation.x = ang
    body.position.set(0, -0.055 * gLen, 0.016)
    primary.push(body)
    group.add(body)
    const orbGeo = new THREE.SphereGeometry(rr * 1.22, seg, seg)
    geos.push(orbGeo)
    const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
    orb.position.set(0, -0.105 * gLen, 0.055)
    accent.push(orb)
    group.add(orb)
    return { group, zones: { primary, accent }, anchors: {}, dispose: () => geos.forEach((geo) => geo.dispose()) }
  }

  if (partId === 'grip_hook') {
    // 아래로 내려갔다 뒤로 둥글게 말리는 루프형 손잡이
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.005, 0),
      new THREE.Vector3(0, -0.045 * gLen, 0.005),
      new THREE.Vector3(0, -0.1 * gLen, 0.025),
      new THREE.Vector3(0, -0.075 * gLen, 0.065),
    ], false, 'centripetal')
    const hookGeo = new THREE.TubeGeometry(curve, seg * 2, 0.016 * gThick, Math.max(6, seg - 2), false)
    geos.push(hookGeo)
    const hook = new THREE.Mesh(hookGeo, fixedMaterial(PLACEHOLDER))
    primary.push(hook)
    group.add(hook)
    const beadGeo = new THREE.SphereGeometry(0.021 * gThick, seg, seg)
    geos.push(beadGeo)
    const bead = new THREE.Mesh(beadGeo, fixedMaterial(PLACEHOLDER))
    bead.position.set(0, -0.075 * gLen, 0.065)
    accent.push(bead)
    group.add(bead)
    return { group, zones: { primary, accent }, anchors: {}, dispose: () => geos.forEach((geo) => geo.dispose()) }
  }

  if (partId === 'grip_racer') {
    // 뒤로 기운 매끈한 손잡이 + 얇은 지느러미
    const rr = 0.022 * gThick
    const ang = 0.3 + gAng * 0.28
    const bodyGeo = new THREE.CapsuleGeometry(rr, 0.095 * gLen, 3, seg)
    geos.push(bodyGeo)
    const body = new THREE.Mesh(bodyGeo, fixedMaterial(PLACEHOLDER))
    body.rotation.x = ang
    body.position.set(0, -0.057 * gLen, 0.015)
    primary.push(body)
    group.add(body)
    const finGeo = new RoundedBoxGeometry(0.012, 0.058 * gLen, 0.045 * gThick, 2, 0.005)
    geos.push(finGeo)
    const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
    fin.rotation.x = ang
    fin.position.set(0, -0.06 * gLen, 0.038)
    accent.push(fin)
    group.add(fin)
    return { group, zones: { primary, accent }, anchors: {}, dispose: () => geos.forEach((geo) => geo.dispose()) }
  }

  // ── 리볼버 그립 — 뒤로 둥글게 말린 서부식 손잡이(둥근 뒤꿈치) ──
  if (partId === 'grip_revolver') {
    const rgr = 0.028 * gThick
    const rlen = 0.085 * gLen
    const ang = 0.5 + gAng * 0.35 // 기본적으로 뒤로 더 젖힘(서부식)
    const gy = 0.008 - (0.045 * gLen * Math.cos(ang) + rgr)
    // 손잡이 몸통 — 뒤로 젖힌 캡슐
    const gGeo = new THREE.CapsuleGeometry(rgr, rlen, 3, seg)
    geos.push(gGeo)
    const g = new THREE.Mesh(gGeo, fixedMaterial(PLACEHOLDER))
    g.rotation.x = ang
    g.position.set(0, gy, 0.02)
    primary.push(g)
    group.add(g)
    // 둥근 뒤꿈치(heel) — 캡슐 아래끝(젖힌 축 방향)에 통통한 공
    const L = rlen * 0.5 + rgr * 0.4
    const heelGeo = new THREE.SphereGeometry(rgr * 1.3, seg, seg)
    geos.push(heelGeo)
    const heel = new THREE.Mesh(heelGeo, fixedMaterial(PLACEHOLDER))
    heel.position.set(0, gy - L * Math.cos(ang), 0.02 - L * Math.sin(ang))
    primary.push(heel)
    group.add(heel)
    // 링 장식
    const kGeo = new THREE.TorusGeometry(rgr * 1.12, 0.005 * gThick, 6, seg)
    geos.push(kGeo)
    const k = new THREE.Mesh(kGeo, fixedMaterial(PLACEHOLDER))
    k.rotation.x = ang + Math.PI / 2
    k.position.set(0, gy + rlen * 0.18 * Math.cos(ang), 0.02 - rlen * 0.18 * Math.sin(ang))
    accent.push(k)
    group.add(k)
    return {
      group,
      zones: { primary, accent },
      anchors: {},
      dispose: () => geos.forEach((geo) => geo.dispose()),
    }
  }

  const gr = (banana ? 0.026 : chunky ? 0.032 : 0.024) * gThick

  const gripGeo = new THREE.CapsuleGeometry(gr, (chunky ? 0.075 : 0.09) * gLen, 3, seg)
  geos.push(gripGeo)
  const gAngle = gAng + (banana ? 0.14 : 0)
  // 캡슐 상단을 몸통 밑면(y=0)에 살짝 겹치게 — 아래로만 자라 항상 붙는다(공중부양 방지)
  const gy = 0.008 - (0.045 * gLen * Math.cos(gAngle) + gr)
  const g = new THREE.Mesh(gripGeo, fixedMaterial(PLACEHOLDER))
  g.rotation.x = gAngle
  g.position.set(0, gy, 0.01)
  primary.push(g)
  group.add(g)

  for (let i = 0; i < 2; i++) {
    const kGeo = new THREE.TorusGeometry(gr * 1.08, 0.005 * gThick, 6, seg)
    geos.push(kGeo)
    const k = new THREE.Mesh(kGeo, fixedMaterial(PLACEHOLDER))
    k.rotation.y = Math.PI / 2
    k.position.set(0, gy + (0.02 - i * 0.035) * gLen, 0.02)
    accent.push(k)
    group.add(k)
  }

  if (chunky) {
    const bumperGeo = new THREE.SphereGeometry(gr * 1.18, seg, seg)
    geos.push(bumperGeo)
    const bumper = new THREE.Mesh(bumperGeo, fixedMaterial(PLACEHOLDER))
    bumper.position.set(0, gy - 0.042 * gLen, 0.024)
    accent.push(bumper)
    group.add(bumper)
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((geo) => geo.dispose()),
  }
}

// ─── 스톡 (morph 없음) ──────────────────────────────────────
