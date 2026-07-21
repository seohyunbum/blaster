import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SaveRepository,
  createDefaultSave,
  exportSaveText,
  importInto,
  normalizeSave,
  type StoragePort,
} from '../src/game/save.ts'

class MemoryStorage implements StoragePort {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

test('SaveRepository는 storage·clock을 주입받고 입력 save를 mutate하지 않는다', () => {
  const storage = new MemoryStorage()
  const repository = new SaveRepository(storage, { now: () => 999 })
  const save = createDefaultSave(1)
  const before = save.updatedAt
  assert.equal(repository.persist(save), true)
  assert.equal(save.updatedAt, before)
  assert.equal(repository.load(2).updatedAt, 2)
  assert.equal(repository.load(2).blasters.length, 1)
})

test('importInto는 현재 세이브를 mutate하지 않고 새 병합본을 반환한다', () => {
  const current = createDefaultSave(1)
  const incoming = createDefaultSave(2)
  incoming.blasters[0]!.id = 'incoming'
  const result = importInto(current, exportSaveText(incoming, 3), 4)!
  assert.equal(current.blasters.length, 1)
  assert.equal(result.save.blasters.length, 2)
})

test('SaveCodec은 등록되지 않은 슬롯 키를 도메인 객체에 주입하지 않는다', () => {
  const normalized = normalizeSave({
    blasters: [{
      id: 'b1',
      name: '테스트',
      createdAt: 1,
      parts: {
        body: { partId: 'body_popcorn' },
        future_slot: { partId: 'future_part' },
      },
    }],
  }, 1)
  assert.equal(Object.hasOwn(normalized.blasters[0]!.parts, 'future_slot'), false)
})
