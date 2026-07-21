// src/game/types.ts — 공용 타입 단일 소스 (leaf, main.ts import 금지).
// 값은 담지 않는다(순수 타입) — verbatimModuleSyntax 하에서 전부 erase 된다.
import type { PaletteKey } from './palette.ts'
import type { ProjectileKind, SlotType } from './definitions.ts'

export type { ProjectileKind, SlotType } from './definitions.ts'

// ─── 슬롯·파츠 ──────────────────────────────────────────────
export type SocketId = Exclude<SlotType, 'body'> // 몸통에 선언 가능한 부착 소켓
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

export interface PartCapabilities {
  mount?: 'gripTop'
  viewmodelFit?: 'oversize' | 'compact'
  hidesBodyCarryHandle?: boolean
}

export interface PartBase<S extends SlotType> {
  id: PartId
  slot: S
  nameKo: string
  desc: string
  delta: StatDelta
  capabilities?: PartCapabilities
}

export interface BodyDef extends PartBase<'body'> {
  base: CoreStats
  sockets: readonly SocketId[]
  weightLimit: number
}

export interface BarrelDef extends PartBase<'barrel'> {
  kind?: ProjectileKind
}

export interface MagazineDef extends PartBase<'magazine'> {
  capacity: number
  reloadSec: number
}

export type AccessorySlot = Exclude<SlotType, 'body' | 'barrel' | 'magazine'>
export interface AccessoryDef extends PartBase<AccessorySlot> {}

export type PartDef = BarrelDef | MagazineDef | AccessoryDef
export type CatalogPartDef = BodyDef | PartDef

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
