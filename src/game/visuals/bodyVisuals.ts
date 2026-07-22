import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MorphState, PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

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

export interface BodyShellMetrics {
  width: number
  height: number
  length: number
  crossRadius: number
  roundRatio: number
  shell: BodyDims['shell']
  boundsWidth: number
  boundsHeight: number
  boundsLength: number
}

/** 렌더러와 봉투 테스트가 함께 쓰는 몸통 실측 정본. */
export function bodyShellMetrics(partId: PartId, morph: MorphState): BodyShellMetrics {
  const dims = BODY_DIMS[partId] ?? BODY_DIMS.body_popcorn!
  const width = dims.w * morphLerp('bodyChub', resolveMorph(morph, 'bodyChub'))
  const height = dims.h * morphLerp('bodyChub', resolveMorph(morph, 'bodyChub'))
  const length = dims.d * morphLerp('bodyLength', resolveMorph(morph, 'bodyLength'))
  const roundFactor = morphLerp('bodyRound', resolveMorph(morph, 'bodyRound'))
  const crossRadius = Math.min(width, height) / 2
  const capsuleDiameter = crossRadius * 2
  return {
    width,
    height,
    length,
    crossRadius,
    roundRatio: dims.shell === 'box' ? Math.min(0.49, roundFactor) : 0.5,
    shell: dims.shell,
    boundsWidth: dims.shell === 'capsule' ? capsuleDiameter : width,
    boundsHeight: dims.shell === 'capsule' ? capsuleDiameter : height,
    boundsLength: length,
  }
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

export function buildBody(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BODY_DIMS[partId] ?? BODY_DIMS.body_popcorn!
  const noseT = resolveMorph(opts.morph, 'bodyNose')
  const metrics = bodyShellMetrics(partId, opts.morph)
  const w = metrics.width
  const h = metrics.height
  const d = metrics.length
  const halfZ = d / 2

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const boxSeg = segFor(opts.lod, 4, 2)
  const minSide = Math.min(w, h)
  const radius = metrics.roundRatio * minSide
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
