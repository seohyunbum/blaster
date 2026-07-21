// src/game/partVisuals.ts — 파라메트릭 메시 빌더 (정본 지오메트리 레시피 03, morph 사양 09).
// buildPart(partId, {morph}) → {group, zones, anchors, dispose}. 순수 팩토리: 같은 입력 → 같은 형태.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MorphState, PartId, SocketId, ZoneId } from './types.ts'
import { morphLerp, resolveMorph, barrelCountFromMorph, barrelLayout } from './morph.ts'
import { fixedMaterial, glowMaterial } from './materials.ts'

export interface BuildOpts {
  morph: MorphState
  lod?: 'drag' | 'full'
  /** 미니건 손잡이(몸통 위 그립)와 자리 겹침 방지 — 몸통 캐리핸들 생략 (assembly 가 지정). */
  hideCarryHandle?: boolean
}

/** 앵커 키 = 소켓명 + 특수 마운트(gripTop = 미니건 손잡이용 몸통 위 마운트). */
export type AnchorId = SocketId | 'gripTop'

export interface BuiltPart {
  group: THREE.Group
  zones: Partial<Record<ZoneId, THREE.Mesh[]>>
  anchors: Partial<Record<AnchorId, THREE.Object3D>>
  dispose(): void
}

const PLACEHOLDER = 0xcfd3da // 색칠 전 임시색 (recomposeBlaster 가 덮어씀)

interface BodyDims {
  w: number
  h: number
  d: number
  /** 셸 실루엣 — 몸통마다 형태 자체가 다르다 */
  shell: 'box' | 'capsule' | 'sphere'
  /** 카탈로그 고유 장식 — 최대 2메시로 몸통 계열을 한눈에 구분한다. */
  detail?: 'pods' | 'wheels' | 'bumpers' | 'rearBubble' | 'twinCheeks' | 'hook' | 'wings'
}
const BODY_DIMS: Record<string, BodyDims> = {
  body_popcorn: { w: 0.14, h: 0.16, d: 0.44, shell: 'box' },
  body_bulldog: { w: 0.17, h: 0.19, d: 0.5, shell: 'box' },
  body_titan: { w: 0.2, h: 0.22, d: 0.58, shell: 'box' },
  body_jelly: { w: 0.16, h: 0.18, d: 0.4, shell: 'sphere' },
  body_rocket: { w: 0.13, h: 0.13, d: 0.52, shell: 'capsule' },
  body_orb: { w: 0.19, h: 0.19, d: 0.34, shell: 'sphere' },
  body_wedge: { w: 0.15, h: 0.13, d: 0.48, shell: 'box' },
  body_chunk: { w: 0.22, h: 0.17, d: 0.42, shell: 'box' },
  // 미니건 코어 — 동그랗고 압도적으로 큰 왕구슬(전 몸통 중 최대 실루엣)
  body_minigun: { w: 0.36, h: 0.36, d: 0.52, shell: 'sphere' },
  body_comet: { w: 0.2, h: 0.24, d: 0.58, shell: 'capsule', detail: 'pods' },
  body_turbine: { w: 0.29, h: 0.27, d: 0.54, shell: 'box', detail: 'wheels' },
  body_buzz: { w: 0.15, h: 0.17, d: 0.3, shell: 'sphere', detail: 'bumpers' },
  body_reverse: { w: 0.23, h: 0.24, d: 0.46, shell: 'capsule', detail: 'rearBubble' },
  body_duo: { w: 0.23, h: 0.19, d: 0.43, shell: 'box', detail: 'twinCheeks' },
  body_hook: { w: 0.17, h: 0.19, d: 0.34, shell: 'capsule', detail: 'hook' },
  body_racer: { w: 0.18, h: 0.17, d: 0.43, shell: 'box', detail: 'wings' },
}

/** 몸통 셸 지오메트리 — 실루엣 자체를 바꾼다(박스/캡슐/구). */
function makeShell(
  shell: BodyDims['shell'],
  w: number,
  h: number,
  d: number,
  radius: number,
  seg: number,
): THREE.BufferGeometry {
  if (shell === 'capsule') {
    const r = Math.min(w, h) / 2
    const len = Math.max(0.02, d - r * 2)
    const g = new THREE.CapsuleGeometry(r, len, 3, Math.max(8, seg * 3))
    g.rotateX(Math.PI / 2) // 길이축 = Z (03 §1.1)
    return g
  }
  if (shell === 'sphere') {
    const g = new THREE.SphereGeometry(0.5, Math.max(10, seg * 4), Math.max(8, seg * 3))
    g.scale(w, h, d)
    return g
  }
  return new RoundedBoxGeometry(w, h, d, seg, radius)
}
interface BarrelDims {
  r: number
  l: number
  style?: 'beads' | 'wheel' | 'bubble' | 'balance' | 'bell' | 'fins'
  baseCount?: number
}
const BARREL_DIMS: Record<string, BarrelDims> = {
  barrel_snap: { r: 0.035, l: 0.18 },
  barrel_rail: { r: 0.038, l: 0.4 },
  barrel_stub: { r: 0.05, l: 0.16 },
  barrel_spiral: { r: 0.04, l: 0.32 },
  barrel_wide: { r: 0.058, l: 0.22 },
  barrel_twin: { r: 0.03, l: 0.3, baseCount: 2 },
  barrel_needle: { r: 0.022, l: 0.44 },
  barrel_comet: { r: 0.032, l: 0.38, style: 'beads' },
  barrel_turbine: { r: 0.052, l: 0.3, style: 'wheel' },
  barrel_buzz: { r: 0.045, l: 0.14, style: 'bubble' },
  barrel_reverse: { r: 0.04, l: 0.23, style: 'balance' },
  barrel_hook: { r: 0.055, l: 0.13, style: 'bell' },
  barrel_racer: { r: 0.03, l: 0.34, style: 'fins' },
}

function segFor(lod: 'drag' | 'full' | undefined, full: number, drag: number): number {
  return lod === 'drag' ? drag : full
}

// ─── 몸통 ──────────────────────────────────────────────────
function buildBody(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BODY_DIMS[partId] ?? BODY_DIMS.body_popcorn!
  const lenScale = morphLerp('bodyLength', resolveMorph(opts.morph, 'bodyLength'))
  const chub = morphLerp('bodyChub', resolveMorph(opts.morph, 'bodyChub'))
  const noseT = resolveMorph(opts.morph, 'bodyNose')

  const w = dims.w * chub
  const h = dims.h * chub
  const d = dims.d * lenScale
  const halfZ = d / 2

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const boxSeg = segFor(opts.lod, 4, 2)
  const minSide = Math.min(w, h)
  const roundFactor = morphLerp('bodyRound', resolveMorph(opts.morph, 'bodyRound'))
  const radius = Math.min(0.49 * minSide, roundFactor * minSide)
  const shellGeo = makeShell(dims.shell, w, h, d, radius, boxSeg)
  geos.push(shellGeo)
  const shell = new THREE.Mesh(shellGeo, fixedMaterial(PLACEHOLDER))
  primary.push(shell)
  group.add(shell)

  // 캐리핸들 (위) — secondary. 미니건 손잡이 장착 시엔 자리가 겹쳐 생략(관통 방지).
  if (!opts.hideCarryHandle) {
    const handleGeo = new RoundedBoxGeometry(w * 0.5, h * 0.18, d * 0.42, 2, 0.02)
    geos.push(handleGeo)
    const handle = new THREE.Mesh(handleGeo, fixedMaterial(PLACEHOLDER))
    handle.position.set(0, h * 0.5 + h * 0.06, -d * 0.05)
    secondary.push(handle)
    group.add(handle)
  }

  // 방아쇠울 (아래 앞) — accent
  const guardSeg = segFor(opts.lod, 16, 10)
  const guardGeo = new THREE.TorusGeometry(0.045, 0.012, 8, guardSeg, Math.PI * 1.4)
  geos.push(guardGeo)
  const guard = new THREE.Mesh(guardGeo, fixedMaterial(PLACEHOLDER))
  guard.position.set(0, -h * 0.45, -d * 0.12)
  guard.rotation.x = Math.PI * 0.5
  accent.push(guard)
  group.add(guard)

  // 코 (앞) — primary. box 는 앞면 평평→z=-halfZ 부착. 구·캡슐은 앞끝이 점(반경0)이라
  // 그대로 두면 코 원판이 뜬 목걸이(collar)가 됨 → 곡면 안쪽에 base 를 파묻어 병합.
  const noseLen = 0.01 + 0.1 * noseT
  let noseBaseR = Math.max(0.02, h * 0.42)
  let noseBaseZ = -halfZ + 0.002
  if (dims.shell !== 'box') {
    const frac = 0.62
    noseBaseZ = -halfZ * frac
    const shellR = (h / 2) * Math.sqrt(Math.max(0, 1 - frac * frac))
    noseBaseR = Math.min(noseBaseR, shellR * 0.98)
  }
  const tipR = Math.max(0.018, noseBaseR * (1 - 0.7 * noseT))
  const coneSeg = segFor(opts.lod, 14, 8)
  const noseGeo = new THREE.ConeGeometry(noseBaseR, noseLen, coneSeg)
  geos.push(noseGeo)
  const nose = new THREE.Mesh(noseGeo, fixedMaterial(PLACEHOLDER))
  nose.rotation.x = -Math.PI * 0.5 // 첨단이 -Z(전방)
  nose.position.set(0, 0, noseBaseZ - noseLen * 0.5)
  primary.push(nose)
  group.add(nose)

  const capGeo = new THREE.SphereGeometry(tipR, coneSeg, Math.max(6, coneSeg / 2))
  geos.push(capGeo)
  const cap = new THREE.Mesh(capGeo, fixedMaterial(PLACEHOLDER))
  cap.position.set(0, 0, noseBaseZ - noseLen)
  primary.push(cap)
  group.add(cap)

  // 카탈로그 고유 시그니처. 모두 둥근 장난감 형태이며, 극단 morph에서도
  // 몸통 메시 예산(기본 5 + 고유 2 + 자유 장식 7 = 14)을 넘지 않는다.
  if (dims.detail === 'pods' || dims.detail === 'bumpers') {
    const podR = Math.min(w, h) * (dims.detail === 'pods' ? 0.25 : 0.31)
    const podGeo = new THREE.SphereGeometry(podR, coneSeg, Math.max(6, coneSeg / 2))
    geos.push(podGeo)
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(podGeo, fixedMaterial(PLACEHOLDER))
      pod.position.set(sx * (w * 0.5 + podR * 0.35), -h * 0.02, -d * 0.05)
      secondary.push(pod)
      group.add(pod)
    }
  } else if (dims.detail === 'wheels') {
    const wheelGeo = new THREE.TorusGeometry(h * 0.31, h * 0.1, 7, coneSeg)
    wheelGeo.rotateY(Math.PI / 2)
    geos.push(wheelGeo)
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, fixedMaterial(PLACEHOLDER))
      wheel.position.set(sx * (w * 0.5 + 0.004), 0, d * 0.08)
      accent.push(wheel)
      group.add(wheel)
    }
  } else if (dims.detail === 'rearBubble') {
    const bubbleR = h * 0.3
    const bubbleGeo = new THREE.SphereGeometry(bubbleR, coneSeg, Math.max(6, coneSeg / 2))
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.position.set(0, h * 0.18, halfZ * 0.68)
    secondary.push(bubble)
    group.add(bubble)
    const haloGeo = new THREE.TorusGeometry(bubbleR * 0.72, bubbleR * 0.15, 6, coneSeg)
    geos.push(haloGeo)
    const halo = new THREE.Mesh(haloGeo, fixedMaterial(PLACEHOLDER))
    halo.position.copy(bubble.position)
    accent.push(halo)
    group.add(halo)
  } else if (dims.detail === 'twinCheeks') {
    const cheekR = h * 0.2
    const cheekGeo = new THREE.CapsuleGeometry(cheekR, d * 0.4, 3, coneSeg)
    cheekGeo.rotateX(Math.PI / 2)
    geos.push(cheekGeo)
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(cheekGeo, fixedMaterial(PLACEHOLDER))
      cheek.position.set(sx * (w * 0.5 + cheekR * 0.25), -h * 0.08, 0)
      secondary.push(cheek)
      group.add(cheek)
    }
  } else if (dims.detail === 'hook') {
    const hookR = h * 0.32
    const hookGeo = new THREE.TorusGeometry(hookR, h * 0.07, 6, coneSeg, Math.PI * 1.45)
    hookGeo.rotateY(Math.PI / 2)
    geos.push(hookGeo)
    const hook = new THREE.Mesh(hookGeo, fixedMaterial(PLACEHOLDER))
    hook.position.set(w * 0.5 + 0.008, -h * 0.05, d * 0.08)
    hook.rotation.x = -0.4
    accent.push(hook)
    group.add(hook)
    const beadGeo = new THREE.SphereGeometry(h * 0.075, 8, 6)
    geos.push(beadGeo)
    const bead = new THREE.Mesh(beadGeo, fixedMaterial(PLACEHOLDER))
    bead.position.set(w * 0.5 + 0.008, -h * 0.32, d * 0.17)
    accent.push(bead)
    group.add(bead)
  } else if (dims.detail === 'wings') {
    const wingGeo = new RoundedBoxGeometry(w * 0.18, h * 0.3, d * 0.48, 2, 0.012)
    geos.push(wingGeo)
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, fixedMaterial(PLACEHOLDER))
      wing.position.set(sx * (w * 0.56), -h * 0.05, d * 0.05)
      wing.rotation.z = sx * -0.28
      accent.push(wing)
      group.add(wing)
    }
  }

  // ── 장식 (켰을 때만 생성) ──
  const finT = morphLerp('bodyFin', resolveMorph(opts.morph, 'bodyFin'))
  if (finT > 0.02) {
    const finH = h * (0.35 + 0.9 * finT)
    const finGeo = new THREE.BoxGeometry(0.012, finH, d * 0.5)
    geos.push(finGeo)
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(sx * (w * 0.5 + 0.006), -h * 0.05, d * 0.02)
      fin.rotation.z = sx * -0.25
      accent.push(fin)
      group.add(fin)
    }
  }
  const crestT = morphLerp('bodyCrest', resolveMorph(opts.morph, 'bodyCrest'))
  if (crestT > 0.02) {
    const crestH = h * (0.3 + 0.9 * crestT)
    const crestGeo = new THREE.BoxGeometry(0.014, crestH, d * 0.42)
    geos.push(crestGeo)
    const crest = new THREE.Mesh(crestGeo, fixedMaterial(PLACEHOLDER))
    crest.position.set(0, h * 0.5 + crestH * 0.4, d * 0.03)
    crest.rotation.x = -0.12
    accent.push(crest)
    group.add(crest)
  }
  const tailT = morphLerp('bodyTail', resolveMorph(opts.morph, 'bodyTail'))
  if (tailT > 0.02) {
    // 꼬리날개 — 뒤쪽에서 위로 벌어지는 V자 한 쌍
    const tailH = h * (0.4 + 1.1 * tailT)
    const tailGeo = new THREE.BoxGeometry(0.011, tailH, d * 0.2)
    geos.push(tailGeo)
    for (const sx of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeo, fixedMaterial(PLACEHOLDER))
      tail.position.set(sx * w * 0.3, h * 0.35 + tailH * 0.35, halfZ - d * 0.1)
      tail.rotation.z = sx * 0.45
      accent.push(tail)
      group.add(tail)
    }
  }
  const antT = morphLerp('bodyAntenna', resolveMorph(opts.morph, 'bodyAntenna'))
  if (antT > 0.02) {
    const antLen = 0.03 + 0.11 * antT
    const seg = segFor(opts.lod, 8, 6)
    const poleGeo = new THREE.CylinderGeometry(0.004, 0.006, antLen, seg)
    geos.push(poleGeo)
    const pole = new THREE.Mesh(poleGeo, fixedMaterial(PLACEHOLDER))
    pole.position.set(w * 0.28, h * 0.5 + antLen * 0.5, d * 0.28)
    secondary.push(pole)
    group.add(pole)
    const ballGeo = new THREE.SphereGeometry(0.014, seg, seg)
    geos.push(ballGeo)
    const ball = new THREE.Mesh(ballGeo, fixedMaterial(PLACEHOLDER))
    ball.position.set(w * 0.28, h * 0.5 + antLen, d * 0.28)
    accent.push(ball)
    group.add(ball)
  }

  // 소켓 앵커 — morph 반영 (09 §3.3)
  const barrelAnchor = new THREE.Object3D()
  barrelAnchor.position.set(0, h * 0.08, -halfZ - noseLen)
  group.add(barrelAnchor)
  const sightAnchor = new THREE.Object3D()
  sightAnchor.position.set(0, h * 0.5 + 0.01, -d * 0.08)
  group.add(sightAnchor)
  const gripAnchor = new THREE.Object3D()
  gripAnchor.position.set(0, -h * 0.5, d * 0.1)
  group.add(gripAnchor)
  const stockAnchor = new THREE.Object3D()
  stockAnchor.position.set(0, 0, halfZ)
  group.add(stockAnchor)
  const muzzleAnchor = new THREE.Object3D() // 배럴 없을 때 폴백
  muzzleAnchor.position.set(0, h * 0.08, -halfZ - noseLen)
  group.add(muzzleAnchor)
  // 탄창 급탄구 — 방아쇠울 앞쪽 아래(그립보다 전방)에서 아래로 매달림
  const magAnchor = new THREE.Object3D()
  magAnchor.position.set(0, -h * 0.44, -d * 0.02)
  group.add(magAnchor)
  // 미니건 손잡이용 — 몸통 위 뒤쪽 마운트(조준기·스코프 등 앞 파츠를 피해 후방-상단). 그 그립만 이 앵커로 라우팅
  const gripTopAnchor = new THREE.Object3D()
  gripTopAnchor.position.set(0, h * 0.5, d * 0.19)
  group.add(gripTopAnchor)
  // 어깨끈용 — 몸통 오른쪽 측면 중앙. 자식 끈의 앞·뒤 고리 간격과 늘어짐을
  // 현재 몸통 morph 치수에 맞게 비례시켜 작은 코어부터 왕구슬 코어까지 밀착시킨다.
  const strapAnchor = new THREE.Object3D()
  const strapScale = d / 0.44
  let strapOuterX = w * 0.5
  if (dims.detail === 'pods' || dims.detail === 'bumpers') {
    const podR = Math.min(w, h) * (dims.detail === 'pods' ? 0.25 : 0.31)
    strapOuterX += podR * 1.35
  } else if (dims.detail === 'wheels') {
    strapOuterX += 0.004 + h * 0.41
  } else if (dims.detail === 'twinCheeks') {
    strapOuterX += h * 0.25
  } else if (dims.detail === 'hook') {
    strapOuterX += 0.008 + h * 0.07
  } else if (dims.detail === 'wings') {
    strapOuterX += w * 0.16
  }
  strapAnchor.position.set(strapOuterX - 0.004, h * 0.2, 0)
  strapAnchor.scale.set(1, Math.max(0.85, strapScale), strapScale)
  group.add(strapAnchor)

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: {
      barrel: barrelAnchor,
      sight: sightAnchor,
      grip: gripAnchor,
      stock: stockAnchor,
      muzzle: muzzleAnchor,
      magazine: magAnchor,
      strap: strapAnchor,
      gripTop: gripTopAnchor,
    },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 배럴 ──────────────────────────────────────────────────
function buildBarrel(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BARREL_DIMS[partId] ?? BARREL_DIMS.barrel_snap!
  const bore = morphLerp('barrelBore', resolveMorph(opts.morph, 'barrelBore'))
  const lenScale = morphLerp('barrelLength', resolveMorph(opts.morph, 'barrelLength'))
  const taperMul = morphLerp('barrelTaper', resolveMorph(opts.morph, 'barrelTaper'))
  const r = dims.r * bore
  const rFront = Math.max(0.012, r * taperMul) // 앞끝 반경 (뿔 모양)
  const l = dims.l * lenScale

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const radial = segFor(opts.lod, 14, 8)
  const count = Math.max(dims.baseCount ?? 1, barrelCountFromMorph(opts.morph))
  // 앞끝이 넓은 뿔 배럴에서도 총열이 안 겹치도록 앞끝 반경 기준으로 간격 산정
  const offsets = barrelLayout(count, Math.max(r, rFront))

  // 총열 count 개 (지오메트리 공유) — 더블배럴·미니건
  const tubeGeo = new THREE.CylinderGeometry(r, rFront, l, radial, 1)
  tubeGeo.rotateX(Math.PI / 2) // 길이축 = Z (03 §1.1)
  geos.push(tubeGeo)
  for (const [ox, oy] of offsets) {
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(ox, oy, -l / 2)
    primary.push(tube)
    group.add(tube)
  }
  // 머즐링 — 단일 총열일 때만 (여러 개면 링끼리 겹쳐 뭉개짐)
  if (count === 1) {
    const ringGeo = new THREE.TorusGeometry(rFront * 1.05, rFront * 0.28, 8, radial)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, 0, -l)
    accent.push(ring)
    group.add(ring)
  }

  // 여러 총열이면 뒤쪽을 묶는 허브(개틀링 몸통)
  if (count > 1) {
    const hubR = (count === 2 ? r * 1.4 : r * 2.9) + 0.006
    const hubGeo = new THREE.CylinderGeometry(hubR, hubR, l * 0.32, radial)
    hubGeo.rotateX(Math.PI / 2)
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(PLACEHOLDER))
    hub.position.set(0, 0, -l * 0.16)
    secondary.push(hub)
    group.add(hub)
  }

  // 파츠별 고유 장식. 자유 장식과 함께 켜져도 14메시 예산 안에서 유지한다.
  const styleR = Math.max(r, rFront)
  if (dims.style === 'beads') {
    const beadGeo = new THREE.TorusGeometry(styleR * 1.35, styleR * 0.22, 6, radial)
    geos.push(beadGeo)
    for (const z of [-l * 0.36, -l * 0.72]) {
      const bead = new THREE.Mesh(beadGeo, fixedMaterial(PLACEHOLDER))
      bead.position.z = z
      accent.push(bead)
      group.add(bead)
    }
  } else if (dims.style === 'wheel') {
    const wheelGeo = new THREE.TorusGeometry(styleR * 1.5, styleR * 0.3, 7, radial)
    geos.push(wheelGeo)
    const wheel = new THREE.Mesh(wheelGeo, fixedMaterial(PLACEHOLDER))
    wheel.position.z = -l * 0.5
    accent.push(wheel)
    group.add(wheel)
    const hubGeo = new THREE.SphereGeometry(styleR * 0.42, radial, Math.max(6, radial - 2))
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(PLACEHOLDER))
    hub.position.z = -l * 0.5
    secondary.push(hub)
    group.add(hub)
  } else if (dims.style === 'bubble') {
    const bubbleGeo = new THREE.SphereGeometry(styleR * 1.25, radial, Math.max(6, radial - 2))
    bubbleGeo.scale(1, 1, 1.15)
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.position.z = -l * 0.34
    secondary.push(bubble)
    group.add(bubble)
  } else if (dims.style === 'balance') {
    const orbGeo = new THREE.SphereGeometry(styleR * 0.58, radial, Math.max(6, radial - 2))
    geos.push(orbGeo)
    for (const sx of [-1, 1]) {
      const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
      orb.position.set(sx * styleR * 1.55, 0, -l * 0.48)
      accent.push(orb)
      group.add(orb)
    }
  } else if (dims.style === 'bell') {
    const bellGeo = new THREE.TorusGeometry(styleR * 1.32, styleR * 0.28, 7, radial)
    geos.push(bellGeo)
    const bell = new THREE.Mesh(bellGeo, fixedMaterial(PLACEHOLDER))
    bell.position.z = -l * 0.76
    accent.push(bell)
    group.add(bell)
  } else if (dims.style === 'fins') {
    const finGeo = new RoundedBoxGeometry(styleR * 0.42, styleR * 1.6, l * 0.38, 2, styleR * 0.12)
    geos.push(finGeo)
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(sx * styleR * 1.15, 0, -l * 0.5)
      fin.rotation.z = sx * -0.25
      accent.push(fin)
      group.add(fin)
    }
  }

  // 장식 — 나팔 끝 (단일 총열일 때만)
  const flareT = count === 1 ? morphLerp('barrelFlare', resolveMorph(opts.morph, 'barrelFlare')) : 0
  if (flareT > 0.02) {
    const flareLen = 0.03 + 0.06 * flareT
    // 접합부(뒤끝)=rFront(연속), 앞끝=넓게 → 벨 입구가 전방(-Z)으로 벌어지는 나팔
    const flareGeo = new THREE.CylinderGeometry(rFront, rFront + 0.04 * flareT, flareLen, radial, 1, true)
    flareGeo.rotateX(Math.PI / 2)
    geos.push(flareGeo)
    const flare = new THREE.Mesh(flareGeo, fixedMaterial(PLACEHOLDER))
    flare.position.set(0, 0, -l - flareLen * 0.5)
    accent.push(flare)
    group.add(flare)
  }

  // 장식 — 마디 고리 (단일 총열일 때만, 배럴을 따라 링이 여러 개)
  const ribT = count === 1 ? morphLerp('barrelRib', resolveMorph(opts.morph, 'barrelRib')) : 0
  if (ribT > 0.02) {
    const count = Math.max(1, Math.round(1 + 4 * ribT))
    for (let i = 0; i < count; i++) {
      const f = (i + 1) / (count + 1) // 뒤끝(0)→앞끝(1) 비율
      const localR = r + (rFront - r) * f // 그 지점 배럴 실반경 (테이퍼 추종)
      const ribGeo = new THREE.TorusGeometry(localR * 1.12, localR * 0.16, 6, radial)
      geos.push(ribGeo)
      const rib = new THREE.Mesh(ribGeo, fixedMaterial(PLACEHOLDER))
      rib.position.set(0, 0, -l * f)
      accent.push(rib)
      group.add(rib)
    }
  }

  // 총구 끝 앵커 (M2 총구 액세서리 승계용, 09 §3.3)
  const muzzleAnchor = new THREE.Object3D()
  muzzleAnchor.position.set(0, 0, -l)
  group.add(muzzleAnchor)

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: { muzzle: muzzleAnchor },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 사이트 (morph 없음) ────────────────────────────────────
function buildSight(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 12, 8)
  const sz = morphLerp('sightSize', resolveMorph(opts.morph, 'sightSize'))
  const hi = morphLerp('sightHeight', resolveMorph(opts.morph, 'sightHeight'))
  // 마운트 윗면(yTop) 위에 각 부품 밑면이 닿게 배치 — 높이 슬라이더로 떠오르던 버그 방지
  const yTop = 0.015 * hi

  const mountGeo = new THREE.BoxGeometry(0.045 * sz, 0.02 * hi, 0.06 * sz)
  geos.push(mountGeo)
  const mount = new THREE.Mesh(mountGeo, fixedMaterial(PLACEHOLDER))
  mount.position.set(0, 0.005 * hi, 0)
  secondary.push(mount)
  group.add(mount)

  if (partId === 'sight_comet') {
    // 코멧 뷰어 — 둥근 긴 관측관 + 앞뒤 빛구슬
    const tubeGeo = new THREE.CapsuleGeometry(0.017 * sz, 0.12 * sz, 3, seg)
    tubeGeo.rotateX(Math.PI / 2)
    geos.push(tubeGeo)
    const tubeY = yTop + 0.018 * sz
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(0, tubeY, -0.012)
    primary.push(tube)
    group.add(tube)
    const orbGeo = new THREE.SphereGeometry(0.011 * sz, seg, Math.max(6, seg - 2))
    geos.push(orbGeo)
    for (const z of [-0.082 * sz, 0.058 * sz]) {
      const orb = new THREE.Mesh(orbGeo, glowMaterial(0x7fd4ff))
      orb.position.set(0, tubeY, z - 0.012)
      group.add(orb)
    }
  } else if (partId === 'sight_bridge') {
    // 브리지 뷰어 — 두 둥근 기둥과 가로 다리
    const postGeo = new THREE.CapsuleGeometry(0.006 * sz, 0.045 * hi, 3, seg)
    geos.push(postGeo)
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
      post.position.set(sx * 0.028 * sz, yTop + 0.025 * hi, 0)
      primary.push(post)
      group.add(post)
    }
    const bridgeGeo = new THREE.CapsuleGeometry(0.007 * sz, 0.056 * sz, 3, seg)
    bridgeGeo.rotateZ(Math.PI / 2)
    geos.push(bridgeGeo)
    const bridge = new THREE.Mesh(bridgeGeo, fixedMaterial(PLACEHOLDER))
    bridge.position.set(0, yTop + 0.052 * hi, 0)
    primary.push(bridge)
    group.add(bridge)
    const beadGeo = new THREE.SphereGeometry(0.007 * sz, seg, Math.max(6, seg - 2))
    geos.push(beadGeo)
    const bead = new THREE.Mesh(beadGeo, glowMaterial(0xffd15c))
    bead.position.set(0, yTop + 0.052 * hi, -0.008)
    group.add(bead)
  } else if (partId === 'sight_bubble') {
    // 버블 뷰어 — 짧은 목 위에 발광 방울
    const bubbleGeo = new THREE.SphereGeometry(0.025 * sz, seg, Math.max(6, seg - 2))
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.scale.y = 1.2 * hi
    bubble.position.set(0, yTop + 0.025 * sz, 0)
    primary.push(bubble)
    group.add(bubble)
    const dotGeo = new THREE.SphereGeometry(0.008 * sz, seg, Math.max(6, seg - 2))
    geos.push(dotGeo)
    const dot = new THREE.Mesh(dotGeo, glowMaterial(0x74f0c5))
    dot.position.set(0, yTop + 0.027 * sz, -0.022 * sz)
    group.add(dot)
  } else if (partId === 'sight_fin') {
    // 핀 뷰어 — 낮고 넓은 삼각 지느러미
    const finGeo = new THREE.ConeGeometry(0.035 * sz, 0.055 * hi, 3)
    geos.push(finGeo)
    const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
    fin.scale.z = 1.6
    fin.position.set(0, yTop + 0.027 * hi, 0)
    fin.rotation.y = Math.PI / 2
    primary.push(fin)
    group.add(fin)
  } else if (partId === 'sight_pin') {
    // 가늠 핀 — 얇은 기둥
    const postGeo = new THREE.CylinderGeometry(0.005 * sz, 0.007 * sz, 0.05 * hi, seg)
    geos.push(postGeo)
    const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
    post.position.set(0, yTop + 0.025 * hi, -0.02)
    primary.push(post)
    group.add(post)
  } else if (partId === 'sight_ring') {
    // 링 사이트 — 고리
    const ringGeo = new THREE.TorusGeometry(0.022 * sz, 0.005 * sz, 8, seg)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, yTop + 0.022 * sz, 0)
    primary.push(ring)
    group.add(ring)
  } else if (partId === 'sight_scope') {
    // 망원 경통 — 긴 원통 + 렌즈
    const tubeGeo = new THREE.CylinderGeometry(0.016 * sz, 0.016 * sz, 0.12 * sz, seg)
    tubeGeo.rotateX(Math.PI / 2)
    geos.push(tubeGeo)
    const tubeY = yTop + 0.016 * sz
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(0, tubeY, -0.01)
    primary.push(tube)
    group.add(tube)
    const lensGeo = new THREE.CylinderGeometry(0.017 * sz, 0.017 * sz, 0.008, seg)
    lensGeo.rotateX(Math.PI / 2)
    geos.push(lensGeo)
    const lens = new THREE.Mesh(lensGeo, glowMaterial(0x7fd4ff))
    // 렌즈는 항상 경통 앞면 바깥에 (작은 sz 에서 묻히던 버그 방지)
    lens.position.set(0, tubeY, -0.01 - 0.06 * sz - 0.004)
    group.add(lens)
  } else {
    // 도트 사이트 — 박스 + 발광 점(고정 비색칠)
    const boxGeo = new RoundedBoxGeometry(0.05 * sz, 0.05 * sz, 0.05 * sz, 2, 0.012)
    geos.push(boxGeo)
    const boxY = yTop + 0.025 * sz
    const box = new THREE.Mesh(boxGeo, fixedMaterial(PLACEHOLDER))
    box.position.set(0, boxY, 0)
    primary.push(box)
    group.add(box)
    const dotGeo = new THREE.SphereGeometry(0.008 * sz, seg, seg)
    geos.push(dotGeo)
    const dot = new THREE.Mesh(dotGeo, glowMaterial(0xff3b3b))
    dot.position.set(0, boxY, -0.026 * sz)
    group.add(dot)
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 그립 (morph 없음) ──────────────────────────────────────
function buildGrip(partId: PartId, opts: BuildOpts): BuiltPart {
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
function buildStock(partId: PartId, opts: BuildOpts): BuiltPart {
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
function buildMuzzle(partId: PartId, opts: BuildOpts): BuiltPart {
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
function buildMagazine(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 14, 8)
  const sz = morphLerp('magSize', resolveMorph(opts.morph, 'magSize'))
  const ln = morphLerp('magLength', resolveMorph(opts.morph, 'magLength'))

  if (partId === 'mag_powerbox') {
    // 넓은 동력 상자 + 한쪽에 빛나는 셀 3개
    const w = 0.095 * sz
    const h = 0.14 * ln
    const d = 0.075 * sz
    const boxGeo = new RoundedBoxGeometry(w, h, d, 3, 0.018)
    geos.push(boxGeo)
    const box = new THREE.Mesh(boxGeo, fixedMaterial(PLACEHOLDER))
    box.position.y = -h * 0.5
    primary.push(box)
    group.add(box)
    const cellGeo = new THREE.CapsuleGeometry(0.011 * sz, h * 0.42, 3, Math.max(6, seg - 2))
    geos.push(cellGeo)
    for (let i = 0; i < 3; i++) {
      const cell = new THREE.Mesh(cellGeo, glowMaterial(0x74f0c5))
      cell.position.set(w * 0.5 + 0.004, -h * 0.5, (i - 1) * d * 0.29)
      group.add(cell)
    }
    const neckGeo = new RoundedBoxGeometry(w * 0.45, 0.03, d * 0.55, 2, 0.008)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.y = -0.01
    secondary.push(neck)
    group.add(neck)
  } else if (partId === 'mag_sidepod') {
    // 오른쪽으로 비켜 달린 둥근 포드 + 연결 목
    const R = 0.055 * sz
    const podGeo = new THREE.SphereGeometry(R, seg, seg)
    geos.push(podGeo)
    const pod = new THREE.Mesh(podGeo, fixedMaterial(PLACEHOLDER))
    pod.scale.set(1.15, 1.25 * ln, 0.9)
    pod.position.set(R * 0.78, -R * 1.05, -0.025)
    primary.push(pod)
    group.add(pod)
    const neckGeo = new THREE.CapsuleGeometry(0.014 * sz, 0.06 * sz, 3, seg)
    neckGeo.rotateZ(Math.PI / 2)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.rotation.z = -0.45
    neck.position.set(R * 0.35, -0.025, -0.025)
    secondary.push(neck)
    group.add(neck)
    const ringGeo = new THREE.TorusGeometry(R * 0.62, R * 0.11, 7, seg)
    ringGeo.rotateY(Math.PI / 2)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.copy(pod.position)
    secondary.push(ring)
    group.add(ring)
  } else if (partId === 'mag_duo') {
    // 작은 알약 팩 두 개와 가운데 연결 다리
    const packGeo = new THREE.CapsuleGeometry(0.025 * sz, 0.085 * ln, 3, seg)
    geos.push(packGeo)
    for (const sx of [-1, 1]) {
      const pack = new THREE.Mesh(packGeo, fixedMaterial(PLACEHOLDER))
      pack.position.set(sx * 0.032 * sz, -0.058 * ln, 0)
      primary.push(pack)
      group.add(pack)
    }
    const bridgeGeo = new RoundedBoxGeometry(0.07 * sz, 0.025, 0.04 * sz, 2, 0.008)
    geos.push(bridgeGeo)
    const bridge = new THREE.Mesh(bridgeGeo, fixedMaterial(PLACEHOLDER))
    bridge.position.y = -0.01
    secondary.push(bridge)
    group.add(bridge)
  } else if (partId === 'mag_pocket') {
    // 아주 짧은 포켓 상자 + 주황 잔량 버튼
    const w = 0.05 * sz
    const h = 0.065 * ln
    const d = 0.055 * sz
    const packGeo = new RoundedBoxGeometry(w, h, d, 3, 0.014)
    geos.push(packGeo)
    const pack = new THREE.Mesh(packGeo, fixedMaterial(PLACEHOLDER))
    pack.position.y = -h * 0.48
    primary.push(pack)
    group.add(pack)
    const buttonGeo = new THREE.SphereGeometry(0.009 * sz, 8, 6)
    geos.push(buttonGeo)
    const button = new THREE.Mesh(buttonGeo, fixedMaterial(0xff8a2b))
    button.position.set(w * 0.5, -h * 0.48, -d * 0.2)
    group.add(button)
  } else if (partId === 'mag_rocket') {
    // 로켓 다트 — 몸통 아래 매달린 커다란 토이 로켓(축=Z, 앞으로 -Z). 둥근 몸체 + 주황 노즈 + 꼬리 지느러미.
    const R = 0.03 * sz * 1.3
    const len = 0.13 * ln
    const cy = -R - 0.02 // 몸통 아래로 매달림
    const cz = -0.03 * sz // 총구 쪽으로 살짝
    // 로켓 몸체 (둥근 캡슐 느낌 실린더)
    const bodyGeo = new THREE.CylinderGeometry(R, R * 0.9, len, seg)
    bodyGeo.rotateX(Math.PI / 2) // 축 = Z
    geos.push(bodyGeo)
    const rocket = new THREE.Mesh(bodyGeo, fixedMaterial(PLACEHOLDER))
    rocket.position.set(0, cy, cz)
    primary.push(rocket)
    group.add(rocket)
    // 노즈 콘 (앞 -Z, 고정 주황 = 토이 시그니처)
    const noseGeo = new THREE.ConeGeometry(R, R * 2.4, seg)
    noseGeo.rotateX(-Math.PI / 2)
    geos.push(noseGeo)
    const nose = new THREE.Mesh(noseGeo, fixedMaterial(0xff8a2b))
    nose.position.set(0, cy, cz - len / 2 - R * 1.2)
    group.add(nose)
    // 꼬리 지느러미 3개 (뒤쪽)
    const finGeo = new THREE.BoxGeometry(0.008, R * 1.6, R * 1.4)
    geos.push(finGeo)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(Math.sin(a) * R, cy + Math.cos(a) * R, cz + len / 2 - R * 0.7)
      fin.rotation.z = a
      secondary.push(fin)
      group.add(fin)
    }
    // 몸통에 잇는 짧은 목
    const neckGeo = new THREE.BoxGeometry(0.02 * sz, 0.03, 0.03 * sz)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.set(0, cy + R + 0.005, cz)
    secondary.push(neck)
    group.add(neck)
  } else if (partId === 'mag_revolver') {
    // 리볼버 실린더 — 배럴 방향(축=Z)으로 누운 통통한 회전 실린더. 앞면에 다트 6발이 링으로 보인다(토이 시그니처).
    // 통통하고 짧은 실린더(지름>길이) = 리볼버 실루엣. 몸통 밑에 바싹 붙여 매단다.
    const R = 0.058 * sz
    const cylLen = 0.05 * sz * (0.9 + 0.25 * ln)
    const cy = -0.022 // 몸통 밑면에 바싹(부유 방지, 살짝 파묻힘)
    const cz = -0.045 * sz // 총구 쪽으로 전진(리볼버 실린더 위치)
    const cylGeo = new THREE.CylinderGeometry(R, R, cylLen, seg)
    cylGeo.rotateX(Math.PI / 2) // 축 = Z (배럴 방향)
    geos.push(cylGeo)
    const cyl = new THREE.Mesh(cylGeo, fixedMaterial(PLACEHOLDER))
    cyl.position.set(0, cy, cz)
    primary.push(cyl)
    group.add(cyl)
    // 중심 축(요크 핀) — 고정색(비색칠)
    const axleGeo = new THREE.CylinderGeometry(R * 0.16, R * 0.16, cylLen * 1.25, seg)
    axleGeo.rotateX(Math.PI / 2)
    geos.push(axleGeo)
    const axle = new THREE.Mesh(axleGeo, fixedMaterial(0xd9dde3))
    axle.position.set(0, cy, cz)
    group.add(axle)
    // 챔버에 담긴 다트 6발 — 앞면(-Z)에서 뚜렷이 튀어나오는 링(고정 주황, 토이 시그니처)
    const dartLen = cylLen * 1.35
    const dartGeo = new THREE.CylinderGeometry(R * 0.17, R * 0.17, dartLen, Math.max(6, Math.floor(seg / 2)))
    dartGeo.rotateX(Math.PI / 2)
    geos.push(dartGeo)
    const chamberR = R * 0.62
    const dartZ = cz - cylLen * 0.35 // 앞끝이 실린더 앞면 밖으로 확실히 나오게
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2
      const dart = new THREE.Mesh(dartGeo, fixedMaterial(0xff8a2b)) // blasterOrange
      dart.position.set(Math.cos(a) * chamberR, cy + Math.sin(a) * chamberR, dartZ)
      group.add(dart)
    }
    // 톱 스트랩 — 실린더와 몸통을 잇는 얇은 연결(리볼버 프레임 느낌, 부유 방지)
    const strapGeo = new THREE.BoxGeometry(R * 0.5, 0.035, cylLen)
    geos.push(strapGeo)
    const strap = new THREE.Mesh(strapGeo, fixedMaterial(PLACEHOLDER))
    strap.position.set(0, cy + R + 0.004, cz)
    secondary.push(strap)
    group.add(strap)
  } else if (partId === 'mag_drum') {
    // 드럼통 — 옆으로 누운 꽉 찬 원반(축=X). 목으로 몸통에 연결.
    // 드럼은 총구 쪽(앞=-Z)으로 조금 당겨 실제 드럼탄창처럼 배럴 밑에 오게 한다.
    const R = 0.058 * sz * (0.85 + 0.3 * ln)
    const zFwd = -0.085 * sz // 앞으로 이동량 (총구 쪽으로 조금 더)
    const drumGeo = new THREE.CylinderGeometry(R, R, 0.05 * sz, seg)
    drumGeo.rotateZ(Math.PI / 2)
    geos.push(drumGeo)
    const drum = new THREE.Mesh(drumGeo, fixedMaterial(PLACEHOLDER))
    drum.position.set(0, -R - 0.012, zFwd)
    primary.push(drum)
    group.add(drum)
    const hubGeo = new THREE.CylinderGeometry(R * 0.3, R * 0.3, 0.056 * sz, seg)
    hubGeo.rotateZ(Math.PI / 2)
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(0xffd15c)) // 고정색(비색칠)
    hub.position.set(0, -R - 0.012, zFwd)
    group.add(hub)
    // 급탄 목 — 몸통(z≈0)과 앞으로 간 드럼을 잇도록 중앙 배치 + 길이 확장
    const neckGeo = new THREE.BoxGeometry(0.03 * sz, 0.028, 0.05 * sz + Math.abs(zFwd))
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.set(0, -0.012, zFwd * 0.5)
    secondary.push(neck)
    group.add(neck)
  } else {
    // 미니 클립·스프링 팩·젤리 탱크 — 아래로 매달린 상자 (살짝 앞으로 기움)
    const isMini = partId === 'mag_mini'
    const isJelly = partId === 'mag_jelly'
    const isSpring = partId === 'mag_spring'
    const w = (isJelly ? 0.075 : isMini ? 0.042 : 0.05) * sz
    const d = (isJelly ? 0.085 : isMini ? 0.052 : 0.07) * sz
    const h = (isJelly ? 0.115 : isMini ? 0.075 : 0.13) * ln
    const tilt = 0.12
    const caseGeo = new RoundedBoxGeometry(w, h, d, 2, 0.012)
    geos.push(caseGeo)
    const mag = new THREE.Mesh(caseGeo, fixedMaterial(PLACEHOLDER))
    mag.rotation.x = tilt
    mag.position.set(0, -h * 0.5, 0)
    primary.push(mag)
    group.add(mag)
    // 잔량이 보이는 옆창 — secondary
    const winGeo = new THREE.BoxGeometry(0.012, h * 0.7, d * 0.5)
    geos.push(winGeo)
    const win = new THREE.Mesh(winGeo, fixedMaterial(PLACEHOLDER))
    win.rotation.x = tilt
    win.position.set(w * 0.5, -h * 0.5, 0)
    secondary.push(win)
    group.add(win)
    // 창 안에 보이는 다트 캡슐 2개 — 고정색(비색칠)
    const dartGeo = new THREE.CapsuleGeometry(0.01 * sz, 0.02, 3, seg)
    geos.push(dartGeo)
    for (let i = 0; i < 2; i++) {
      const dart = new THREE.Mesh(dartGeo, fixedMaterial(0xff8a5c))
      dart.rotation.x = tilt
      dart.position.set(w * 0.5 + 0.002, -h * (0.3 + i * 0.3), 0)
      group.add(dart)
    }
    if (isSpring) {
      const coilGeo = new THREE.TorusGeometry(w * 0.58, 0.004 * sz, 6, seg)
      coilGeo.rotateY(Math.PI / 2)
      geos.push(coilGeo)
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(coilGeo, fixedMaterial(PLACEHOLDER))
        coil.position.set(0, -h * (0.27 + i * 0.23), 0)
        secondary.push(coil)
        group.add(coil)
      }
    } else if (isJelly) {
      const bubbleGeo = new THREE.SphereGeometry(0.014 * sz, 8, 6)
      geos.push(bubbleGeo)
      for (const z of [-d * 0.24, d * 0.24]) {
        const bubble = new THREE.Mesh(bubbleGeo, glowMaterial(0x74f0c5))
        bubble.position.set(-w * 0.28, -h * 0.58, z)
        group.add(bubble)
      }
    }
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 어깨끈 — 몸통 오른쪽 측면 앞·뒤 고리를 잇고 아래로 늘어짐 ────
function buildStrap(_partId: PartId, opts: BuildOpts): BuiltPart {
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

const FALLBACK_MAT = fixedMaterial(0x999999)

function buildFallback(): BuiltPart {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const mesh = new THREE.Mesh(geo, FALLBACK_MAT)
  group.add(mesh)
  return {
    group,
    zones: { primary: [mesh] },
    anchors: {},
    dispose: () => geo.dispose(),
  }
}

/** 단일 디스패처 (03 §7-2). 미등록 파츠 = 회색 박스 폴백(콘텐츠 테스트가 실패 처리). */
export function buildPart(partId: PartId, opts: BuildOpts): BuiltPart {
  if (partId.startsWith('body_')) return buildBody(partId, opts)
  if (partId.startsWith('barrel_')) return buildBarrel(partId, opts)
  if (partId.startsWith('sight_')) return buildSight(partId, opts)
  if (partId.startsWith('grip_')) return buildGrip(partId, opts)
  if (partId.startsWith('stock_')) return buildStock(partId, opts)
  if (partId.startsWith('muzzle_')) return buildMuzzle(partId, opts)
  if (partId.startsWith('mag_')) return buildMagazine(partId, opts)
  if (partId.startsWith('strap_')) return buildStrap(partId, opts)
  return buildFallback()
}

/** 극단 morph 포함 메시 수 (verify 게이트 §8-1). 앵커(Object3D)는 제외, Mesh 만. */
export function countMeshes(group: THREE.Object3D): number {
  let n = 0
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n += 1
  })
  return n
}
