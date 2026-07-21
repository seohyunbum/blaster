// src/game/saveModel.ts — 저장 가능한 도메인 모델과 생성 팩토리.
import type { Blaster, MorphState, PartInstance } from './types.ts'
import { STARTER_PART_IDS } from './parts.ts'
import { pruneMorph } from './morph.ts'

export const SAVE_VERSION = 1
export const KEY_PREFIX = 'blaster_lab_'

export interface CourseRecord {
  stars: 0 | 1 | 2 | 3
  bestScore: number
  bestBlasterId: string | null
}

export interface SavedGame {
  version: number
  coins: number // M1 항상 0
  unlockedPartIds: string[]
  unlockedCosmeticIds: string[]
  blasters: Blaster[]
  activeBlasterId: string | null
  blasterBestScores: Record<string, Record<string, number>>
  achievements: string[]
  courseRecords: Record<string, CourseRecord>
  tutorialDone: boolean
  updatedAt: number
}

export interface IdSource {
  makeId(prefix: string): string
}

let idCounter = 0
export const systemIdSource: IdSource = {
  makeId(prefix: string): string {
    const g = globalThis as { crypto?: { randomUUID?: () => string } }
    if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID().slice(0, 8)}`
    idCounter += 1
    return `${prefix}_${Date.now().toString(36)}${idCounter}`
  },
}

export function makeId(prefix = 'b', ids: IdSource = systemIdSource): string {
  return ids.makeId(prefix)
}

export function defaultPaint(): PartInstance['paint'] {
  return {
    primary: { color: 'blasterBlue', finish: 'gloss' },
    secondary: { color: 'toyGrayLight', finish: 'matte' },
    accent: { color: 'blasterOrange', finish: 'gloss' },
  }
}

export function makeInstance(partId: string, morph: MorphState = {}): PartInstance {
  return { partId, paint: defaultPaint(), morph: pruneMorph(morph) }
}

/** 첫 실행 기본 블래스터 — 팝콘 코어 + 숏 스냅 + 도트. */
export function createStarterBlaster(
  now: number,
  name = '블래스터 1',
  ids: IdSource = systemIdSource,
): Blaster {
  return {
    id: makeId('b', ids),
    name,
    createdAt: now,
    parts: {
      body: makeInstance('body_popcorn'),
      barrel: makeInstance('barrel_snap'),
      sight: makeInstance('sight_dot'),
    },
  }
}

/** 블래스터 깊은 복사 (새 id·이름). 보관함 "복제" 용. */
export function cloneBlaster(
  src: Blaster,
  now: number,
  name?: string,
  ids: IdSource = systemIdSource,
): Blaster {
  const parts: Blaster['parts'] = {}
  for (const slot of Object.keys(src.parts) as (keyof Blaster['parts'])[]) {
    const inst = src.parts[slot]
    if (!inst) continue
    const paint: PartInstance['paint'] = {}
    for (const zone of ['primary', 'secondary', 'accent'] as const) {
      const zp = inst.paint[zone]
      if (zp) paint[zone] = { color: zp.color, finish: zp.finish }
    }
    parts[slot] = { partId: inst.partId, paint, morph: { ...inst.morph } }
  }
  return { id: makeId('b', ids), name: name ?? `${src.name} 복사`, createdAt: now, parts }
}

export function createDefaultSave(now: number, ids: IdSource = systemIdSource): SavedGame {
  const starter = createStarterBlaster(now, '블래스터 1', ids)
  return {
    version: SAVE_VERSION,
    coins: 0,
    unlockedPartIds: [...STARTER_PART_IDS],
    unlockedCosmeticIds: [],
    blasters: [starter],
    activeBlasterId: starter.id,
    blasterBestScores: {},
    achievements: [],
    courseRecords: {},
    tutorialDone: false,
    updatedAt: now,
  }
}
