import type { AimMode, AimSelection } from './game/rangeSession.ts'
import type { SavedGame } from './game/save.ts'
import type { StationId } from './game/definitions.ts'
import type { Blaster, BlasterStats, MorphKey, SlotType } from './game/types.ts'

export interface BlasterLabDebugState {
  station: StationId
  recoilDeg: number
  recoilRecoveryDegPerSec: number
  frameCount: number
  editVisible: boolean
  rangeVisible: boolean
  vmVisible: boolean
  geo: number
  calls: number
}

export interface BlasterLabDebugHandle {
  readonly save: SavedGame
  readonly active: Blaster
  computeStats(): BlasterStats
  rendererInfo(): { calls: number; triangles: number; geometries: number }
  setStation(station: StationId): void
  setAim(yaw: number, pitch: number): void
  hits(): number
  selectMag(selection: AimSelection): void
  zoomState(): { aimMode: AimMode; zoom: number; fov: number }
  rotateState(): { mul: number; autoRotate: boolean; speed: number }
  step(frames?: number): { calls: number; hits: number }
  ammoState(): { ammoMax: number; ammoCur: number; reloading: boolean; reloadDurMs: number }
  reload(): void
  state(): BlasterLabDebugState
  setMorph(slot: SlotType, key: MorphKey, t: number): void
  fire(): void
}

declare global {
  interface Window {
    __blasterLab?: BlasterLabDebugHandle
  }
}
