// src/game/pvpSession.ts — PVP 3라운드의 순수 규칙과 상태.
// THREE·DOM·전역 난수를 모르며, 화면과 AI는 의도·명중 결과만 전달한다.
import type { BlasterStats, ProjectileKind, ShotProfile } from './types.ts'

export const PVP_STARTING_HEALTH = 10
export const PVP_ROUND_COUNT = 3

export type PvpActor = 'player' | 'rival'
export type PvpPhase =
  | 'lobby'
  | 'playing'
  | 'round-complete'
  | 'retry'
  | 'victory'
  | 'draw'

export interface PvpProfile {
  popPower: number
  fireIntervalMs: number
  spreadDeg: number
  muzzleVelocity: number
  kind: ProjectileKind
  projectileScale: number
  aimFollowPerSec: number
  strafeSpeed: number
}

/**
 * 공방 스탯과 사격 프로필을 PVP 규칙으로 옮기는 유일한 경로.
 * 파워와 다루기는 방어적으로 1..10에 가둬 외부 입력에도 계약을 유지한다.
 */
export function toPvpProfile(stats: BlasterStats, shot: ShotProfile): PvpProfile {
  const power = clamp(stats.power, 1, 10)
  const handlingT = (clamp(stats.handling, 1, 10) - 1) / 9

  return {
    popPower: 0.75 + (power - 1) / 12,
    fireIntervalMs: shot.fireIntervalMs,
    spreadDeg: shot.spreadDeg,
    muzzleVelocity: shot.muzzleVelocity,
    kind: shot.kind,
    projectileScale: shot.projectileScale,
    aimFollowPerSec: 6 + 12 * handlingT,
    strafeSpeed: 1.8 + 1.8 * handlingT,
  }
}

/**
 * 같은 시뮬레이션 프레임에 도착한 양측 타격값.
 * playerPopPower는 라이벌에게, rivalPopPower는 플레이어에게 적용된다.
 */
export interface PvpFrameImpacts {
  playerPopPower: number
  rivalPopPower: number
}

export class PvpSession {
  private phaseValue: PvpPhase = 'lobby'
  private roundIndexValue = 0
  private playerHealthValue = PVP_STARTING_HEALTH
  private rivalHealthValue = PVP_STARTING_HEALTH
  private playerNextPopAt = 0
  private rivalNextPopAt = 0

  private readonly playerProfileValue: PvpProfile
  private readonly rivalProfiles: readonly PvpProfile[]

  constructor(playerProfile: PvpProfile, rivalProfiles: readonly PvpProfile[]) {
    if (rivalProfiles.length !== PVP_ROUND_COUNT) {
      throw new RangeError(`PVP requires exactly ${PVP_ROUND_COUNT} rival profiles`)
    }
    this.playerProfileValue = freezeProfile(playerProfile)
    this.rivalProfiles = Object.freeze(rivalProfiles.map(freezeProfile))
  }

  start(nowMs = 0): boolean {
    if (this.phaseValue !== 'lobby') return false
    this.resetRound(nowMs)
    this.phaseValue = 'playing'
    return true
  }

  canPop(actor: PvpActor, nowMs: number): boolean {
    if (this.phaseValue !== 'playing' || !Number.isFinite(nowMs)) return false
    return nowMs >= this.nextPopAt(actor)
  }

  /**
   * 연사 게이트를 통과하면 해당 시각부터 프로필의 발사 간격만큼 잠근다.
   * 양측이 같은 시각에 호출되어도 서로의 게이트에는 영향을 주지 않는다.
   */
  tryPop(actor: PvpActor, nowMs: number): boolean {
    if (!this.canPop(actor, nowMs)) return false
    const next = nowMs + this.profileFor(actor).fireIntervalMs
    if (actor === 'player') this.playerNextPopAt = next
    else this.rivalNextPopAt = next
    return true
  }

  /**
   * 한 프레임의 양측 타격을 이전 체력에서 동시에 계산한다.
   * 따라서 호출/배열 순서에 따라 한쪽 결과가 사라지지 않는다.
   */
  resolveFrame(impacts: PvpFrameImpacts): PvpPhase {
    if (this.phaseValue !== 'playing') return this.phaseValue

    const playerPop = sanitizePopPower(impacts.playerPopPower)
    const rivalPop = sanitizePopPower(impacts.rivalPopPower)
    const nextPlayerHealth = remainingHealth(this.playerHealthValue, rivalPop)
    const nextRivalHealth = remainingHealth(this.rivalHealthValue, playerPop)

    this.playerHealthValue = nextPlayerHealth
    this.rivalHealthValue = nextRivalHealth

    if (nextPlayerHealth <= 0 && nextRivalHealth <= 0) {
      this.phaseValue = 'draw'
    } else if (nextRivalHealth <= 0) {
      this.phaseValue =
        this.roundIndexValue === PVP_ROUND_COUNT - 1 ? 'victory' : 'round-complete'
    } else if (nextPlayerHealth <= 0) {
      this.phaseValue = 'retry'
    }
    return this.phaseValue
  }

  /** 현재 라운드를 이긴 뒤 다음 라이벌과 새 라운드를 시작한다. */
  advance(nowMs = 0): boolean {
    if (this.phaseValue !== 'round-complete') return false
    this.roundIndexValue += 1
    this.resetRound(nowMs)
    this.phaseValue = 'playing'
    return true
  }

  /** 현재 라운드의 retry·draw 결과만 같은 라이벌과 다시 시작한다. */
  retry(nowMs = 0): boolean {
    if (this.phaseValue !== 'retry' && this.phaseValue !== 'draw') return false
    this.resetRound(nowMs)
    this.phaseValue = 'playing'
    return true
  }

  private resetRound(nowMs: number): void {
    const startAt = Number.isFinite(nowMs) ? nowMs : 0
    this.playerHealthValue = PVP_STARTING_HEALTH
    this.rivalHealthValue = PVP_STARTING_HEALTH
    this.playerNextPopAt = startAt
    this.rivalNextPopAt = startAt
  }

  private nextPopAt(actor: PvpActor): number {
    return actor === 'player' ? this.playerNextPopAt : this.rivalNextPopAt
  }

  private profileFor(actor: PvpActor): PvpProfile {
    return actor === 'player' ? this.playerProfileValue : this.rivalProfile
  }

  get phase(): PvpPhase {
    return this.phaseValue
  }

  get roundIndex(): number {
    return this.roundIndexValue
  }

  get playerHealth(): number {
    return this.playerHealthValue
  }

  get rivalHealth(): number {
    return this.rivalHealthValue
  }

  get playerProfile(): PvpProfile {
    return this.playerProfileValue
  }

  get rivalProfile(): PvpProfile {
    return this.rivalProfiles[this.roundIndexValue]!
  }
}

function freezeProfile(profile: PvpProfile): PvpProfile {
  return Object.freeze({ ...profile })
}

function sanitizePopPower(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function remainingHealth(current: number, popPower: number): number {
  return Math.max(0, current - popPower)
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
