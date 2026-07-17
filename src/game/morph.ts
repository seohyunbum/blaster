// src/game/morph.ts — 자유 변형(파라메트릭 조형) 정본 데이터 + 순수 함수 (leaf).
// 저장·UI·undo 전부 t ∈ [0,1] 만 다룬다. t=0.5 = 기본형(변형 없음). 상세 정본 = docs/design/09_freeform.md
import type { MorphKey, MorphState, StatDelta } from './types.ts'

export type MorphArchetype = 'body' | 'barrel'

export interface MorphParamDef {
  key: MorphKey
  archetype: MorphArchetype
  labelKo: string
  minLabelKo: string
  maxLabelKo: string
  /** 지오메트리 lerp 범위 (배율 또는 형태계수). 빌더가 lerp(min,max,t) 로 실측 계산. */
  min: number
  max: number
  /** t=0(왼끝)·t=1(오른끝) 스탯 델타. piecewise 두-기울기로 t=0.5 에서 0. */
  deltaAt0: StatDelta
  deltaAt1: StatDelta
}

// 09 §2·§4 정본 표. 범위는 §7 봉투 검산을 통과하도록 사전 보정된 값.
export const MORPH_PARAMS: readonly MorphParamDef[] = [
  {
    key: 'bodyLength',
    archetype: 'body',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길쭉하게',
    min: 0.75,
    max: 1.25,
    deltaAt0: { fireRate: 0.5, accuracy: -1.0 },
    deltaAt1: { fireRate: -0.5, accuracy: 1.0 },
  },
  {
    key: 'bodyChub',
    archetype: 'body',
    labelKo: '통통함',
    minLabelKo: '홀쭉',
    maxLabelKo: '통통',
    min: 0.85,
    max: 1.35,
    deltaAt0: { power: -1.5, weight: -1.5 },
    deltaAt1: { power: 1.5, weight: 1.5, fireRate: -1.0 },
  },
  {
    key: 'bodyNose',
    archetype: 'body',
    labelKo: '코 모양',
    minLabelKo: '뭉툭',
    maxLabelKo: '쫑긋',
    min: 0,
    max: 1,
    deltaAt0: {},
    deltaAt1: {}, // 순수 멋 — 스탯 0
  },
  {
    key: 'barrelLength',
    archetype: 'barrel',
    labelKo: '길이',
    minLabelKo: '짧게',
    maxLabelKo: '길쭉하게',
    min: 0.7,
    max: 1.25,
    deltaAt0: { accuracy: -1.5, weight: -1.0 },
    deltaAt1: { accuracy: 1.5, weight: 1.0, fireRate: -0.5 },
  },
  {
    key: 'barrelBore',
    archetype: 'barrel',
    labelKo: '굵기',
    minLabelKo: '가늘게',
    maxLabelKo: '두툼하게',
    min: 0.9,
    max: 1.55,
    deltaAt0: { power: -1.0 },
    deltaAt1: { power: 1.0, accuracy: -0.5 },
  },
]

const PARAM_BY_KEY = new Map<MorphKey, MorphParamDef>(
  MORPH_PARAMS.map((p) => [p.key, p]),
)

export function morphParamsFor(archetype: MorphArchetype): MorphParamDef[] {
  return MORPH_PARAMS.filter((p) => p.archetype === archetype)
}

/** 없으면 0.5, NaN/범위 밖은 clamp. */
export function resolveMorph(state: MorphState, key: MorphKey): number {
  const v = state[key]
  if (v === undefined || Number.isNaN(v)) return 0.5
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** t → 실측 계수 (지오메트리 빌더용). */
export function morphLerp(key: MorphKey, t: number): number {
  const p = PARAM_BY_KEY.get(key)
  if (!p) return 1
  const tt = t < 0 ? 0 : t > 1 ? 1 : t
  return p.min + (p.max - p.min) * tt
}

/** piecewise 두-기울기 스탯 델타 (09 §4). t=0.5 → 전부 0. */
export function morphStatDelta(key: MorphKey, t: number): StatDelta {
  const p = PARAM_BY_KEY.get(key)
  if (!p) return {}
  const tt = t < 0 ? 0 : t > 1 ? 1 : t
  const out: Required<StatDelta> = { power: 0, fireRate: 0, accuracy: 0, weight: 0 }
  if (tt < 0.5) {
    const w = 1 - tt / 0.5 // t=0 → 1, t=0.5 → 0
    accumulate(out, p.deltaAt0, w)
  } else {
    const w = (tt - 0.5) / 0.5 // t=0.5 → 0, t=1 → 1
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

/** 저장 직전 정리 — 기본값(0.5) 키는 생략(희소 Record). */
export function pruneMorph(state: MorphState): MorphState {
  const out: MorphState = {}
  for (const p of MORPH_PARAMS) {
    const v = state[p.key]
    if (v !== undefined && !Number.isNaN(v) && Math.abs(v - 0.5) > 1e-6) {
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

// ─── 토이 프로포션 봉투 상수 (09 §7 — 매직넘버를 여기 모은다) ───
export const ENVELOPE = {
  bodyAspectMax: 4.2,
  barrelLoverRMax: 15,
  minCrossRadius: 0.028,
  roundPct: 0.25,
  totalLenMax: 1.1,
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
