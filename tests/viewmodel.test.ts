import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildBlaster } from '../src/game/assembly.ts'
import { fitBlasterViewmodel } from '../src/game/viewmodel.ts'
import { makeInstance } from '../src/game/save.ts'
import type { Blaster } from '../src/game/types.ts'

const OVERSIZE_BLASTER: Blaster = {
  id: 'oversize-viewmodel',
  name: '왕구슬 테스트',
  createdAt: 0,
  parts: {
    body: makeInstance('body_minigun'),
    grip: makeInstance('grip_minigun'),
    barrel: makeInstance('barrel_snap', { barrelCount: 1 }),
  },
}

test('큰 보관함 블래스터 뷰모델 배치는 카메라 부모 위치와 무관하다', () => {
  const built = buildBlaster(OVERSIZE_BLASTER, 'full')
  const cameraParent = new THREE.Group()
  cameraParent.add(built.group)

  cameraParent.position.set(0, 0, 0)
  cameraParent.updateWorldMatrix(true, true)
  fitBlasterViewmodel(OVERSIZE_BLASTER, built.group)
  const originPosition = built.group.position.clone()
  const originScale = built.group.scale.clone()

  cameraParent.position.set(17, -9, 31)
  cameraParent.updateWorldMatrix(true, true)
  fitBlasterViewmodel(OVERSIZE_BLASTER, built.group)

  assert.ok(originScale.x < 1, 'oversize 축소 규칙이 적용되지 않음')
  assert.ok(built.group.position.distanceTo(originPosition) < 1e-9)
  assert.ok(built.group.scale.distanceTo(originScale) < 1e-9)
  built.dispose()
})
