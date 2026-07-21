// src/game/definitions.ts — 확장 축(슬롯·스테이션·발사체)의 단일 런타임 레지스트리.
// 타입과 UI/조립 정책을 같은 데이터에서 파생해 신규 항목 누락을 컴파일·테스트에서 잡는다.

export type AttachPolicy = 'root' | 'body' | 'barrel-end'

export const SLOT_DEFS = {
  body: { order: 0, idPrefix: 'body_', labelKo: '몸통', required: true, attachPolicy: 'root', morphArchetype: 'body', workshop: true, paintable: true, randomizable: true },
  barrel: { order: 1, idPrefix: 'barrel_', labelKo: '배럴', required: false, attachPolicy: 'body', morphArchetype: 'barrel', workshop: true, paintable: true, randomizable: true },
  magazine: { order: 2, idPrefix: 'mag_', labelKo: '다트 팩', required: false, attachPolicy: 'body', morphArchetype: 'magazine', workshop: true, paintable: true, randomizable: true },
  sight: { order: 3, idPrefix: 'sight_', labelKo: '조준기', required: false, attachPolicy: 'body', morphArchetype: 'sight', workshop: true, paintable: true, randomizable: true },
  stock: { order: 5, idPrefix: 'stock_', labelKo: '스톡', required: false, attachPolicy: 'body', morphArchetype: 'stock', workshop: true, paintable: true, randomizable: true },
  muzzle: { order: 7, idPrefix: 'muzzle_', labelKo: '총구', required: false, attachPolicy: 'barrel-end', morphArchetype: 'muzzle', workshop: true, paintable: true, randomizable: true },
  grip: { order: 4, idPrefix: 'grip_', labelKo: '그립', required: false, attachPolicy: 'body', morphArchetype: 'grip', workshop: true, paintable: true, randomizable: true },
  strap: { order: 6, idPrefix: 'strap_', labelKo: '어깨끈', required: false, attachPolicy: 'body', morphArchetype: null, workshop: true, paintable: true, randomizable: true },
} as const satisfies Record<string, {
  labelKo: string
  idPrefix: string
  order: number
  required: boolean
  attachPolicy: AttachPolicy
  morphArchetype: string | null
  workshop: boolean
  paintable: boolean
  randomizable: boolean
}>

export type SlotType = keyof typeof SLOT_DEFS
export type MorphArchetype = Exclude<(typeof SLOT_DEFS)[SlotType]['morphArchetype'], null>
export type DirectAttachSlot = {
  [K in SlotType]: (typeof SLOT_DEFS)[K]['attachPolicy'] extends 'body' ? K : never
}[SlotType]

function slotKeysWhere(predicate: (def: (typeof SLOT_DEFS)[SlotType]) => boolean): SlotType[] {
  return (Object.keys(SLOT_DEFS) as SlotType[])
    .filter((slot) => predicate(SLOT_DEFS[slot]))
    .sort((left, right) => SLOT_DEFS[left].order - SLOT_DEFS[right].order)
}

export const SLOT_ORDER = Object.freeze(
  (Object.keys(SLOT_DEFS) as SlotType[]).sort(
    (left, right) => SLOT_DEFS[left].order - SLOT_DEFS[right].order,
  ),
)
export const WORKSHOP_SLOTS = Object.freeze(slotKeysWhere((def) => def.workshop))
export const PAINTABLE_SLOTS = Object.freeze(slotKeysWhere((def) => def.paintable))
export const RANDOMIZABLE_SLOTS = Object.freeze(slotKeysWhere((def) => def.randomizable))
export const DIRECT_ATTACH_SLOTS = Object.freeze(
  slotKeysWhere((def) => def.attachPolicy === 'body') as DirectAttachSlot[],
)

export function isSlotType(value: string): value is SlotType {
  return Object.hasOwn(SLOT_DEFS, value)
}

export type StationMode = 'edit' | 'range'
export type StationPanel = 'workshop' | 'paint' | 'collection' | null
export type StationIcon = 'workshop' | 'paint' | 'range' | 'collection'

export const STATION_DEFS = {
  workshop: { labelKo: '만들기', mode: 'edit', panel: 'workshop', icon: 'workshop' },
  paint: { labelKo: '꾸미기', mode: 'edit', panel: 'paint', icon: 'paint' },
  range: { labelKo: '쏘기', mode: 'range', panel: null, icon: 'range' },
  collection: { labelKo: '보관함', mode: 'edit', panel: 'collection', icon: 'collection' },
} as const satisfies Record<string, { labelKo: string; mode: StationMode; panel: StationPanel; icon: StationIcon }>

export type StationId = keyof typeof STATION_DEFS
export const STATION_ORDER = Object.freeze(Object.keys(STATION_DEFS) as StationId[])

export const PROJECTILE_DEFS = {
  dart: { gravity: 4, baseRadius: 0.025, maxSpeed: 60, shape: 'dart', color: 0xffe14d, hitEffect: 'spark', audio: 'shoot' },
  gel: { gravity: 6, baseRadius: 0.035, maxSpeed: 54, shape: 'sphere', color: 0x2f7fe8, hitEffect: 'splash', audio: 'shoot' },
  paint: { gravity: 14, baseRadius: 0.045, maxSpeed: 42, shape: 'sphere', color: 0xff8a2b, hitEffect: 'splash', audio: 'shoot' },
} as const

export type ProjectileKind = keyof typeof PROJECTILE_DEFS
export const PROJECTILE_KINDS = Object.freeze(Object.keys(PROJECTILE_DEFS) as ProjectileKind[])
