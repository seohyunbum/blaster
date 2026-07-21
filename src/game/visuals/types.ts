// 공통 시각 빌더 계약과 저비용 유틸.
import * as THREE from 'three'
import type { MorphState, SocketId, ZoneId } from '../types.ts'

export interface BuildOpts {
  morph: MorphState
  lod?: 'drag' | 'full'
  hideCarryHandle?: boolean
}

export type AnchorId = SocketId | 'gripTop'

export interface BuiltPart {
  group: THREE.Group
  zones: Partial<Record<ZoneId, THREE.Mesh[]>>
  anchors: Partial<Record<AnchorId, THREE.Object3D>>
  dispose(): void
}

export const PLACEHOLDER = 0xcfd3da

export function segFor(lod: 'drag' | 'full' | undefined, full: number, drag: number): number {
  return lod === 'drag' ? drag : full
}
