// src/game/viewmodel.ts — 보관함 블래스터를 1인칭 화면 안에 맞추는 공용 배치 규칙.
import * as THREE from 'three'
import { CATALOG } from './parts.ts'
import type { Blaster } from './types.ts'

const box = new THREE.Box3()
const childBox = new THREE.Box3()
const size = new THREE.Vector3()
const center = new THREE.Vector3()
const rootWorldInverse = new THREE.Matrix4()
const childToRoot = new THREE.Matrix4()

function setLocalBounds(object: THREE.Object3D): void {
  object.updateWorldMatrix(true, true)
  rootWorldInverse.copy(object.matrixWorld).invert()
  box.makeEmpty()

  object.traverse((child) => {
    const geometry = (child as THREE.Mesh).geometry
    if (!(geometry instanceof THREE.BufferGeometry)) return
    if (geometry.boundingBox === null) geometry.computeBoundingBox()
    if (geometry.boundingBox === null) return

    childToRoot.multiplyMatrices(rootWorldInverse, child.matrixWorld)
    childBox.copy(geometry.boundingBox).applyMatrix4(childToRoot)
    box.union(childBox)
  })
}

export function fitBlasterViewmodel(blaster: Blaster, object: THREE.Object3D): void {
  object.scale.setScalar(1)
  object.position.set(0, 0, 0)

  const bodyFit = CATALOG.get(blaster.parts.body?.partId ?? '')?.capabilities?.viewmodelFit
  const gripFit = CATALOG.get(blaster.parts.grip?.partId ?? '')?.capabilities?.viewmodelFit
  const magFit = CATALOG.get(blaster.parts.magazine?.partId ?? '')?.capabilities?.viewmodelFit
  const oversize = bodyFit === 'oversize' && gripFit === 'oversize'
  const compact = gripFit === 'compact' || magFit === 'compact'

  if (oversize) {
    setLocalBounds(object)
    box.getSize(size)
    box.getCenter(center)
    const screenDimension = Math.max(size.x, size.y)
    const targetDimension = 0.34
    const scale = screenDimension > targetDimension ? targetDimension / screenDimension : 1
    object.scale.setScalar(scale)
    object.position.set(
      -center.x * scale,
      -(center.y + size.y / 2) * scale,
      -center.z * scale,
    )
  } else if (compact) {
    object.position.y = -0.05
  }
}
