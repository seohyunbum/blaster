// src/game/save.ts — 세이브 루트(정본 05) + localStorage 운영. 순수 정규화 함수는 테스트 대상.
import type { Blaster, MorphState, PartInstance, SlotType } from './types.ts'
import { STARTER_PART_IDS } from './parts.ts'
import { pruneMorph } from './morph.ts'
import { isPaletteKey, ZONE_FALLBACK } from './palette.ts'

export const SAVE_VERSION = 1
export const KEY_PREFIX = 'blaster_lab_'
const PROFILE_ID = 'p1' // M1 단일 프로필 (닉네임 프로필은 M2)
const SAVE_KEY = `${KEY_PREFIX}save_${PROFILE_ID}`
const BACKUP_KEY = `${KEY_PREFIX}backup_${PROFILE_ID}` // 레거시 단일 백업
const RING = 5 // 롤링 백업 개수 — 최근 N개 저장본 보관(손상 복구용)
const RING_KEYS = Array.from({ length: RING }, (_, i) => `${KEY_PREFIX}bak${i}_${PROFILE_ID}`)
const RING_PTR_KEY = `${KEY_PREFIX}bakptr_${PROFILE_ID}`

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
export function createStarterBlaster(now: number, name = '블래스터 1'): Blaster {
  return {
    id: makeId(),
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
export function cloneBlaster(src: Blaster, now: number, name?: string): Blaster {
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
  return { id: makeId(), name: name ?? `${src.name} 복사`, createdAt: now, parts }
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

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

function parseObj(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function loadSave(now: number): SavedGame {
  if (!hasStorage()) return createDefaultSave(now)
  // 정상 경로: 메인 세이브가 읽히면 그걸 쓴다(삭제 등 사용자 의도 존중)
  const main = parseObj(safeGet(SAVE_KEY))
  if (main) return normalizeSave(main, now)
  // 메인 손상/부재 → 백업들 중 "블래스터가 가장 많은" 것으로 복구 (유실 최소화)
  let best: SavedGame | null = null
  for (const k of [BACKUP_KEY, ...RING_KEYS]) {
    const p = parseObj(safeGet(k))
    if (!p) continue
    const s = normalizeSave(p, now)
    if (!best || s.blasters.length > best.blasters.length) best = s
  }
  return best ?? createDefaultSave(now)
}

/** 저장 — 이전 값을 롤링 백업(최근 5개)+레거시 백업에 남긴 뒤 메인 갱신. 실패해도 throw 안 함. */
export function persistSave(save: SavedGame): boolean {
  if (!hasStorage()) return false
  try {
    const prev = safeGet(SAVE_KEY)
    if (prev) {
      // 이전 저장본을 롤링 백업 링에 기록(라운드로빈)
      let ptr = parseInt(safeGet(RING_PTR_KEY) ?? '0', 10)
      if (!Number.isFinite(ptr) || ptr < 0 || ptr >= RING) ptr = 0
      try {
        localStorage.setItem(RING_KEYS[ptr]!, prev)
        localStorage.setItem(RING_PTR_KEY, String((ptr + 1) % RING))
        localStorage.setItem(BACKUP_KEY, prev)
      } catch {
        /* 백업 실패는 메인 저장을 막지 않는다 */
      }
    }
    save.updatedAt = Date.now()
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    return true
  } catch {
    return false
  }
}

// ─── 백업 파일 내보내기/불러오기 (사용자 소유 사본 — 코드 버그와 무관) ───
const EXPORT_TAG = 'blaster-lab-collection'

/** 보관함 전체를 파일용 JSON 문자열로. */
export function exportSaveText(save: SavedGame): string {
  return JSON.stringify({ tag: EXPORT_TAG, version: SAVE_VERSION, exportedAt: Date.now(), save }, null, 2)
}

/**
 * 백업 파일을 현재 세이브에 병합(기본) — 이미 있는 id 는 건너뛰어 아무것도 잃지 않는다.
 * 반환: { save: 병합본, added: 새로 들어온 개수 } · 형식 불명이면 null.
 */
export function importInto(current: SavedGame, text: string, now: number): { save: SavedGame; added: number } | null {
  const parsed = parseObj(text)
  if (!parsed) return null
  // 내보낸 래퍼({tag,save}) 또는 세이브 자체 또는 blasters 배열만 있어도 수용
  const rawSave =
    parsed.save && typeof parsed.save === 'object'
      ? parsed.save
      : Array.isArray(parsed.blasters)
        ? parsed
        : null
  if (!rawSave) return null
  const incoming = normalizeSave(rawSave, now)
  const haveIds = new Set(current.blasters.map((b) => b.id))
  let added = 0
  for (const b of incoming.blasters) {
    if (haveIds.has(b.id)) continue // 중복 id 는 건너뜀(현재 것 우선 — 유실 0)
    current.blasters.push(b)
    haveIds.add(b.id)
    added += 1
  }
  const unlocked = new Set([...current.unlockedPartIds, ...incoming.unlockedPartIds])
  current.unlockedPartIds = [...unlocked]
  return { save: current, added }
}
