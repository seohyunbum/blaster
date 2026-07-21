// src/game/save.ts — 하위 호환 facade. 구현 책임은 Model/Codec/Repository로 분리한다.
import type { SavedGame } from './saveModel.ts'
import { browserStorage, SaveRepository } from './saveRepository.ts'

export * from './saveModel.ts'
export * from './saveCodec.ts'
export * from './saveRepository.ts'

const browserRepository = new SaveRepository(browserStorage())

export function loadSave(now: number): SavedGame {
  return browserRepository.load(now)
}

export function persistSave(save: SavedGame): boolean {
  return browserRepository.persist(save)
}
