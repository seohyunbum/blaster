// src/game/types.ts — 공용 타입 단일 소스 (leaf, main.ts import 금지).
// 값은 담지 않는다(순수 타입) — verbatimModuleSyntax 하에서 전부 erase 된다.
import type { PaletteKey } from './palette.ts'

// ─── 슬롯·파츠 ──────────────────────────────────────────────
export type SlotType =
  | 'body'
  | 'barrel'
  | 'magazine'
  | 'sight'
  | 'stock'
  | 'muzzle'
  | 'grip'
  | 'strap'
  | 'special'

export type SocketId = SlotType // 결정문 2 — 소켓 문자열 = 슬롯명
export type ProjectileKind = 'dart' | 'gel' | 'paint' // 00_DECISIONS R1 (foam 폐기)
export type PartId = string // id 규약: body_*, barrel_* … (03 정본)

export interface StatDelta {
  power?: number
  fireRate?: number
  accuracy?: number
  weight?: number
}

export interface CoreStats {
  power: number
  fireRate: number
  accuracy: number
  weight: number
}

export interface PartDef {
  id: PartId
  slot: SlotType
  nameKo: string
  desc: string
  delta: StatDelta
  kind?: ProjectileKind // barrel 이 지정하면 최우선
  capacity?: number // magazine 전용 — M2
  reloadSec?: number // magazine 전용 — M2
}

export interface BodyDef extends PartDef {
  slot: 'body'
  base: CoreStats
  sockets: readonly SocketId[]
  weightLimit: number
}

// ─── 색칠 ──────────────────────────────────────────────────
export type ZoneId = 'primary' | 'secondary' | 'accent'
export type Finish = 'matte' | 'gloss' | 'metal'

export interface ZonePaint {
  color: PaletteKey
  finish: Finish
}

export type PartPaint = Partial<Record<ZoneId, ZonePaint>>

// ─── 자유 변형(morph) ───────────────────────────────────────
export type MorphKey =
  // 몸통 모양
  | 'bodyLength'
  | 'bodyChub'
  | 'bodyNose'
  | 'bodyRound'
  // 몸통 장식
  | 'bodyFin'
  | 'bodyCrest'
  | 'bodyAntenna'
  | 'bodyTail'
  // 배럴 모양
  | 'barrelLength'
  | 'barrelBore'
  | 'barrelTaper'
  | 'barrelCount'
  // 배럴 장식
  | 'barrelFlare'
  | 'barrelRib'
  // 조준기
  | 'sightSize'
  | 'sightHeight'
  // 그립
  | 'gripLength'
  | 'gripThick'
  | 'gripAngle'
  // 스톡
  | 'stockLength'
  | 'stockThick'
  // 총구
  | 'muzzleSize'
  | 'muzzleLength'
  // 탄창
  | 'magSize'
  | 'magLength'

/** 저장 단위 — 0..1 정규값. 키 없음 = 0.5(기본형). 희소 Record (09 §6). */
export type MorphState = Partial<Record<MorphKey, number>>

// ─── 조립 데이터 (단일 타입 Blaster — 결정문 12) ─────────────
export interface PartInstance {
  partId: PartId
  paint: PartPaint
  morph: MorphState
}

export interface Blaster {
  id: string
  name: string
  createdAt: number
  parts: Partial<Record<SlotType, PartInstance>>
}

export interface BlasterStats extends CoreStats {
  powerRaw: number // clamp 전 원값 — MAX 배지·별 팝업용
  fireRateRaw: number
  accuracyRaw: number
  handling: number
  capacity: number
  reloadSec: number
  overweight: boolean
  weightLimit: number
  kind: ProjectileKind
}

// ─── 발사 (04 정본) ─────────────────────────────────────────
export interface ShotProfile {
  kind: ProjectileKind
  muzzleVelocity: number // 20~60 m/s
  spreadDeg: number // 0.3~4.0
  fireIntervalMs: number // 150~600
  projectileScale: number
  recoilKickDeg: number
}
