// src/game/morph.ts — 자유 변형(파라메트릭 조형) 정본 데이터 + 순수 함수 (leaf).
// 저장·UI·undo 전부 t ∈ [0,1]. 모양(shape) 파라미터는 기본 0.5(변형 없음),
// 장식(deco) 파라미터는 기본 0(없음). 상세 정본 = docs/design/09_freeform.md
import type { MorphKey, MorphState, StatDelta } from './types.ts'
import { SLOT_DEFS, type MorphArchetype, type SlotType } from './definitions.ts'

export type { MorphArchetype } from './definitions.ts'

/** 변형 가능한 파츠 원형 = 슬롯명과 동일 (전 슬롯이 주무를 수 있다). */
export type MorphGroup = 'shape' | 'deco'

/** 슬롯명 → 원형. 변형 불가 슬롯이면 null. */
export function archetypeForSlot(slot: SlotType): MorphArchetype | null {
  return SLOT_DEFS[slot].morphArchetype
}

export interface MorphParamDef {
  key: MorphKey
  archetype: MorphArchetype
  group: MorphGroup
  labelKo: string
  minLabelKo: string
  maxLabelKo: string
  /** 지오메트리 lerp 범위. 빌더가 lerp(min,max,t) 로 실측 계산. */
  min: number
  max: number
  /** 미지정 시 기본 t. shape=0.5(중립), deco=0(없음). */
  defaultT: number
  /** 정수 값 선택형(예: 총구 개수) — UI 중앙 스냅 없이 정수 스텝. */
  discrete?: boolean
  /** t=0·t=1 스탯 델타. piecewise 두-기울기로 t=0.5 에서 0. 장식은 전부 {} (순수 멋). */
  deltaAt0: StatDelta
  deltaAt1: StatDelta
}

export const MORPH_PARAMS: readonly MorphParamDef[] = [
  // ── 몸통 · 모양 ──
  {
    key: 'bodyLength',
    archetype: 'body',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길쭉하게',
    min: 0.75,
    max: 1.25,
    defaultT: 0.5,
    deltaAt0: { fireRate: 0.5, accuracy: -1.0 },
    deltaAt1: { fireRate: -0.5, accuracy: 1.0 },
  },
  {
    key: 'bodyChub',
    archetype: 'body',
    group: 'shape',
    labelKo: '통통함',
    minLabelKo: '홀쭉',
    maxLabelKo: '통통',
    min: 0.85,
    max: 1.35,
    defaultT: 0.5,
    deltaAt0: { power: -1.5, weight: -1.5 },
    deltaAt1: { power: 1.5, weight: 1.5, fireRate: -1.0 },
  },
  {
    key: 'bodyNose',
    archetype: 'body',
    group: 'shape',
    labelKo: '코 모양',
    minLabelKo: '뭉툭',
    maxLabelKo: '쫑긋',
    min: 0,
    max: 1,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  {
    key: 'bodyRound',
    archetype: 'body',
    group: 'shape',
    labelKo: '모서리',
    minLabelKo: '각지게',
    maxLabelKo: '둥글게',
    min: 0.08,
    max: 0.42, // 최소변 대비 라운드 반경 비율. t=0.5 → 0.25(기존 룩)
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 몸통 · 장식 (기본 없음) ──
  {
    key: 'bodyFin',
    archetype: 'body',
    group: 'deco',
    labelKo: '옆날개',
    minLabelKo: '없음',
    maxLabelKo: '큰 날개',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  {
    key: 'bodyCrest',
    archetype: 'body',
    group: 'deco',
    labelKo: '등지느러미',
    minLabelKo: '없음',
    maxLabelKo: '멋진 볏',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  {
    key: 'bodyAntenna',
    archetype: 'body',
    group: 'deco',
    labelKo: '안테나',
    minLabelKo: '없음',
    maxLabelKo: '긴 안테나',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  {
    key: 'bodyTail',
    archetype: 'body',
    group: 'deco',
    labelKo: '꼬리날개',
    minLabelKo: '없음',
    maxLabelKo: '큰 꼬리',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 배럴 · 모양 ──
  {
    key: 'barrelLength',
    archetype: 'barrel',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길쭉하게',
    min: 0.7,
    max: 1.25,
    defaultT: 0.5,
    deltaAt0: { accuracy: -1.5, weight: -1.0 },
    deltaAt1: { accuracy: 1.5, weight: 1.0, fireRate: -0.5 },
  },
  {
    key: 'barrelBore',
    archetype: 'barrel',
    group: 'shape',
    labelKo: '굵기',
    minLabelKo: '가늘게',
    maxLabelKo: '두툼하게',
    min: 0.9,
    max: 1.55,
    defaultT: 0.5,
    deltaAt0: { power: -1.0 },
    deltaAt1: { power: 1.0, accuracy: -0.5 },
  },
  {
    key: 'barrelTaper',
    archetype: 'barrel',
    group: 'shape',
    labelKo: '뿔 모양',
    minLabelKo: '앞이 넓게',
    maxLabelKo: '앞이 뾰족',
    min: 1.45,
    max: 0.55, // 앞끝 반경 배율. t=0.5 → 1.0(일자)
    defaultT: 0.5,
    deltaAt0: { power: 0.5, accuracy: -0.5 },
    deltaAt1: { accuracy: 0.5 },
  },
  {
    key: 'barrelCount',
    archetype: 'barrel',
    group: 'shape',
    labelKo: '총구 개수',
    minLabelKo: '1개',
    maxLabelKo: '미니건',
    min: 1,
    max: 6, // 총열 개수 — 쏠 때도 이 수만큼 발사(더블배럴·미니건)
    defaultT: 0, // 기본 1개
    discrete: true,
    deltaAt0: {},
    deltaAt1: {}, // 연사 보너스는 piecewise(중립 0.5) 로 못 낸다 → computeStats 가 총구 개수만큼 직접 가산
  },
  // ── 배럴 · 장식 (기본 없음) ──
  {
    key: 'barrelFlare',
    archetype: 'barrel',
    group: 'deco',
    labelKo: '나팔 끝',
    minLabelKo: '없음',
    maxLabelKo: '큰 나팔',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  {
    key: 'barrelRib',
    archetype: 'barrel',
    group: 'deco',
    labelKo: '마디 고리',
    minLabelKo: '없음',
    maxLabelKo: '많이',
    min: 0,
    max: 1,
    defaultT: 0,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 조준기 · 모양 ──
  {
    key: 'sightSize',
    archetype: 'sight',
    group: 'shape',
    labelKo: '크기',
    minLabelKo: '작게',
    maxLabelKo: '크게',
    min: 0.6,
    max: 1.7,
    defaultT: 0.5,
    deltaAt0: { accuracy: -0.5, weight: -0.5 },
    deltaAt1: { accuracy: 0.5, weight: 0.5 },
  },
  {
    key: 'sightHeight',
    archetype: 'sight',
    group: 'shape',
    labelKo: '높이',
    minLabelKo: '낮게',
    maxLabelKo: '높게',
    min: 0.4,
    max: 2.2,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 그립 · 모양 ──
  {
    key: 'gripLength',
    archetype: 'grip',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길게',
    min: 0.6,
    max: 1.6,
    defaultT: 0.5,
    deltaAt0: { fireRate: 0.5 },
    deltaAt1: { fireRate: -0.5, accuracy: 0.5 },
  },
  {
    key: 'gripThick',
    archetype: 'grip',
    group: 'shape',
    labelKo: '두께',
    minLabelKo: '가늘게',
    maxLabelKo: '두툼하게',
    min: 0.6,
    max: 1.8,
    defaultT: 0.5,
    deltaAt0: { weight: -0.5 },
    deltaAt1: { weight: 0.5 },
  },
  {
    key: 'gripAngle',
    archetype: 'grip',
    group: 'shape',
    labelKo: '기울기',
    minLabelKo: '꼿꼿',
    maxLabelKo: '비스듬',
    min: -0.1,
    max: 0.9,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 스톡 · 모양 ──
  {
    key: 'stockLength',
    archetype: 'stock',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길게',
    min: 0.5,
    max: 1.8,
    defaultT: 0.5,
    deltaAt0: { weight: -0.5, accuracy: -0.5 },
    deltaAt1: { weight: 0.5, accuracy: 0.5 },
  },
  {
    key: 'stockThick',
    archetype: 'stock',
    group: 'shape',
    labelKo: '두께',
    minLabelKo: '얇게',
    maxLabelKo: '두껍게',
    min: 0.6,
    max: 1.8,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 총구 · 모양 ──
  {
    key: 'muzzleSize',
    archetype: 'muzzle',
    group: 'shape',
    labelKo: '크기',
    minLabelKo: '작게',
    maxLabelKo: '크게',
    min: 0.6,
    max: 1.9,
    defaultT: 0.5,
    deltaAt0: { power: -0.5 },
    deltaAt1: { power: 0.5 },
  },
  {
    key: 'muzzleLength',
    archetype: 'muzzle',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길게',
    min: 0.5,
    max: 1.8,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
  // ── 탄창 · 모양 (용량·재장전은 파츠 고정, 여기선 겉모습만) ──
  {
    key: 'magSize',
    archetype: 'magazine',
    group: 'shape',
    labelKo: '크기',
    minLabelKo: '작게',
    maxLabelKo: '크게',
    min: 0.7,
    max: 1.6,
    defaultT: 0.5,
    deltaAt0: { weight: -0.5 },
    deltaAt1: { weight: 0.5 },
  },
  {
    key: 'magLength',
    archetype: 'magazine',
    group: 'shape',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길쭉하게',
    min: 0.6,
    max: 1.7,
    defaultT: 0.5,
    deltaAt0: {},
    deltaAt1: {},
  },
]

const PARAM_BY_KEY = new Map<MorphKey, MorphParamDef>(
  MORPH_PARAMS.map((p) => [p.key, p]),
)

export function morphParamsFor(archetype: MorphArchetype): MorphParamDef[] {
  return MORPH_PARAMS.filter((p) => p.archetype === archetype)
}

/** 미지정/NaN 이면 파라미터 기본 t(shape 0.5·deco 0), 범위 밖은 clamp. */
export function resolveMorph(state: MorphState, key: MorphKey): number {
  const v = state[key]
  if (v === undefined || Number.isNaN(v)) return PARAM_BY_KEY.get(key)?.defaultT ?? 0.5
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** t → 실측 계수 (지오메트리 빌더용). */
export function morphLerp(key: MorphKey, t: number): number {
  const p = PARAM_BY_KEY.get(key)
  if (!p) return 1
  const tt = t < 0 ? 0 : t > 1 ? 1 : t
  return p.min + (p.max - p.min) * tt
}

/** piecewise 두-기울기 스탯 델타 (09 §4). t=0.5 → 전부 0. 장식은 항상 0. */
export function morphStatDelta(key: MorphKey, t: number): StatDelta {
  const p = PARAM_BY_KEY.get(key)
  if (!p) return {}
  const tt = t < 0 ? 0 : t > 1 ? 1 : t
  const out: Required<StatDelta> = { power: 0, fireRate: 0, accuracy: 0, weight: 0 }
  if (tt < 0.5) {
    const w = 1 - tt / 0.5
    accumulate(out, p.deltaAt0, w)
  } else {
    const w = (tt - 0.5) / 0.5
    accumulate(out, p.deltaAt1, w)
  }
  return stripZero(out)
}

/** 인스턴스 morph 전체의 스탯 델타 합. */
export function morphStateDelta(state: MorphState): StatDelta {
  const out: Required<StatDelta> = { power: 0, fireRate: 0, accuracy: 0, weight: 0 }
  for (const p of MORPH_PARAMS) {
    const d = morphStatDelta(p.key, resolveMorph(state, p.key))
    accumulate(out, d, 1)
  }
  return stripZero(out)
}

/** 저장 직전 정리 — 기본값과 같은 키는 생략(희소 Record). */
export function pruneMorph(state: MorphState): MorphState {
  const out: MorphState = {}
  for (const p of MORPH_PARAMS) {
    const v = state[p.key]
    if (v !== undefined && !Number.isNaN(v) && Math.abs(v - p.defaultT) > 1e-6) {
      out[p.key] = v < 0 ? 0 : v > 1 ? 1 : v
    }
  }
  return out
}

/** 배럴 굵기 morph → 발사체 크기 기여 (09 §2.2, lerp(0.9,1.3,t)). */
export function boreScaleFromMorph(state: MorphState): number {
  const t = resolveMorph(state, 'barrelBore')
  return 0.9 + (1.3 - 0.9) * t
}

/** 총구(총열) 개수 1~6 — 더블배럴·미니건. 발사도 이 수만큼. */
export function barrelCountFromMorph(state: MorphState): number {
  const n = Math.round(morphLerp('barrelCount', resolveMorph(state, 'barrelCount')))
  return n < 1 ? 1 : n > 6 ? 6 : n
}

/** count 개 총열의 (x,y) 배치 — 1:중앙, 2:나란히, 3+:링 클러스터(미니건). */
export function barrelLayout(count: number, r: number): [number, number][] {
  if (count <= 1) return [[0, 0]]
  if (count === 2) {
    const s = r * 1.15
    return [
      [-s, 0],
      [s, 0],
    ]
  }
  const rr = r * 2.2
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    out.push([Math.cos(a) * rr, Math.sin(a) * rr])
  }
  return out
}

// ─── 토이 프로포션 봉투 상수 (09 §7) ───
export const ENVELOPE = {
  // 76종 로스터의 현재 최대치를 감싸는 회귀 방지 ratchet (09 §7).
  bodyAspectMax: 6,
  barrelLoverRMax: 28,
  minCrossRadius: 0.019,
  barrelFrontRadiusMin: 0.012,
  roundPctMin: 0.08,
  roundPctDefault: 0.25,
  totalLenMax: 1.3,
} as const

function accumulate(out: Required<StatDelta>, d: StatDelta, w: number): void {
  out.power += (d.power ?? 0) * w
  out.fireRate += (d.fireRate ?? 0) * w
  out.accuracy += (d.accuracy ?? 0) * w
  out.weight += (d.weight ?? 0) * w
}

function stripZero(d: Required<StatDelta>): StatDelta {
  const out: StatDelta = {}
  if (d.power) out.power = round2(d.power)
  if (d.fireRate) out.fireRate = round2(d.fireRate)
  if (d.accuracy) out.accuracy = round2(d.accuracy)
  if (d.weight) out.weight = round2(d.weight)
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
