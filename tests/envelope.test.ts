import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { ENVELOPE } from '../src/game/morph.ts'
import { CATALOG } from '../src/game/parts.ts'
import { buildPart } from '../src/game/partVisuals.ts'
import type { MorphState, PartId } from '../src/game/types.ts'
import { bodyShellMetrics } from '../src/game/visuals/bodyVisuals.ts'
import { barrelTubeMetrics } from '../src/game/visuals/barrelVisuals.ts'

const EPSILON = 1e-9
const PARTS = [...CATALOG.values()]
const BODY_IDS = PARTS.filter((part) => part.slot === 'body').map((part) => part.id)
const BARREL_IDS = PARTS.filter((part) => part.slot === 'barrel').map((part) => part.id)

test('전 몸통은 morph 꼭짓점과 결정적 랜덤 50콤보에서 봉투 안이다', () => {
  for (const partId of BODY_IDS) {
    for (const bodyLength of [0, 1]) {
      for (const bodyChub of [0, 1]) {
        for (const bodyRound of [0, 1]) {
          assertBodyEnvelope(partId, { bodyLength, bodyChub, bodyRound })
        }
      }
    }

    const random = seededRandom(hashId(partId))
    for (let i = 0; i < 50; i++) {
      assertBodyEnvelope(partId, {
        bodyLength: random(),
        bodyChub: random(),
        bodyRound: random(),
      })
    }
  }
})

test('전 배럴은 morph 꼭짓점과 결정적 랜덤 50콤보에서 봉투 안이다', () => {
  for (const partId of BARREL_IDS) {
    for (const barrelLength of [0, 1]) {
      for (const barrelBore of [0, 1]) {
        for (const barrelTaper of [0, 1]) {
          assertBarrelEnvelope(partId, { barrelLength, barrelBore, barrelTaper })
        }
      }
    }

    const random = seededRandom(hashId(partId))
    for (let i = 0; i < 50; i++) {
      assertBarrelEnvelope(partId, {
        barrelLength: random(),
        barrelBore: random(),
        barrelTaper: random(),
      })
    }
  }
})

test('전 몸통×배럴 최대 길이 조합이 합성 전장 봉투 안이다', () => {
  for (const bodyId of BODY_IDS) {
    const body = bodyShellMetrics(bodyId, { bodyLength: 1 })
    for (const barrelId of BARREL_IDS) {
      const barrel = barrelTubeMetrics(barrelId, { barrelLength: 1 })
      assert.ok(
        body.length + barrel.length <= ENVELOPE.totalLenMax + EPSILON,
        `${bodyId}+${barrelId}: ${body.length + barrel.length} > ${ENVELOPE.totalLenMax}`,
      )
    }
  }
})

test('실제 몸통 셸 bounding box가 기본·극단 morph 실측 정본과 일치한다', () => {
  const morphs: MorphState[] = [
    {},
    { bodyLength: 0, bodyChub: 0, bodyRound: 0 },
    { bodyLength: 1, bodyChub: 1, bodyRound: 1 },
  ]
  for (const partId of BODY_IDS) {
    for (const morph of morphs) {
      const expected = bodyShellMetrics(partId, morph)
      const built = buildPart(partId, { morph })
      const shell = built.zones.primary?.[0]
      assert.ok(shell, `${partId}: 구조 셸 없음`)
      const actual = objectSize(shell)
      assertWithin10Pct(actual.x, expected.boundsWidth, `${partId} width`)
      assertWithin10Pct(actual.y, expected.boundsHeight, `${partId} height`)
      assertWithin10Pct(actual.z, expected.boundsLength, `${partId} length`)
      built.dispose()
    }
  }
})

test('실제 배럴 튜브 bounding box가 기본·극단 morph 실측 정본과 일치한다', () => {
  const morphs: MorphState[] = [{}]
  for (const barrelLength of [0, 1]) {
    for (const barrelBore of [0, 1]) {
      for (const barrelTaper of [0, 1]) morphs.push({ barrelLength, barrelBore, barrelTaper })
    }
  }
  for (const partId of BARREL_IDS) {
    for (const morph of morphs) {
      const expected = barrelTubeMetrics(partId, morph)
      const built = buildPart(partId, { morph })
      const tube = built.zones.primary?.[0]
      assert.ok(tube, `${partId}: 구조 튜브 없음`)
      const actual = objectSize(tube)
      assertWithin10Pct(actual.x, expected.maxRadius * 2, `${partId} width`)
      assertWithin10Pct(actual.y, expected.maxRadius * 2, `${partId} height`)
      assertWithin10Pct(actual.z, expected.length, `${partId} length`)
      built.dispose()
    }
  }
})

function assertBodyEnvelope(partId: PartId, morph: MorphState): void {
  const metric = bodyShellMetrics(partId, morph)
  const aspect = metric.length / (metric.crossRadius * 2)
  assert.ok(aspect <= ENVELOPE.bodyAspectMax + EPSILON, `${partId}: aspect ${aspect}`)
  assert.ok(
    metric.crossRadius >= ENVELOPE.minCrossRadius - EPSILON,
    `${partId}: radius ${metric.crossRadius}`,
  )
  assert.ok(
    metric.roundRatio >= ENVELOPE.roundPctMin - EPSILON,
    `${partId}: round ${metric.roundRatio}`,
  )
}

function assertBarrelEnvelope(partId: PartId, morph: MorphState): void {
  const metric = barrelTubeMetrics(partId, morph)
  const slenderness = metric.length / metric.rearRadius
  assert.ok(
    slenderness <= ENVELOPE.barrelLoverRMax + EPSILON,
    `${partId}: L/r ${slenderness}`,
  )
  assert.ok(
    metric.rearRadius >= ENVELOPE.minCrossRadius - EPSILON,
    `${partId}: radius ${metric.rearRadius}`,
  )
  assert.ok(
    metric.frontRadius >= ENVELOPE.barrelFrontRadiusMin - EPSILON,
    `${partId}: front ${metric.frontRadius}`,
  )
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function hashId(id: string): number {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

function objectSize(object: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3())
}

function assertWithin10Pct(actual: number, expected: number, label: string): void {
  const drift = Math.abs(actual - expected) / expected
  assert.ok(drift <= 0.1 + EPSILON, `${label}: ${actual} vs ${expected} (${drift * 100}%)`)
}
