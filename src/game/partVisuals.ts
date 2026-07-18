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
}

export interface BuiltPart {
  group: THREE.Group
  zones: Partial<Record<ZoneId, THREE.Mesh[]>>
  anchors: Partial<Record<SocketId, THREE.Object3D>>
  dispose(): void
}

const PLACEHOLDER = 0xcfd3da // 색칠 전 임시색 (recomposeBlaster 가 덮어씀)

interface BodyDims {
  w: number
  h: number
  d: number
  /** 셸 실루엣 — 몸통마다 형태 자체가 다르다 */
  shell: 'box' | 'capsule' | 'sphere'
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
}
const BARREL_DIMS: Record<string, BarrelDims> = {
  barrel_snap: { r: 0.035, l: 0.18 },
  barrel_rail: { r: 0.038, l: 0.4 },
  barrel_stub: { r: 0.05, l: 0.16 },
  barrel_spiral: { r: 0.04, l: 0.32 },
  barrel_wide: { r: 0.058, l: 0.22 },
  barrel_twin: { r: 0.03, l: 0.3 },
  barrel_needle: { r: 0.022, l: 0.44 },
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

  // 캐리핸들 (위) — secondary
  const handleGeo = new RoundedBoxGeometry(w * 0.5, h * 0.18, d * 0.42, 2, 0.02)
  geos.push(handleGeo)
  const handle = new THREE.Mesh(handleGeo, fixedMaterial(PLACEHOLDER))
  handle.position.set(0, h * 0.5 + h * 0.06, -d * 0.05)
  secondary.push(handle)
  group.add(handle)

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

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: {
      barrel: barrelAnchor,
      sight: sightAnchor,
      grip: gripAnchor,
      stock: stockAnchor,
      muzzle: muzzleAnchor,
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
  const count = barrelCountFromMorph(opts.morph)
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

  if (partId === 'sight_pin') {
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
  const gLen = morphLerp('gripLength', resolveMorph(opts.morph, 'gripLength'))
  const gThick = morphLerp('gripThick', resolveMorph(opts.morph, 'gripThick'))
  const gAng = morphLerp('gripAngle', resolveMorph(opts.morph, 'gripAngle'))
  const gr = (banana ? 0.026 : 0.024) * gThick

  const gripGeo = new THREE.CapsuleGeometry(gr, 0.09 * gLen, 3, seg)
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

  if (partId === 'stock_balloon') {
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

  if (partId === 'muzzle_booster') {
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
