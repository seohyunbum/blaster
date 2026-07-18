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

// ─── 몸통 (기본 파워 소폭 상향 반영) ─────────────────────────
export const BODIES: readonly BodyDef[] = [
  {
    id: 'body_popcorn',
    slot: 'body',
    nameKo: '팝콘 코어',
    desc: '동글동글 초경량 미니 프레임. 빠르고 가벼워요',
    delta: {},
    base: { power: 3, fireRate: 6, accuracy: 4, weight: 2 },
    weightLimit: 6,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_bulldog',
    slot: 'body',
    nameKo: '불도그 코어',
    desc: '뭐든 잘 어울리는 만능 중형 프레임',
    delta: {},
    base: { power: 5, fireRate: 4, accuracy: 5, weight: 4 },
    weightLimit: 9,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_titan',
    slot: 'body',
    nameKo: '타이탄 코어',
    desc: '묵직한 대형 프레임. 세게, 정확하게, 느리게',
    delta: {},
    base: { power: 7, fireRate: 2, accuracy: 6, weight: 6 },
    weightLimit: 12,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_jelly',
    slot: 'body',
    nameKo: '젤리 코어',
    desc: '말랑말랑 젤리 질감의 괴짜 프레임',
    delta: {},
    base: { power: 4, fireRate: 5, accuracy: 3, weight: 3 },
    weightLimit: 8,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_rocket',
    slot: 'body',
    nameKo: '로켓 코어',
    desc: '길쭉한 알약 모양. 쭉쭉 뻗는 느낌',
    delta: {},
    base: { power: 5, fireRate: 5, accuracy: 6, weight: 4 },
    weightLimit: 9,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_orb',
    slot: 'body',
    nameKo: '오브 코어',
    desc: '동그란 공 모양. 귀엽고 통통 튀어요',
    delta: {},
    base: { power: 4, fireRate: 7, accuracy: 3, weight: 3 },
    weightLimit: 7,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_wedge',
    slot: 'body',
    nameKo: '웨지 코어',
    desc: '납작하고 날렵한 프레임. 재빠르게',
    delta: {},
    base: { power: 4, fireRate: 7, accuracy: 5, weight: 3 },
    weightLimit: 7,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
  {
    id: 'body_chunk',
    slot: 'body',
    nameKo: '청크 코어',
    desc: '떡 벌어진 넓적 프레임. 든든해요',
    delta: {},
    base: { power: 6, fireRate: 3, accuracy: 5, weight: 5 },
    weightLimit: 11,
    sockets: ['barrel', 'sight', 'grip', 'stock', 'muzzle', 'magazine'],
  },
]

// ─── 부착 파츠 (배럴·조준기·그립·스톡·머즐) ──────────────────
export const PARTS: readonly PartDef[] = [
  // 배럴 5종
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
    id: 'barrel_stub',
    slot: 'barrel',
    nameKo: '뭉툭 포',
    desc: '짧고 두툼한 포신. 한 방이 묵직해요',
    delta: { power: 2, accuracy: -1, weight: 1 },
  },
  {
    id: 'barrel_spiral',
    slot: 'barrel',
    nameKo: '스파이럴 배럴',
    desc: '나선 홈이 파인 배럴. 똑바로 잘 날아가요',
    delta: { power: 1, accuracy: 2, weight: 2 },
  },
  {
    id: 'barrel_wide',
    slot: 'barrel',
    nameKo: '와이드 배럴',
    desc: '입구가 넓은 배럴. 큼직한 발사체가 나가요',
    delta: { power: 2, fireRate: -1, weight: 1 },
  },
  {
    id: 'barrel_twin',
    slot: 'barrel',
    nameKo: '트윈 튜브',
    desc: '나란한 두 줄 배럴. 폼이 살아요',
    delta: { power: 1, fireRate: 1, accuracy: -1, weight: 2 },
  },
  {
    id: 'barrel_needle',
    slot: 'barrel',
    nameKo: '니들 배럴',
    desc: '아주 가늘고 긴 배럴. 콕 집어 맞혀요',
    delta: { fireRate: -1, accuracy: 4, weight: 1 },
  },
  // 탄창(다트 팩) 4종 — 달면 그 용량만큼 발사·재장전. 안 달면 무한(선택제)
  {
    id: 'mag_mini',
    slot: 'magazine',
    nameKo: '미니 클립',
    desc: '6발. 눈 깜짝할 새 갈아끼우는 초경량 클립',
    delta: {},
    capacity: 6,
    reloadSec: 0.5,
  },
  {
    id: 'mag_spring',
    slot: 'magazine',
    nameKo: '스프링 팩',
    desc: '12발. 표준 스프링 장전식',
    delta: { weight: 1 },
    capacity: 12,
    reloadSec: 1.2,
  },
  {
    id: 'mag_drum',
    slot: 'magazine',
    nameKo: '드럼통',
    desc: '24발. 도넛 모양 대용량. 다 쏘면 긴 재장전',
    delta: { weight: 2 },
    capacity: 24,
    reloadSec: 2.5,
  },
  {
    id: 'mag_jelly',
    slot: 'magazine',
    nameKo: '젤리 탱크',
    desc: '30발. 젤리볼이 찰랑거리는 투명 수조',
    delta: { weight: 2 },
    capacity: 30,
    reloadSec: 3.2,
  },
  // 조준기 4종
  {
    id: 'sight_dot',
    slot: 'sight',
    nameKo: '도트 사이트',
    desc: '빨간 점이 반짝이는 도트',
    delta: { accuracy: 2, weight: 1 },
  },
  {
    id: 'sight_pin',
    slot: 'sight',
    nameKo: '가늠 핀',
    desc: '클래식한 가늠 핀',
    delta: { accuracy: 1 },
  },
  {
    id: 'sight_ring',
    slot: 'sight',
    nameKo: '링 사이트',
    desc: '동그란 고리로 겨누는 사이트',
    delta: { accuracy: 2 },
  },
  {
    id: 'sight_scope',
    slot: 'sight',
    nameKo: '경통 스코프',
    desc: '길쭉한 경통. 멀리 있는 과녁도 또렷해요',
    delta: { accuracy: 3, fireRate: -1, weight: 1 },
  },
  // 그립 3종
  {
    id: 'grip_mini',
    slot: 'grip',
    nameKo: '미니 그립',
    desc: '손에 착 감기는 앞손잡이',
    delta: { fireRate: 1 },
  },
  {
    id: 'grip_banana',
    slot: 'grip',
    nameKo: '바나나 그립',
    desc: '바나나 모양. 웃긴데 성능도 좋아요',
    delta: { fireRate: 1, accuracy: 1, weight: 1 },
  },
  {
    id: 'grip_chunky',
    slot: 'grip',
    nameKo: '통통 그립',
    desc: '두툼해서 꽉 잡히는 손잡이',
    delta: { accuracy: 1, weight: 1 },
  },
  {
    id: 'grip_minigun',
    slot: 'grip',
    nameKo: '미니건 손잡이',
    desc: '총 몸통 위에 얹는 커다란 스페이드 손잡이. 두 손으로 꽉!',
    delta: { accuracy: 1, weight: 1 },
  },
  // 스톡 4종
  {
    id: 'stock_pad',
    slot: 'stock',
    nameKo: '숄더 패드',
    desc: '폭신한 어깨 받침. 안정감 최고',
    delta: { accuracy: 1, weight: 1 },
  },
  {
    id: 'stock_spring',
    slot: 'stock',
    nameKo: '스프링 스톡',
    desc: '반동을 튕겨내는 스프링 스톡',
    delta: { fireRate: 1, weight: 1 },
  },
  {
    id: 'stock_balloon',
    slot: 'stock',
    nameKo: '풍선 스톡',
    desc: '풍선이라 가벼워요! 대신 흔들흔들',
    delta: { weight: -1, accuracy: -1 },
  },
  {
    id: 'stock_skeleton',
    slot: 'stock',
    nameKo: '뼈대 스톡',
    desc: '구멍 숭숭 뼈대 모양. 가볍고 멋져요',
    delta: { accuracy: 1 },
  },
  // 머즐 4종 (배럴 끝에 붙음)
  {
    id: 'muzzle_horn',
    slot: 'muzzle',
    nameKo: '나팔 팁',
    desc: '나팔 모양 총구 장식. 발사가 신나 보여요',
    delta: {},
  },
  {
    id: 'muzzle_booster',
    slot: 'muzzle',
    nameKo: '부스터 콘',
    desc: '로켓 노즐 모양 파워 부스터',
    delta: { power: 2, accuracy: -1, weight: 1 },
  },
  {
    id: 'muzzle_star',
    slot: 'muzzle',
    nameKo: '반짝이 팁',
    desc: '반짝반짝 별 모양 팁',
    delta: {},
  },
  {
    id: 'muzzle_ring',
    slot: 'muzzle',
    nameKo: '도넛 링',
    desc: '도넛처럼 동그란 총구 링',
    delta: { accuracy: 1 },
  },
]

// ─── 카탈로그 조회 ──────────────────────────────────────────
export const CATALOG: ReadonlyMap<PartId, PartDef> = new Map<PartId, PartDef>(
  [...BODIES, ...PARTS].map((p) => [p.id, p]),
)

export const BODY_MAP: ReadonlyMap<PartId, BodyDef> = new Map<PartId, BodyDef>(
  BODIES.map((b) => [b.id, b]),
)

/** M1 시작 세트 — 전 파츠 즉시 사용(자유로운 창작 우선, 별 해금은 후속 마일스톤). */
export const STARTER_PART_IDS: readonly PartId[] = [...BODIES, ...PARTS].map((p) => p.id)

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
  const base = body?.base ?? { power: 4, fireRate: 4, accuracy: 4, weight: 3 }

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
