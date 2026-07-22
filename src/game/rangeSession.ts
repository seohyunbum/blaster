// src/game/rangeSession.ts — 사격 한 판의 상태와 규칙을 캡슐화한다.
// DOM/HUD/오디오는 모르며 main은 결과를 화면에 반영만 한다.
import * as THREE from 'three'
import type { BlasterStats, ShotProfile } from './types.ts'
import { PROJECTILE_GRAVITY } from './ballistics.ts'
import { recoveryDegPerSec, RECOIL_MAX_DEG } from './ballistics.ts'
import type { RangeController } from './range.ts'

export type AimSelection = number | 'reddot' | null
export type AimMode = 'none' | 'reddot' | 'scope'
export const MAG_OPTIONS: readonly number[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

const BASE_FOV = 45
const ZOOM_MIN = 4
const ZOOM_MAX = 15
const REDDOT_MAG = 1.5
const RECOIL_MAX_RAD = (RECOIL_MAX_DEG * Math.PI) / 180
const STAR_CUTS: readonly [number, number, number] = [1, 6, 9]
const AIM_ORDER: readonly AimSelection[] = [null, 'reddot', ...MAG_OPTIONS]

export interface FireResult {
  status: 'fired' | 'empty' | 'blocked'
  startedReload: boolean
}

export class RangeSession {
  private aimYawValue = 0
  private aimPitchValue = 0
  private recoilPitchValue = 0
  private hitsValue = 0
  private shotsValue = 0
  private ammoMaxValue = 0
  private ammoCurValue = 0
  private reloadingValue = false
  private reloadDurMsValue = 0
  private reloadEndT = 0
  private reloadCompletedValue = false
  private reloadProgressValue: number | null = null
  private guideSpeed = 30
  private guideGravity = 4
  private recoilRecovery = (8 * Math.PI) / 180
  private aimModeValue: AimMode = 'none'
  private zoomValue = ZOOM_MIN

  private readonly aimEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly fireRight = new THREE.Vector3()
  private readonly fireUp = new THREE.Vector3()
  private readonly fireDir = new THREE.Vector3()
  private readonly fireOrigin = new THREE.Vector3()
  private readonly guideDir = new THREE.Vector3()
  private readonly guideOrigin = new THREE.Vector3()

  begin(stats: BlasterStats, profile: ShotProfile, camera: THREE.PerspectiveCamera): void {
    this.aimYawValue = 0
    this.aimPitchValue = 0
    this.recoilPitchValue = 0
    this.hitsValue = 0
    this.shotsValue = 0
    this.aimModeValue = 'none'
    this.zoomValue = ZOOM_MIN
    this.guideSpeed = profile.muzzleVelocity
    this.guideGravity = PROJECTILE_GRAVITY[profile.kind]
    this.recoilRecovery = (recoveryDegPerSec(profile) * Math.PI) / 180
    this.ammoMaxValue = stats.capacity
    this.ammoCurValue = this.ammoMaxValue
    this.reloadingValue = false
    this.reloadDurMsValue = Math.max(0, stats.reloadSec) * 1000
    this.reloadEndT = 0
    this.reloadCompletedValue = false
    this.reloadProgressValue = null
    this.applyView(camera)
    this.composeAim(camera)
  }

  registerHit(): number {
    this.hitsValue += 1
    return this.hitsValue
  }

  retry(): void {
    this.hitsValue = 0
    this.shotsValue = 0
    this.ammoCurValue = this.ammoMaxValue
    this.reloadingValue = false
    this.reloadEndT = 0
    this.reloadCompletedValue = false
    this.reloadProgressValue = null
  }

  startReload(nowMs: number): boolean {
    if (this.ammoMaxValue <= 0 || this.reloadingValue || this.ammoCurValue >= this.ammoMaxValue) {
      return false
    }
    this.reloadingValue = true
    this.reloadEndT = nowMs + this.reloadDurMsValue
    return true
  }

  fire(
    profile: ShotProfile,
    camera: THREE.PerspectiveCamera,
    range: RangeController,
    nowMs: number,
  ): FireResult {
    if (this.reloadingValue) return { status: 'blocked', startedReload: false }
    if (this.ammoMaxValue > 0 && this.ammoCurValue <= 0) {
      return { status: 'empty', startedReload: this.startReload(nowMs) }
    }

    camera.getWorldDirection(this.fireDir)
    this.fireOrigin.copy(camera.position).addScaledVector(this.fireDir, 0.5)
    this.fireRight.crossVectors(this.fireDir, camera.up).normalize()
    this.fireUp.crossVectors(this.fireRight, this.fireDir).normalize()
    range.fireOne(profile, this.fireOrigin, this.fireDir)
    this.shotsValue += 1

    let startedReload = false
    if (this.ammoMaxValue > 0) {
      this.ammoCurValue -= 1
      if (this.ammoCurValue <= 0) startedReload = this.startReload(nowMs)
    }
    this.recoilPitchValue = Math.min(
      this.recoilPitchValue + (profile.recoilKickDeg * Math.PI) / 180,
      RECOIL_MAX_RAD,
    )
    return { status: 'fired', startedReload }
  }

  update(
    dt: number,
    nowMs: number,
    camera: THREE.PerspectiveCamera,
    range: RangeController,
  ): void {
    if (this.recoilPitchValue > 0) {
      this.recoilPitchValue = Math.max(0, this.recoilPitchValue - dt * this.recoilRecovery)
      this.composeAim(camera)
    }

    this.reloadCompletedValue = false
    this.reloadProgressValue = null
    if (this.reloadingValue) {
      if (nowMs >= this.reloadEndT) {
        this.reloadingValue = false
        this.ammoCurValue = this.ammoMaxValue
        this.reloadCompletedValue = true
      } else {
        this.reloadProgressValue = this.reloadDurMsValue > 0
          ? 1 - (this.reloadEndT - nowMs) / this.reloadDurMsValue
          : 1
      }
    }

    camera.getWorldDirection(this.guideDir)
    this.guideOrigin.copy(camera.position).addScaledVector(this.guideDir, 0.5)
    range.updateGuide(this.guideOrigin, this.guideDir, this.guideSpeed, this.guideGravity)
    range.update(dt, nowMs)
  }

  moveAim(deltaX: number, deltaY: number, camera: THREE.PerspectiveCamera): void {
    const sensitivity = 0.0032 * (this.fov / BASE_FOV)
    this.aimYawValue -= deltaX * sensitivity
    this.aimPitchValue = clamp(this.aimPitchValue - deltaY * sensitivity, -0.5, 0.45)
    this.composeAim(camera)
  }

  setAim(yaw: number, pitch: number, camera: THREE.PerspectiveCamera): void {
    this.aimYawValue = yaw
    this.aimPitchValue = clamp(pitch, -0.5, 0.45)
    this.composeAim(camera)
  }

  selectAim(selection: AimSelection, camera: THREE.PerspectiveCamera): void {
    if (selection === null) this.aimModeValue = 'none'
    else if (selection === 'reddot') this.aimModeValue = 'reddot'
    else {
      this.aimModeValue = 'scope'
      this.zoomValue = clamp(Math.round(selection), ZOOM_MIN, ZOOM_MAX)
    }
    this.applyView(camera)
  }

  stepAim(delta: number, camera: THREE.PerspectiveCamera): void {
    const current: AimSelection =
      this.aimModeValue === 'none' ? null : this.aimModeValue === 'reddot' ? 'reddot' : this.zoomValue
    let index = AIM_ORDER.findIndex((selection) => selection === current)
    if (index < 0) index = 0
    index = clamp(index + delta, 0, AIM_ORDER.length - 1)
    this.selectAim(AIM_ORDER[index] ?? null, camera)
  }

  composeAim(camera: THREE.PerspectiveCamera): void {
    this.aimEuler.set(
      this.aimPitchValue + this.recoilPitchValue,
      this.aimYawValue,
      0,
      'YXZ',
    )
    camera.quaternion.setFromEuler(this.aimEuler)
  }

  private applyView(camera: THREE.PerspectiveCamera): void {
    camera.fov = this.fov
    camera.updateProjectionMatrix()
  }

  get fov(): number {
    const half = (BASE_FOV / 2) * (Math.PI / 180)
    return (2 * Math.atan(Math.tan(half) / this.magnification) * 180) / Math.PI
  }

  get magnification(): number {
    return this.aimModeValue === 'scope' ? this.zoomValue : this.aimModeValue === 'reddot' ? REDDOT_MAG : 1
  }

  get stars(): 0 | 1 | 2 | 3 {
    if (this.hitsValue >= STAR_CUTS[2]) return 3
    if (this.hitsValue >= STAR_CUTS[1]) return 2
    if (this.hitsValue >= STAR_CUTS[0]) return 1
    return 0
  }

  get hits(): number { return this.hitsValue }
  get shotsFired(): number { return this.shotsValue }
  get ammoMax(): number { return this.ammoMaxValue }
  get ammoCur(): number { return this.ammoCurValue }
  get reloading(): boolean { return this.reloadingValue }
  get reloadDurMs(): number { return this.reloadDurMsValue }
  get reloadCompleted(): boolean { return this.reloadCompletedValue }
  get reloadProgress(): number | null { return this.reloadProgressValue }
  get aimMode(): AimMode { return this.aimModeValue }
  get zoom(): number { return this.zoomValue }
  get recoilDeg(): number { return (this.recoilPitchValue * 180) / Math.PI }
  get recoilRecoveryDegPerSec(): number { return (this.recoilRecovery * 180) / Math.PI }
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n
}
