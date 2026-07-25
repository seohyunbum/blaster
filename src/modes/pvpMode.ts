// src/modes/pvpMode.ts — 아레나 FPS PVP: WASD 자유 이동 + 마우스 자유 시야 + 여러 적 로밍 + 엄폐물.
// 무대·물리는 game/arenaField.ts(신규, 자체 완결). 협업자의 pvpArena/pvpSession/pvpHud 는 로비만 재사용.
import * as THREE from 'three'
import { ArenaField } from '../game/arenaField.ts'
import { buildBlaster, type BuiltBlaster } from '../game/assembly.ts'
import { sfx } from '../game/audio.ts'
import { toShotProfile } from '../game/ballistics.ts'
import { boreScaleFromMorph } from '../game/morph.ts'
import { computeStats } from '../game/parts.ts'
import { PVP_LOADOUTS } from '../game/pvpLoadouts.ts'
import { toPvpProfile, type PvpProfile } from '../game/pvpSession.ts'
import type { Blaster, PartInstance, SlotType } from '../game/types.ts'
import { fitBlasterViewmodel } from '../game/viewmodel.ts'
import { createPvpHud } from '../ui/pvpHud.ts'

const PLAYER_Y = 1.45
const PLAYER_START_Z = 9
const PLAYER_RADIUS = 0.45
const LOOK_SENSITIVITY = 0.0024
const PITCH_LIMIT = 1.2
const STAGE_COUNT = 5
const POPS_PER_STAGE = 3
const START_HEALTH = 10

export interface PvpModeCallbacks {
  onSelectBlaster: (blasterId: string) => void
  onCollection: () => void
  /** 5스테이지 전부 클리어 시 — 연승 +1 하고 만들기 화면으로. */
  onClearRun: () => void
}

export interface PvpModeOptions {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  hudHost: HTMLElement
  callbacks: PvpModeCallbacks
}

type Phase = 'lobby' | 'playing' | 'won' | 'lost'

export class PvpMode {
  private readonly camera: THREE.PerspectiveCamera
  private readonly canvas: HTMLCanvasElement
  private readonly callbacks: PvpModeCallbacks
  private readonly arena = new ArenaField()
  private readonly viewmodel = new THREE.Group()
  private readonly hudRoot = document.createElement('div')
  private readonly hud
  private readonly enemyProfile: PvpProfile

  private readonly aimEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly fireOrigin = new THREE.Vector3()
  private readonly fireDir = new THREE.Vector3()

  // 아레나 HUD (자체 DOM — 협업자 pvpHud 전투/결과 화면과 분리)
  private readonly arenaHud: HTMLElement
  private readonly statusEl: HTMLElement
  private readonly outcomeEl: HTMLElement
  private readonly outcomeTitle: HTMLElement
  private readonly outcomeDetail: HTMLElement

  private ownedBlasters: readonly Blaster[] = []
  private selectedId: string | null = null
  private playerBuilt: BuiltBlaster | null = null
  private playerProfile: PvpProfile | null = null
  private phase: Phase = 'lobby'
  private active = false

  private firing = false
  private moveF = false
  private moveB = false
  private moveL = false
  private moveR = false
  private pointerLocked = false
  private targetYaw = 0
  private targetPitch = 0
  private aimYaw = 0
  private aimPitch = 0
  private playerX = 0
  private playerZ = PLAYER_START_Z
  private health = START_HEALTH
  private kills = 0
  private stage = 1
  private stagePops = 0
  private nextFireAt = 0

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
      onNext: () => {},
      onRetry: () => {},
      onCollection: () => this.callbacks.onCollection(),
    })
    this.hud.setVisible(false)

    // ── 아레나 HUD DOM (인라인 스타일, 자체 완결) ──
    this.arenaHud = document.createElement('div')
    this.arenaHud.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:20;display:none;font-family:system-ui,sans-serif'
    const cross = document.createElement('div')
    cross.style.cssText =
      'position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 3px rgba(0,0,0,.5)'
    this.statusEl = document.createElement('div')
    this.statusEl.style.cssText =
      'position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(30,60,90,.72);color:#fff;font-weight:700;font-size:17px;padding:8px 18px;border-radius:999px'
    this.outcomeEl = document.createElement('div')
    this.outcomeEl.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(20,40,70,.45);pointer-events:auto'
    const card = document.createElement('div')
    card.style.cssText =
      'background:#fff;border-radius:22px;padding:26px 30px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);max-width:340px'
    this.outcomeTitle = document.createElement('h2')
    this.outcomeTitle.style.cssText = 'margin:0 0 8px;font-size:26px;color:#2f7fe8'
    this.outcomeDetail = document.createElement('p')
    this.outcomeDetail.style.cssText = 'margin:0 0 18px;font-size:15px;color:#555'
    const retry = mkButton('다시 도전!', '#ff8a2b', () => this.retry(performance.now()))
    const back = mkButton('보관함으로', '#8aa0b8', () => this.callbacks.onCollection())
    card.append(this.outcomeTitle, this.outcomeDetail, retry, back)
    this.outcomeEl.appendChild(card)
    this.arenaHud.append(cross, this.statusEl, this.outcomeEl)
    options.hudHost.appendChild(this.arenaHud)

    this.enemyProfile = profileFor(PVP_LOADOUTS[0]!.blaster)
    this.installInput()
  }

  enter(blasters: readonly Blaster[], activeId: string | null): void {
    this.active = true
    this.ownedBlasters = blasters
    this.selectedId = activeId
    this.phase = 'lobby'
    this.resetInput()
    this.arena.reset()
    this.arena.visible = true
    this.viewmodel.visible = false
    this.arenaHud.style.display = 'none'
    this.configureCamera()
    this.hud.setVisible(true)
    this.hud.showLobby(blasters, activeId)
  }

  leave(): void {
    this.active = false
    this.phase = 'lobby'
    this.resetInput()
    this.arena.reset()
    this.arena.visible = false
    this.viewmodel.visible = false
    this.hud.setVisible(false)
    this.arenaHud.style.display = 'none'
  }

  update(dt: number, nowMs: number): void {
    if (!this.active || this.phase !== 'playing') return
    const profile = this.playerProfile
    if (!profile) return

    // 마우스 시야 즉시 반영
    this.aimYaw = this.targetYaw
    this.aimPitch = clamp(this.targetPitch, -PITCH_LIMIT, PITCH_LIMIT)

    // WASD 이동 (보는 방향 기준) + 엄폐물/경계 충돌
    const forward = (this.moveF ? 1 : 0) - (this.moveB ? 1 : 0)
    const strafe = (this.moveR ? 1 : 0) - (this.moveL ? 1 : 0)
    if (forward !== 0 || strafe !== 0) {
      const speed = Math.max(3, profile.strafeSpeed * 1.6)
      const sinY = Math.sin(this.aimYaw)
      const cosY = Math.cos(this.aimYaw)
      const mx = forward * -sinY + strafe * cosY
      const mz = forward * -cosY + strafe * -sinY
      const len = Math.hypot(mx, mz) || 1
      const nx = this.playerX + (mx / len) * speed * dt
      const nz = this.playerZ + (mz / len) * speed * dt
      this.arena.resolvePlayer(nx, nz, PLAYER_RADIUS)
      this.playerX = this.arena.resolvedX
      this.playerZ = this.arena.resolvedZ
    }
    this.camera.position.set(this.playerX, PLAYER_Y, this.playerZ)
    this.aimEuler.set(this.aimPitch, this.aimYaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(this.aimEuler)

    // 발사 (연사 간격)
    if (this.firing && nowMs >= this.nextFireAt) {
      this.nextFireAt = nowMs + Math.max(90, profile.fireIntervalMs)
      this.camera.getWorldDirection(this.fireDir)
      this.fireOrigin.copy(this.camera.position).addScaledVector(this.fireDir, 0.55)
      this.arena.firePlayer(this.fireOrigin, this.fireDir, profile)
      sfx.shoot()
    }

    this.arena.update(dt, this.camera.position, this.enemyProfile)

    const dmg = this.arena.consumePlayerDamage()
    if (dmg > 0) {
      this.health = Math.max(0, this.health - dmg)
      sfx.pop()
    }
    const newKills = this.arena.consumeKills()
    if (newKills > 0) {
      this.kills += newKills
      sfx.pop()
      for (let i = 0; i < newKills && this.phase === 'playing'; i++) this.registerPop()
    }
    this.renderStatus()

    if (this.phase === 'playing' && this.health <= 0) this.endMatch()
  }

  /** 적 1기 팝 처리 — 스테이지 진행. 스테이지당 POPS_PER_STAGE 팝, 5스테이지 다 하면 클리어. */
  private registerPop(): void {
    this.stagePops += 1
    if (this.stagePops < POPS_PER_STAGE) return
    this.stagePops = 0
    this.stage += 1
    if (this.stage > STAGE_COUNT) {
      this.clearRun()
      return
    }
    // 스테이지 클리어 — 체력 +2 보상 + 적이 조금 더 세짐
    this.health = Math.min(START_HEALTH, this.health + 2)
    this.arena.setDifficulty(1 + (this.stage - 1) * 0.14)
    sfx.star()
  }

  private clearRun(): void {
    this.phase = 'won'
    this.firing = false
    if (this.pointerLocked && document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.arenaHud.style.display = 'none'
    sfx.star()
    this.callbacks.onClearRun() // 연승 +1 + 만들기 화면으로 (main 이 처리)
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
      phase: this.phase,
      round: 1,
      playerHealth: this.health,
      rivalHealth: this.arena.aliveEnemies,
      selectedId: this.selectedId,
    }
  }

  private startMatch(blasterId: string, nowMs: number): void {
    const selected = this.ownedBlasters.find((b) => b.id === blasterId)
    if (!selected) return
    this.selectedId = selected.id
    this.callbacks.onSelectBlaster(selected.id)
    const snap = snapshotBlaster(selected)
    this.playerProfile = profileFor(snap)
    this.rebuildViewmodel(snap)

    this.health = START_HEALTH
    this.kills = 0
    this.stage = 1
    this.stagePops = 0
    this.playerX = 0
    this.playerZ = PLAYER_START_Z
    this.targetYaw = 0
    this.targetPitch = 0
    this.aimYaw = 0
    this.aimPitch = 0
    this.nextFireAt = nowMs
    this.phase = 'playing'
    this.arena.start(0x51f15e + this.kills)
    this.configureCamera()
    this.viewmodel.visible = true
    this.hud.setVisible(false)
    this.arenaHud.style.display = ''
    this.outcomeEl.style.display = 'none'
    this.renderStatus()
  }

  private retry(nowMs: number): void {
    if (this.selectedId) this.startMatch(this.selectedId, nowMs)
  }

  private endMatch(): void {
    // 패배 (체력 0)
    this.phase = 'lost'
    this.firing = false
    if (this.pointerLocked && document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.outcomeEl.style.display = 'flex'
    this.outcomeTitle.textContent = '체력이 다 됐어요'
    this.outcomeDetail.textContent = `스테이지 ${this.stage}에서 멈췄어요. 엄폐물 뒤에 숨으며 다시 도전!`
  }

  private renderStatus(): void {
    this.statusEl.textContent =
      `❤️ ${this.health} · 스테이지 ${this.stage}/${STAGE_COUNT} · 팝 ${this.stagePops}/${POPS_PER_STAGE} · 적 ${this.arena.aliveEnemies}`
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
    this.camera.fov = 52
    this.camera.position.set(this.playerX, PLAYER_Y, this.playerZ)
    this.camera.quaternion.identity()
    this.camera.updateProjectionMatrix()
  }

  private resetInput(): void {
    this.firing = false
    this.moveF = this.moveB = this.moveL = this.moveR = false
    if (this.pointerLocked && document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  private installInput(): void {
    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.active || this.phase !== 'playing') return
      if (this.pointerLocked) {
        this.targetYaw -= event.movementX * LOOK_SENSITIVITY
        this.targetPitch = clamp(this.targetPitch - event.movementY * LOOK_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT)
      } else {
        const rect = this.canvas.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
        const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1
        this.targetYaw = -x * 0.7
        this.targetPitch = clamp(-y * 0.4, -PITCH_LIMIT, PITCH_LIMIT)
      }
    })
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.active || event.button !== 0 || this.phase !== 'playing') return
      if (!this.pointerLocked && this.canvas.requestPointerLock) this.canvas.requestPointerLock()
      this.firing = true
    })
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
    })
    window.addEventListener('pointerup', () => {
      if (this.active) this.firing = false
    })
    window.addEventListener('keydown', (event) => {
      if (!this.active || this.phase !== 'playing') return
      if (event.code === 'KeyW' || event.code === 'ArrowUp') this.moveF = true
      if (event.code === 'KeyS' || event.code === 'ArrowDown') this.moveB = true
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.moveL = true
      if (event.code === 'KeyD' || event.code === 'ArrowRight') this.moveR = true
      if (event.code === 'Space') {
        event.preventDefault()
        this.firing = true
      }
    })
    window.addEventListener('keyup', (event) => {
      if (!this.active) return
      if (event.code === 'KeyW' || event.code === 'ArrowUp') this.moveF = false
      if (event.code === 'KeyS' || event.code === 'ArrowDown') this.moveB = false
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') this.moveL = false
      if (event.code === 'KeyD' || event.code === 'ArrowRight') this.moveR = false
      if (event.code === 'Space') this.firing = false
    })
  }
}

function mkButton(label: string, color: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.style.cssText =
    `display:block;width:100%;margin:6px 0;padding:11px;border:0;border-radius:14px;background:${color};color:#fff;font-weight:700;font-size:15px;cursor:pointer`
  b.addEventListener('click', onClick)
  return b
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
  return { id: source.id, name: source.name, createdAt: source.createdAt, parts }
}

function snapshotInstance(source: PartInstance): PartInstance {
  const paint: PartInstance['paint'] = {}
  for (const zone of ['primary', 'secondary', 'accent'] as const) {
    const value = source.paint[zone]
    if (value) paint[zone] = { color: value.color, finish: value.finish }
  }
  return { partId: source.partId, paint, morph: { ...source.morph } }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
