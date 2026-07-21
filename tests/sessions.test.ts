import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { EditorSession } from '../src/game/editorSession.ts'
import { RangeSession } from '../src/game/rangeSession.ts'
import { createStarterBlaster, type IdSource } from '../src/game/save.ts'
import { computeStats } from '../src/game/parts.ts'
import { toShotProfile } from '../src/game/ballistics.ts'
import type { RangeController } from '../src/game/range.ts'

const ids: IdSource = { makeId: (prefix) => `${prefix}_test` }

test('EditorSession은 파츠 변경과 undo를 한 경계에서 관리한다', () => {
  const blaster = createStarterBlaster(1, '테스트', ids)
  const session = new EditorSession(blaster, { next: () => 0.5 }, { now: () => 100 })
  const original = blaster.parts.barrel!.partId
  assert.equal(session.selectPart('barrel', 'barrel_wide'), true)
  assert.equal(blaster.parts.barrel!.partId, 'barrel_wide')
  assert.equal(session.canUndo, true)
  assert.equal(session.undo(), true)
  assert.equal(blaster.parts.barrel!.partId, original)
})

test('EditorSession morph 제스처는 commit 한 번으로 undo 한 칸이 된다', () => {
  const blaster = createStarterBlaster(1, '테스트', ids)
  const session = new EditorSession(blaster, { next: () => 0.5 }, { now: () => 100 })
  session.morphInput('body', 'bodyLength', 0.8)
  session.morphInput('body', 'bodyLength', 0.9)
  session.morphCommit('body', 'bodyLength', 0.9)
  assert.equal(blaster.parts.body!.morph.bodyLength, 0.9)
  session.undo()
  assert.equal(blaster.parts.body!.morph.bodyLength, undefined)
})

test('RangeSession은 탄약·재장전·별 계산을 캡슐화한다', () => {
  const blaster = createStarterBlaster(1, '테스트', ids)
  blaster.parts.magazine = {
    partId: 'mag_rocket',
    paint: {},
    morph: {},
  }
  const stats = computeStats(blaster)
  const profile = toShotProfile(stats)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100)
  const shots: unknown[] = []
  const range = {
    fireOne: (...args: unknown[]) => shots.push(args),
    updateGuide: () => {},
    update: () => {},
  } as unknown as RangeController
  const session = new RangeSession()
  session.begin(stats, profile, camera)
  assert.equal(session.ammoMax, 1)
  assert.equal(session.fire(profile, camera, range, 0).status, 'fired')
  assert.equal(shots.length, 1)
  assert.equal(session.reloading, true)
  session.registerHit()
  assert.equal(session.stars, 1)
})
