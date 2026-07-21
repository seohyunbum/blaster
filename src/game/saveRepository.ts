// src/game/saveRepository.ts — 저장 매체와 시계를 주입받는 persistence 경계.
import type { SavedGame } from './saveModel.ts'
import { createDefaultSave, KEY_PREFIX } from './saveModel.ts'
import { normalizeSave } from './saveCodec.ts'

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface SaveClock { now(): number }

const PROFILE_ID = 'p1'
const SAVE_KEY = `${KEY_PREFIX}save_${PROFILE_ID}`
const BACKUP_KEY = `${KEY_PREFIX}backup_${PROFILE_ID}`
const RING = 5
const RING_KEYS = Array.from({ length: RING }, (_, index) => `${KEY_PREFIX}bak${index}_${PROFILE_ID}`)
const RING_PTR_KEY = `${KEY_PREFIX}bakptr_${PROFILE_ID}`

export class SaveRepository {
  private readonly storage: StoragePort | null
  private readonly clock: SaveClock

  constructor(
    storage: StoragePort | null,
    clock: SaveClock = { now: () => Date.now() },
  ) {
    this.storage = storage
    this.clock = clock
  }

  load(now = this.clock.now()): SavedGame {
    if (!this.storage) return createDefaultSave(now)
    const main = parseRecord(this.safeGet(SAVE_KEY))
    if (main) return normalizeSave(main, now)
    let best: SavedGame | null = null
    for (const key of [BACKUP_KEY, ...RING_KEYS]) {
      const parsed = parseRecord(this.safeGet(key))
      if (!parsed) continue
      const candidate = normalizeSave(parsed, now)
      if (!best || candidate.blasters.length > best.blasters.length) best = candidate
    }
    return best ?? createDefaultSave(now)
  }

  persist(save: SavedGame): boolean {
    if (!this.storage) return false
    try {
      const previous = this.safeGet(SAVE_KEY)
      if (previous) this.backup(previous)
      const payload: SavedGame = { ...save, updatedAt: this.clock.now() }
      this.storage.setItem(SAVE_KEY, JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  private backup(previous: string): void {
    if (!this.storage) return
    let pointer = parseInt(this.safeGet(RING_PTR_KEY) ?? '0', 10)
    if (!Number.isFinite(pointer) || pointer < 0 || pointer >= RING) pointer = 0
    try {
      this.storage.setItem(RING_KEYS[pointer]!, previous)
      this.storage.setItem(RING_PTR_KEY, String((pointer + 1) % RING))
      this.storage.setItem(BACKUP_KEY, previous)
    } catch {
      // 백업 실패는 메인 저장을 막지 않는다.
    }
  }

  private safeGet(key: string): string | null {
    try { return this.storage?.getItem(key) ?? null } catch { return null }
  }
}

export function browserStorage(): StoragePort | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function parseRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}
