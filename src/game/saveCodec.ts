// src/game/saveCodec.ts — JSON 정규화·마이그레이션·휴대용 파일 codec.
import type { Blaster, MorphState, PartInstance } from './types.ts'
import { isSlotType } from './definitions.ts'
import { STARTER_PART_IDS } from './parts.ts'
import { pruneMorph } from './morph.ts'
import { isPaletteKey, ZONE_FALLBACK } from './palette.ts'
import {
  SAVE_VERSION,
  createDefaultSave,
  createStarterBlaster,
  defaultPaint,
  makeId,
  type CourseRecord,
  type SavedGame,
} from './saveModel.ts'

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
      if (ni && isSlotType(slot)) parts[slot] = ni
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

function parseObj(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

// ─── 백업 파일 내보내기/불러오기 (사용자 소유 사본 — 코드 버그와 무관) ───
const EXPORT_TAG = 'blaster-lab-collection'

/** 보관함 전체를 파일용 JSON 문자열로. */
export function exportSaveText(save: SavedGame, now = Date.now()): string {
  return JSON.stringify({ tag: EXPORT_TAG, version: SAVE_VERSION, exportedAt: now, save }, null, 2)
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
  const blasters = [...current.blasters]
  const haveIds = new Set(blasters.map((b) => b.id))
  let added = 0
  for (const b of incoming.blasters) {
    if (haveIds.has(b.id)) continue // 중복 id 는 건너뜀(현재 것 우선 — 유실 0)
    blasters.push(b)
    haveIds.add(b.id)
    added += 1
  }
  const unlocked = new Set([...current.unlockedPartIds, ...incoming.unlockedPartIds])
  return {
    save: { ...current, blasters, unlockedPartIds: [...unlocked] },
    added,
  }
}

export class SaveCodec {
  normalize(raw: unknown, now: number): SavedGame { return normalizeSave(raw, now) }
  exportText(save: SavedGame, now = Date.now()): string { return exportSaveText(save, now) }
  importInto(current: SavedGame, text: string, now: number) { return importInto(current, text, now) }
}
