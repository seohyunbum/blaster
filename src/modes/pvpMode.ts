// src/modes/pvpMode.ts — PVP 로비·세션·3D 무대·입력을 연결하는 모드 조정자.
import * as THREE from 'three'
import { buildBlaster, type BuiltBlaster } from '../game/assembly.ts'
import { sfx } from '../game/audio.ts'
import { toShotProfile } from '../game/ballistics.ts'
import { boreScaleFromMorph } from '../game/morph.ts'
import { computeStats } from '../game/parts.ts'
import { PvpArena } from '../game/pvpArena.ts'
import { PVP_LOADOUTS } from '../game/pvpLoadouts.ts'
import {
  PVP_ROUND_COUNT,
  PvpSession,
  toPvpProfile,
  type PvpFrameImpacts,
  type PvpProfile,
} from '../game/pvpSession.ts'
import type { Blaster, PartInstance, SlotType } from '../game/types.ts'
import { fitBlasterViewmodel } from '../game/viewmodel.ts'
import { createPvpHud } from '../ui/pvpHud.ts'

const PLAYER_Y = 1.45
const PLAYER_Z = 0.7
const PLAYER_X_LIMIT = 4.6
const RIVAL_REACTION_MS = 700
const BASE_MATCH_SEED = 0x51f15e

export interface PvpModeCallbacks {
  onSelectBlaster: (blasterId: string) => void
  onCollection: () => void
}

export interface PvpModeOptions {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  hudHost: HTMLElement
  callbacks: PvpModeCallbacks
}

export class PvpMode {
  private readonly camera: THREE.PerspectiveCamera
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: PvpModeCallbacks
  private readonly arena = new PvpArena()
  private readonly viewmodel = new THREE.Group()
  private readonly hudRoot = document.createElement('div')
  private readonly hud
  private readonly rivalProfiles: readonly PvpProfile[]
  private readonly impactFrame: PvpFrameImpacts = {
    playerPopPower: 0,
    rivalPopPower: 0,
  }
  private readonly aimEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly fireOrigin = new THREE.Vector3()
  private readonly fireDirection = new THREE.Vector3()

  private ownedBlasters: readonly Blaster[] = []
  private selectedId: string | null = null
  private playerBlaster: Blaster | null = null
  private playerBuilt: BuiltBlaster | null = null
  private session: PvpSession | null = null
  private active = false
  private firing = false
  private movingLeft = false
  private movingRight = false
  private targetYaw = 0
  private targetPitch = 0
  private aimYaw = 0
  private aimPitch = 0
  private playerX = 0
  private roundStartedAt = 0

  constructor(options: PvpModeOptions) {
    this.camera = options.camera
    this.canvas = options.canvas
    this.callbacks = options.callbacks

    options.scene.add(this.arena.group)
    this.viewmodel.position.set(0.14, -0.16, -0.42)
    this.viewmodel.visible = false
    this.camera.add(this.viewmodel)

    options.hudHost.appendChild(this.hudRoot)
    this.hud = createPvpHud(this.hudRoot, {
      onStart: (id) => this.startMatch(id, performance.now()),
      onNext: () => this.advanceRound(performance.now()),
      onRetry: () => this.retry(performance.now()),
      onCollection: () => this.callbacks.onCollection(),
    })
    this.hud.setVisible(false)

    this.rivalProfiles = Object.freeze(PVP_LOADOUTS.map((loadout) => profileFor(loadout.blaster)))
    this.installInput()
  }

  enter(blasters: readonly Blaster[], activeId: string | null): void {
    this.active = true
    this.ownedBlasters = blasters
    this.selectedId = activeId
    this.session = null
    this.playerBlaster = null
    this.resetInput()
    this.arena.reset()
    this.arena.visible = true
    this.viewmodel.visible = false
    this.configureCamera()
    this.hud.setVisible(true)
    this.hud.showLobby(blasters, activeId)
  }

  leave(): void {
    this.active = false
    this.session = null
    this.resetInput()
    this.arena.reset()
    this.arena.visible = false
    this.viewmodel.visible = false
    this.hud.setVisible(false)
  }

  update(dt: number, nowMs: number): void {
    const session = this.session
    if (!this.active || !session || session.phase !== 'playing') return

    const playerProfile = session.playerProfile
    const movement = (this.movingRight ? 1 : 0) - (this.movingLeft ? 1 : 0)
    this.playerX = clamp(
      this.playerX + movement * playerProfile.strafeSpeed * dt,
      -PLAYER_X_LIMIT,
      PLAYER_X_LIMIT,
    )
    const follow = Math.min(1, dt * playerProfile.aimFollowPerSec)
    this.aimYaw += (this.targetYaw - this.aimYaw) * follow
    this.aimPitch += (this.targetPitch - this.aimPitch) * follow
    this.camera.position.set(this.playerX, PLAYER_Y, PLAYER_Z)
    this.aimEuler.set(this.aimPitch, this.aimYaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(this.aimEuler)

    if (this.firing) this.tryPlayerPop(nowMs)
    if (nowMs >= this.roundStartedAt + RIVAL_REACTION_MS && session.tryPop('rival', nowMs)) {
      this.arena.fireRival(this.camera.position, session.rivalProfile)
      sfx.shoot()
    }

    this.arena.update(dt, this.camera.position, session.rivalProfile)
    const playerHits = this.arena.consumePlayerImpact()
    const rivalHits = this.arena.consumeRivalImpact()
    if (playerHits <= 0 && rivalHits <= 0) return

    this.impactFrame.playerPopPower = rivalHits * playerProfile.popPower
    this.impactFrame.rivalPopPower = playerHits * session.rivalProfile.popPower
    const phase = session.resolveFrame(this.impactFrame)
    this.arena.setRivalHealth(session.rivalHealth)
    this.hud.setHealth(session.playerHealth, session.rivalHealth)
    if (playerHits > 0 || rivalHits > 0) sfx.pop()
    if (
      phase === 'round-complete'
      || phase === 'retry'
      || phase === 'victory'
      || phase === 'draw'
    ) {
      this.firing = false
      this.hud.showOutcome(phase, session.roundIndex + 1, PVP_ROUND_COUNT)
      if (phase === 'victory') sfx.star()
    }
  }

  get isVisible(): boolean {
    return this.active && this.arena.visible
  }

  snapshot(): {
    phase: string
    round: number
    playerHealth: number
    rivalHealth: number
    selectedId: string | null
  } {
    return {
      phase: this.session?.phase ?? 'lobby',
      round: (this.session?.roundIndex ?? 0) + 1,
      playerHealth: this.session?.playerHealth ?? 10,
      rivalHealth: this.session?.rivalHealth ?? 10,
      selectedId: this.selectedId,
    }
  }

  private startMatch(blasterId: string, nowMs: number): void {
    const selected = this.ownedBlasters.find((blaster) => blaster.id === blasterId)
    if (!selected) return
    this.selectedId = selected.id
    this.callbacks.onSelectBlaster(selected.id)
    this.playerBlaster = snapshotBlaster(selected)
    const playerProfile = profileFor(this.playerBlaster)
    this.session = new PvpSession(playerProfile, this.rivalProfiles)
    this.session.start(nowMs)
    this.rebuildViewmodel(this.playerBlaster)
    this.startRound(nowMs)
  }

  private startRound(nowMs: number): void {
    const session = this.session
    const playerBlaster = this.playerBlaster
    if (!session || !playerBlaster) return
    const rival = PVP_LOADOUTS[session.roundIndex]!
    this.playerX = 0
    this.targetYaw = 0
    this.targetPitch = 0
    this.aimYaw = 0
    this.aimPitch = 0
    this.roundStartedAt = nowMs
    this.configureCamera()
    this.arena.startRound(
      rival.blaster,
      session.rivalProfile,
      BASE_MATCH_SEED + session.roundIndex * 7919,
    )
    this.viewmodel.visible = true
    this.hud.showBattle({
      playerName: playerBlaster.name,
      rivalName: rival.nameKo,
      round: session.roundIndex + 1,
      total: PVP_ROUND_COUNT,
      playerHealth: session.playerHealth,
      rivalHealth: session.rivalHealth,
      spreadDeg: session.playerProfile.spreadDeg,
    })
  }

  private advanceRound(nowMs: number): void {
    if (!this.session?.advance(nowMs)) return
    this.startRound(nowMs)
  }

  private retry(nowMs: number): void {
    if (this.session?.phase === 'victory') {
      if (this.selectedId) this.startMatch(this.selectedId, nowMs)
      return
    }
    if (!this.session?.retry(nowMs)) return
    this.startRound(nowMs)
  }

  private tryPlayerPop(nowMs: number): void {
    const session = this.session
    if (!session?.tryPop('player', nowMs)) return
    this.camera.getWorldDirection(this.fireDirection)
    this.fireOrigin
      .copy(this.camera.position)
      .addScaledVector(this.fireDirection, 0.55)
    this.arena.firePlayer(this.fireOrigin, this.fireDirection, session.playerProfile)
    sfx.shoot()
  }

  private rebuildViewmodel(blaster: Blaster): void {
    if (this.playerBuilt) {
      this.viewmodel.remove(this.playerBuilt.group)
      this.playerBuilt.dispose()
    }
    this.playerBuilt = buildBlaster(blaster, 'full')
    this.viewmodel.add(this.playerBuilt.group)
    fitBlasterViewmodel(blaster, this.playerBuilt.group)
  }

  private configureCamera(): void {
    this.camera.fov = 48
    this.camera.position.set(this.playerX, PLAYER_Y, PLAYER_Z)
    this.camera.quaternion.identity()
    this.camera.updateProjectionMatrix()
  }

  private resetInput(): void {
    this.firing = false
    this.movingLeft = false
    this.movingRight = false
  }

  private installInput(): void {
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.active || this.session?.phase !== 'playing') return
      const rect = this.canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
      this.targetYaw = -x * 0.48
      this.targetPitch = clamp(-y * 0.3, -0.28, 0.3)
    })
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.active || event.button !== 0 || this.session?.phase !== 'playing') return
      this.firing = true
      this.tryPlayerPop(performance.now())
    })
    window.addEventListener('pointerup', () => {
      if (this.active) this.firing = false
    })
    window.addEventListener('keydown', (event) => {
      if (!this.active) return
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.movingLeft = true
      if (event.code === 'KeyD' || event.code === 'ArrowRight') this.movingRight = true
      if (event.code === 'Space') {
        event.preventDefault()
        this.firing = true
        this.tryPlayerPop(performance.now())
      }
      if (event.code === 'Escape') this.callbacks.onCollection()
    })
    window.addEventListener('keyup', (event) => {
      if (!this.active) return
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.movingLeft = false
      if (event.code === 'KeyD' || event.code === 'ArrowRight') this.movingRight = false
      if (event.code === 'Space') this.firing = false
    })
  }
}

function profileFor(blaster: Blaster): PvpProfile {
  const stats = computeStats(blaster)
  const boreScale = boreScaleFromMorph(blaster.parts.barrel?.morph ?? {})
  return toPvpProfile(stats, toShotProfile(stats, boreScale))
}

function snapshotBlaster(source: Blaster): Blaster {
  const parts: Blaster['parts'] = {}
  for (const slot of Object.keys(source.parts) as SlotType[]) {
    const instance = source.parts[slot]
    if (instance) parts[slot] = snapshotInstance(instance)
  }
  return {
    id: source.id,
    name: source.name,
    createdAt: source.createdAt,
    parts,
  }
}

function snapshotInstance(source: PartInstance): PartInstance {
  const paint: PartInstance['paint'] = {}
  for (const zone of ['primary', 'secondary', 'accent'] as const) {
    const value = source.paint[zone]
    if (value) paint[zone] = { color: value.color, finish: value.finish }
  }
  return {
    partId: source.partId,
    paint,
    morph: { ...source.morph },
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
