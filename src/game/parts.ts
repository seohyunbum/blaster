// src/game/parts.ts — 파츠 카탈로그(정본 = 02 §3) + computeStats. 순수 데이터·함수 (leaf).
import type {
  Blaster,
  BlasterStats,
  BodyDef,
  PartDef,
  PartId,
  ProjectileKind,
  SlotType,
} from './types.ts'
import { morphStateDelta } from './morph.ts'

// ─── 몸통 4종 (M1 = 팝콘·불도그) ─────────────────────────────
export const BODIES: readonly BodyDef[] = [
  {
    id: 'body_popcorn',
    slot: 'body',
    nameKo: '팝콘 코어',
    desc: '동글동글 초경량 미니 프레임. 빠르지만 약해요',
    delta: {},
    base: { power: 2, fireRate: 6, accuracy: 4, weight: 2 },
    weightLimit: 6,
    sockets: ['barrel', 'sight', 'grip', 'magazine'],
  },
  {
    id: 'body_bulldog',
    slot: 'body',
    nameKo: '불도그 코어',
    desc: '뭐든 잘 어울리는 만능 중형 프레임',
    delta: {},
    base: { power: 4, fireRate: 4, accuracy: 5, weight: 4 },
    weightLimit: 9,
    sockets: ['barrel', 'sight', 'stock', 'muzzle', 'grip', 'magazine'],
  },
]

// ─── 부착 파츠 (M1 = 배럴 2 + 도트 사이트) ────────────────────
export const PARTS: readonly PartDef[] = [
  {
    id: 'barrel_snap',
    slot: 'barrel',
    nameKo: '숏 스냅',
    desc: '짧고 경쾌한 스냅 배럴. 속사의 친구',
    delta: { fireRate: 2, accuracy: -1, weight: 1 },
  },
  {
    id: 'barrel_rail',
    slot: 'barrel',
    nameKo: '롱 레일',
    desc: '길쭉한 정밀 레일. 과녁 명사수의 선택',
    delta: { power: 2, fireRate: -1, accuracy: 3, weight: 2 },
  },
  {
    id: 'sight_dot',
    slot: 'sight',
    nameKo: '도트 사이트',
    desc: '빨간 점이 반짝이는 도트',
    delta: { accuracy: 2, weight: 1 },
  },
]

// ─── 카탈로그 조회 ──────────────────────────────────────────
export const CATALOG: ReadonlyMap<PartId, PartDef> = new Map<PartId, PartDef>(
  [...BODIES, ...PARTS].map((p) => [p.id, p]),
)

export const BODY_MAP: ReadonlyMap<PartId, BodyDef> = new Map<PartId, BodyDef>(
  BODIES.map((b) => [b.id, b]),
)

/** M1 시작 세트 — 전 5종 즉시 사용(자유로운 창작 우선, 별 해금은 후속 마일스톤). */
export const STARTER_PART_IDS: readonly PartId[] = [
  'body_popcorn',
  'body_bulldog',
  'barrel_snap',
  'barrel_rail',
  'sight_dot',
]

export function partsForSlot(slot: SlotType): PartDef[] {
  if (slot === 'body') return [...BODIES]
  return PARTS.filter((p) => p.slot === slot)
}

export function bodyOf(blaster: Blaster): BodyDef | undefined {
  const inst = blaster.parts.body
  return inst ? BODY_MAP.get(inst.partId) : undefined
}

function clampStat(n: number): number {
  return n < 1 ? 1 : n > 10 ? 10 : n
}

/**
 * 조립 상태 → 최종 스탯. UI·사격장·09 프리뷰 전부 이 하나만 호출.
 * 몸통 base + Σ(파츠 delta) + Σ(morph 델타) 후 clamp. 맨몸(body 만) = 분기 없는 기본 경로.
 */
export function computeStats(blaster: Blaster): BlasterStats {
  const body = bodyOf(blaster)
  const base = body?.base ?? { power: 3, fireRate: 4, accuracy: 4, weight: 3 }

  let power = base.power
  let fireRate = base.fireRate
  let accuracy = base.accuracy
  let weight = base.weight
  let kind: ProjectileKind = 'dart'
  let capacity = 0
  let reloadSec = 0

  for (const slot of Object.keys(blaster.parts) as SlotType[]) {
    const inst = blaster.parts[slot]
    if (!inst) continue
    const def = slot === 'body' ? undefined : CATALOG.get(inst.partId)
    if (def) {
      power += def.delta.power ?? 0
      fireRate += def.delta.fireRate ?? 0
      accuracy += def.delta.accuracy ?? 0
      weight += def.delta.weight ?? 0
      if (slot === 'barrel' && def.kind) kind = def.kind
      if (slot === 'magazine') {
        capacity = def.capacity ?? capacity
        reloadSec = def.reloadSec ?? reloadSec
      }
    }
    // morph 델타 (인스턴스별)
    const md = morphStateDelta(inst.morph)
    power += md.power ?? 0
    fireRate += md.fireRate ?? 0
    accuracy += md.accuracy ?? 0
    weight += md.weight ?? 0
  }

  const weightLimit = body?.weightLimit ?? 8
  const overweight = weight > weightLimit
  const handlingRaw = 12 - weight - (overweight ? 2 : 0)
  const handling = handlingRaw < 1 ? 1 : handlingRaw > 10 ? 10 : handlingRaw

  return {
    power: clampStat(power),
    fireRate: clampStat(fireRate),
    accuracy: clampStat(accuracy),
    weight,
    powerRaw: round1(power),
    fireRateRaw: round1(fireRate),
    accuracyRaw: round1(accuracy),
    handling,
    capacity,
    reloadSec,
    overweight,
    weightLimit,
    kind,
  }
}

/** 유효성 — body 존재 + 소켓 존재 검사만 (호환표 없음). 반환 = 문제 메시지 배열. */
export function validateBlaster(blaster: Blaster): string[] {
  const problems: string[] = []
  const body = bodyOf(blaster)
  if (!body) {
    problems.push('몸통이 없어요')
    return problems
  }
  for (const slot of Object.keys(blaster.parts) as SlotType[]) {
    if (slot === 'body') continue
    if (!body.sockets.includes(slot)) {
      problems.push(`${body.nameKo} 에는 ${slot} 소켓이 없어요`)
    }
  }
  return problems
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
