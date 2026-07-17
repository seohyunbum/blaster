// src/game/save.ts — 세이브 루트(정본 05) + localStorage 운영. 순수 정규화 함수는 테스트 대상.
import type { Blaster, MorphState, PartInstance, SlotType } from './types.ts'
import { STARTER_PART_IDS } from './parts.ts'
import { pruneMorph } from './morph.ts'
import { isPaletteKey, ZONE_FALLBACK } from './palette.ts'

export const SAVE_VERSION = 1
export const KEY_PREFIX = 'blaster_lab_'
const PROFILE_ID = 'p1' // M1 단일 프로필 (닉네임 프로필은 M2)
const SAVE_KEY = `${KEY_PREFIX}save_${PROFILE_ID}`
const BACKUP_KEY = `${KEY_PREFIX}backup_${PROFILE_ID}`

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

let idCounter = 0
export function makeId(prefix = 'b'): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID().slice(0, 8)}`
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter}`
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
export function createStarterBlaster(now: number): Blaster {
  return {
    id: makeId(),
    name: '블래스터 1',
    createdAt: now,
    parts: {
      body: makeInstance('body_popcorn'),
      barrel: makeInstance('barrel_snap'),
      sight: makeInstance('sight_dot'),
    },
  }
}

export function createDefaultSave(now: number): SavedGame {
  const starter = createStarterBlaster(now)
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

// ─── 정규화(마이그레이션) — 무소음 복구, 순수 함수 ───────────
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function normalizeMorph(raw: unknown): MorphState {
  if (!raw || typeof raw !== 'object') return {}
  const out: MorphState = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      // 모르는 MorphKey 도 일단 담고, pruneMorph 가 유효 키만 남긴다.
      out[k as keyof MorphState] = v < 0 ? 0 : v > 1 ? 1 : v
    }
  }
  return pruneMorph(out)
}

function normalizeInstance(raw: unknown): PartInstance | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.partId !== 'string') return null
  const paint = defaultPaint()
  if (r.paint && typeof r.paint === 'object') {
    for (const zone of ['primary', 'secondary', 'accent'] as const) {
      const zp = (r.paint as Record<string, unknown>)[zone]
      if (zp && typeof zp === 'object') {
        const c = (zp as Record<string, unknown>).color
        const f = (zp as Record<string, unknown>).finish
        // 삭제·개명된 PaletteKey 는 존 폴백으로 무소음 대체 (08 §1.2 폴백 규칙).
        paint[zone] = {
          color: typeof c === 'string' && isPaletteKey(c) ? c : ZONE_FALLBACK[zone],
          finish: f === 'matte' || f === 'gloss' || f === 'metal' ? f : 'gloss',
        }
      }
    }
  }
  return { partId: r.partId, paint, morph: normalizeMorph(r.morph) }
}

function normalizeBlaster(raw: unknown, now: number): Blaster | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const parts: Blaster['parts'] = {}
  if (r.parts && typeof r.parts === 'object') {
    for (const [slot, inst] of Object.entries(r.parts as Record<string, unknown>)) {
      const ni = normalizeInstance(inst)
      if (ni) parts[slot as SlotType] = ni
    }
  }
  if (!parts.body) return null // body 필수 (결정문 16)
  return {
    id: typeof r.id === 'string' ? r.id : makeId(),
    name: typeof r.name === 'string' ? r.name : '블래스터',
    createdAt: num(r.createdAt, now),
    parts,
  }
}

/** 어떤 raw 입력이든 유효한 SavedGame 으로 복구. 손상 시 기본 세이브. */
export function normalizeSave(raw: unknown, now: number): SavedGame {
  if (!raw || typeof raw !== 'object') return createDefaultSave(now)
  const r = raw as Record<string, unknown>
  const blasters: Blaster[] = []
  if (Array.isArray(r.blasters)) {
    for (const b of r.blasters) {
      const nb = normalizeBlaster(b, now)
      if (nb) blasters.push(nb)
    }
  }
  if (blasters.length === 0) blasters.push(createStarterBlaster(now))

  const unlocked = new Set<string>(STARTER_PART_IDS)
  if (Array.isArray(r.unlockedPartIds)) {
    for (const id of r.unlockedPartIds) if (typeof id === 'string') unlocked.add(id)
  }

  const active =
    typeof r.activeBlasterId === 'string' &&
    blasters.some((b) => b.id === r.activeBlasterId)
      ? r.activeBlasterId
      : (blasters[0]?.id ?? null)

  const courseRecords: Record<string, CourseRecord> = {}
  if (r.courseRecords && typeof r.courseRecords === 'object') {
    for (const [cid, rec] of Object.entries(r.courseRecords as Record<string, unknown>)) {
      if (rec && typeof rec === 'object') {
        const rr = rec as Record<string, unknown>
        const stars = num(rr.stars, 0)
        courseRecords[cid] = {
          stars: (stars < 0 ? 0 : stars > 3 ? 3 : Math.round(stars)) as 0 | 1 | 2 | 3,
          bestScore: num(rr.bestScore, 0),
          bestBlasterId:
            typeof rr.bestBlasterId === 'string' ? rr.bestBlasterId : null,
        }
      }
    }
  }

  return {
    version: SAVE_VERSION,
    coins: 0,
    unlockedPartIds: [...unlocked],
    unlockedCosmeticIds: Array.isArray(r.unlockedCosmeticIds)
      ? (r.unlockedCosmeticIds.filter((x) => typeof x === 'string') as string[])
      : [],
    blasters,
    activeBlasterId: active,
    blasterBestScores:
      r.blasterBestScores && typeof r.blasterBestScores === 'object'
        ? (r.blasterBestScores as Record<string, Record<string, number>>)
        : {},
    achievements: Array.isArray(r.achievements)
      ? (r.achievements.filter((x) => typeof x === 'string') as string[])
      : [],
    courseRecords,
    tutorialDone: r.tutorialDone === true,
    updatedAt: now,
  }
}

// ─── localStorage I/O (브라우저 전용, 무소음 복구) ────────────
function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function loadSave(now: number): SavedGame {
  if (!hasStorage()) return createDefaultSave(now)
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) return normalizeSave(JSON.parse(raw), now)
  } catch {
    // 파손 — 백업 시도
    try {
      const bak = localStorage.getItem(BACKUP_KEY)
      if (bak) return normalizeSave(JSON.parse(bak), now)
    } catch {
      /* 무시 */
    }
  }
  return createDefaultSave(now)
}

/** 성공 직전 값을 백업 키에 남기고 저장. 실패해도 throw 하지 않는다. */
export function persistSave(save: SavedGame): boolean {
  if (!hasStorage()) return false
  try {
    const prev = localStorage.getItem(SAVE_KEY)
    if (prev) localStorage.setItem(BACKUP_KEY, prev)
    save.updatedAt = Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}
