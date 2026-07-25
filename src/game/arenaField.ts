// src/game/arenaField.ts — 로블록스식 아레나 FPS 무대(자체 완결).
// 스테이지마다 다른 맵 + 보스 드론(스테이지 오를수록 강함) + 로밍 잡몹 + 엄폐물(다트 차단).
// 사람·동물 형태 없음(08 가드레일). pvpArena.ts(테스트 보유)와 별개 모듈.
import * as THREE from 'three'
import { buildBlaster, type BuiltBlaster } from './assembly.ts'
import {
  PROJECTILE_BASE_RADIUS,
  PROJECTILE_GRAVITY,
  sweepHitSphere,
  type Vec3,
} from './ballistics.ts'
import { PERFORMANCE_BUDGETS } from './budgets.ts'
import { PROJECTILE_DEFS } from './definitions.ts'
import { fixedMaterial, glowMaterial } from './materials.ts'
import { TOY_PALETTE } from './palette.ts'
import { PVP_LOADOUTS } from './pvpLoadouts.ts'
import type { PvpProfile } from './pvpSession.ts'

const OWNER_PLAYER = 0
const OWNER_ENEMY = 1
type Owner = typeof OWNER_PLAYER | typeof OWNER_ENEMY

const ARENA_HALF = 13
const FODDER_COUNT = 3
const FODDER_HP = 3
const ENEMY_HOVER_Y = 1.35
const BOSS_HOVER_Y = 1.7
const ENEMY_SPEED = 2.4
const BOSS_SPEED = 1.7
const ENEMY_FIRE_MIN = 1.1
const ENEMY_FIRE_MAX = 2.2
const RESPAWN_SEC = 2.2
const PLAYER_HIT_RADIUS = 0.5
const FODDER_HIT_RADIUS = 0.72
const BOSS_HIT_RADIUS = 1.15
const ENEMY_RADIUS = 0.7 // 엄폐물 충돌 반경
const PROJECTILE_TTL = 4
const GROUND_Y = 0
const DEFAULT_SEED = 0x6d2b79f5

interface Obstacle {
  cx: number
  cz: number
  hx: number
  hz: number
  height: number
}

interface StageMap {
  ground: number
  wall: number
  cover: number
  obstacles: readonly Obstacle[]
}

// 스테이지별 맵 — 배치·색이 전부 다르다. (앞쪽 −z=적 구역, +z=시작점)
const STAGE_MAPS: readonly StageMap[] = [
  {
    ground: TOY_PALETTE.pastelMint, wall: TOY_PALETTE.pastelSky, cover: TOY_PALETTE.blasterBlue,
    obstacles: [
      { cx: 0, cz: -3.5, hx: 2.4, hz: 0.5, height: 2.0 },
      { cx: -6, cz: -7, hx: 0.6, hz: 1.8, height: 2.2 },
      { cx: 6, cz: -7, hx: 0.6, hz: 1.8, height: 2.2 },
      { cx: 0, cz: -10.5, hx: 1.0, hz: 1.0, height: 2.4 },
    ],
  },
  {
    ground: TOY_PALETTE.pastelPeach, wall: TOY_PALETTE.blasterOrange, cover: TOY_PALETTE.blasterYellow,
    obstacles: [
      { cx: -5, cz: -3, hx: 1.4, hz: 1.4, height: 2.1 },
      { cx: 5, cz: -3, hx: 1.4, hz: 1.4, height: 2.1 },
      { cx: -5, cz: -9, hx: 1.4, hz: 1.4, height: 2.1 },
      { cx: 5, cz: -9, hx: 1.4, hz: 1.4, height: 2.1 },
      { cx: 0, cz: -6, hx: 0.8, hz: 0.8, height: 1.6 },
    ],
  },
  {
    ground: TOY_PALETTE.pastelLavender, wall: TOY_PALETTE.blasterPurple, cover: TOY_PALETTE.blasterMagenta,
    obstacles: [
      { cx: -3.5, cz: -2, hx: 0.5, hz: 2.4, height: 2.2 },
      { cx: 3.5, cz: -5, hx: 0.5, hz: 2.4, height: 2.2 },
      { cx: -3.5, cz: -8, hx: 0.5, hz: 2.4, height: 2.2 },
      { cx: 3.5, cz: -11, hx: 0.5, hz: 2.0, height: 2.2 },
    ],
  },
  {
    ground: TOY_PALETTE.pastelSky, wall: TOY_PALETTE.blasterTeal, cover: TOY_PALETTE.blasterGreen,
    obstacles: [
      { cx: 0, cz: -6, hx: 2.6, hz: 0.5, height: 2.4 },
      { cx: -7, cz: -4, hx: 0.5, hz: 2.6, height: 2.4 },
      { cx: 7, cz: -4, hx: 0.5, hz: 2.6, height: 2.4 },
      { cx: -3, cz: -10, hx: 1.0, hz: 0.6, height: 1.8 },
      { cx: 3, cz: -10, hx: 1.0, hz: 0.6, height: 1.8 },
    ],
  },
  {
    ground: TOY_PALETTE.pastelPink, wall: TOY_PALETTE.blasterCoral, cover: TOY_PALETTE.blasterRed,
    obstacles: [
      { cx: -6, cz: -3, hx: 0.9, hz: 0.9, height: 2.6 },
      { cx: 6, cz: -3, hx: 0.9, hz: 0.9, height: 2.6 },
      { cx: 0, cz: -6, hx: 1.6, hz: 1.6, height: 2.0 },
      { cx: -6, cz: -10, hx: 0.9, hz: 0.9, height: 2.6 },
      { cx: 6, cz: -10, hx: 0.9, hz: 0.9, height: 2.6 },
    ],
  },
]

class Drone {
  readonly root = new THREE.Group()
  built: BuiltBlaster | null = null
  hp = FODDER_HP
  maxHp = FODDER_HP
  alive = false
  respawnIn = 0
  fireIn = 0
  hitPulse = 0
  readonly pos = new THREE.Vector3()
  readonly target = new THREE.Vector3()
  bob = 0
  hoverY = ENEMY_HOVER_Y
  hitRadius = FODDER_HIT_RADIUS
  isBoss = false

  constructor(color: number, boss: boolean) {
    this.isBoss = boss
    const r = boss ? 1.05 : 0.6
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), fixedMaterial(color))
    this.root.add(core)
    const shell = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.28, r * 0.13, 8, 20),
      fixedMaterial(TOY_PALETTE.pastelCream),
    )
    shell.rotation.x = Math.PI / 2
    this.root.add(shell)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.12, r * 0.08, 8, 20),
      glowMaterial(boss ? TOY_PALETTE.blasterRed : TOY_PALETTE.blasterYellow),
    )
    ring.position.z = r * 0.8
    this.root.add(ring)
    if (boss) {
      // 왕관(보스 표시)
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.5, r * 0.7, r * 0.5, 6),
        fixedMaterial(TOY_PALETTE.toyGold),
      )
      crown.position.y = r * 1.1
      this.root.add(crown)
      this.hoverY = BOSS_HOVER_Y
      this.hitRadius = BOSS_HIT_RADIUS
    }
    this.root.visible = false
  }
}

interface Projectile {
  active: boolean
  owner: Owner
  mesh: THREE.Mesh
  prev: THREE.Vector3
  pos: THREE.Vector3
  vel: THREE.Vector3
  gravity: number
  radius: number
  ttl: number
}

function xorShift(state: number): number {
  let value = state >>> 0 || DEFAULT_SEED
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return value >>> 0
}

export class ArenaField {
  readonly group = new THREE.Group()
  resolvedX = 0
  resolvedZ = 0

  private readonly fodder: Drone[] = []
  private readonly boss: Drone
  private readonly pool: Projectile[] = []
  private readonly projectileVisual: { geometry: THREE.BufferGeometry; material: THREE.Material }
  private readonly obstacleGroup = new THREE.Group()
  private readonly ground: THREE.Mesh
  private readonly wall: THREE.Mesh
  private obstacles: readonly Obstacle[] = STAGE_MAPS[0]!.obstacles
  private readonly obstacleMeshes: THREE.Mesh[] = []

  private rngState = DEFAULT_SEED
  private killsThisFrame = 0
  private playerDamageThisFrame = 0
  private bossDownThisFrame = false
  private loadoutCursor = 0
  private difficulty = 1

  private rcX = 0
  private rcZ = 0
  private readonly scratchDir = new THREE.Vector3()
  private readonly sweepPrev: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCur: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCenter: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly velDir = new THREE.Vector3()
  private readonly forward = new THREE.Vector3(0, 0, 1)

  constructor() {
    this.group.name = 'arena-field'
    this.group.visible = false

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_HALF + 4, 44),
      fixedMaterial(STAGE_MAPS[0]!.ground),
    )
    this.ground.rotation.x = -Math.PI / 2
    this.group.add(this.ground)
    this.wall = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_HALF + 1.5, 0.5, 8, 44),
      fixedMaterial(STAGE_MAPS[0]!.wall),
    )
    this.wall.rotation.x = Math.PI / 2
    this.wall.position.y = 0.5
    this.group.add(this.wall)
    this.group.add(this.obstacleGroup)

    const fodderColors = [TOY_PALETTE.blasterMagenta, TOY_PALETTE.blasterTeal, TOY_PALETTE.blasterPurple]
    for (let i = 0; i < FODDER_COUNT; i++) {
      const d = new Drone(fodderColors[i % fodderColors.length]!, false)
      this.fodder.push(d)
      this.group.add(d.root)
    }
    this.boss = new Drone(TOY_PALETTE.blasterCoral, true)
    this.group.add(this.boss.root)

    const def = PROJECTILE_DEFS.dart
    this.projectileVisual = {
      geometry: new THREE.CapsuleGeometry(0.5, 0.9, 4, 8).rotateX(Math.PI / 2),
      material: fixedMaterial(def.color),
    }
    for (let i = 0; i < PERFORMANCE_BUDGETS.projectilePool; i++) {
      const mesh = new THREE.Mesh(this.projectileVisual.geometry, this.projectileVisual.material)
      mesh.visible = false
      this.group.add(mesh)
      this.pool.push({
        active: false, owner: OWNER_PLAYER, mesh,
        prev: new THREE.Vector3(), pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        gravity: PROJECTILE_GRAVITY.dart, radius: PROJECTILE_BASE_RADIUS.dart, ttl: 0,
      })
    }
  }

  get visible(): boolean {
    return this.group.visible
  }
  set visible(value: boolean) {
    this.group.visible = value
  }

  get aliveEnemies(): number {
    let n = this.boss.alive ? 1 : 0
    for (const d of this.fodder) if (d.alive) n += 1
    return n
  }

  get bossHealth(): number {
    return Math.max(0, this.boss.hp)
  }
  get bossMaxHealth(): number {
    return this.boss.maxHp
  }

  start(seed: number): void {
    this.reset()
    this.rngState = (seed >>> 0) || DEFAULT_SEED
    this.loadoutCursor = 0
    this.applyStage(1)
    this.group.visible = true
  }

  /** 스테이지 진입 — 맵 교체 + 보스(스테이지 오를수록 강함) 소환 + 잡몹 재배치. */
  setStage(stage: number): void {
    this.applyStage(stage)
  }

  setDifficulty(mult: number): void {
    this.difficulty = mult > 0.5 ? mult : 1
  }

  reset(): void {
    for (const p of this.pool) { p.active = false; p.mesh.visible = false }
    for (const d of this.fodder) this.despawn(d)
    this.despawn(this.boss)
    this.killsThisFrame = 0
    this.playerDamageThisFrame = 0
    this.bossDownThisFrame = false
  }

  consumeKills(): number {
    const n = this.killsThisFrame
    this.killsThisFrame = 0
    return n
  }
  consumePlayerDamage(): number {
    const n = this.playerDamageThisFrame
    this.playerDamageThisFrame = 0
    return n
  }
  consumeBossDown(): boolean {
    const v = this.bossDownThisFrame
    this.bossDownThisFrame = false
    return v
  }

  resolvePlayer(x: number, z: number, radius: number): void {
    this.resolveCircle(x, z, radius)
    this.resolvedX = this.rcX
    this.resolvedZ = this.rcZ
  }

  firePlayer(origin: THREE.Vector3, dir: THREE.Vector3, profile: PvpProfile): void {
    this.spawn(OWNER_PLAYER, origin.x, origin.y, origin.z, dir, profile)
  }

  update(dt: number, playerPos: THREE.Vector3, enemyProfile: PvpProfile): void {
    for (const d of this.fodder) {
      if (!d.alive) {
        d.respawnIn -= dt
        if (d.respawnIn <= 0) this.spawnFodder(d)
        continue
      }
      this.stepDrone(d, dt, playerPos, enemyProfile)
    }
    if (this.boss.alive) this.stepDrone(this.boss, dt, playerPos, enemyProfile)
    this.stepProjectiles(dt, playerPos)
  }

  private stepDrone(d: Drone, dt: number, playerPos: THREE.Vector3, profile: PvpProfile): void {
    const speed = (d.isBoss ? BOSS_SPEED : ENEMY_SPEED) * this.difficulty
    const dx = d.target.x - d.pos.x
    const dz = d.target.z - d.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.5) {
      this.pickWanderTarget(d)
    } else {
      const step = Math.min(dist, speed * dt)
      const nx = d.pos.x + (dx / dist) * step
      const nz = d.pos.z + (dz / dist) * step
      // 엄폐물 밖으로 밀어냄 → 벽에 끼지 않는다
      this.resolveCircle(nx, nz, ENEMY_RADIUS)
      d.pos.x = clamp(this.rcX, -ARENA_HALF + 1, ARENA_HALF - 1)
      d.pos.z = clamp(this.rcZ, -ARENA_HALF + 1, 4)
      // 밀려나서 거의 안 움직였으면(막힘) 새 목표
      if (Math.hypot(d.pos.x - nx, d.pos.z - nz) > 0.05 || Math.hypot(dx, dz) < 0.6) {
        this.pickWanderTarget(d)
      }
    }
    d.bob += dt * 2.4
    d.root.position.set(d.pos.x, d.hoverY + Math.sin(d.bob) * 0.14, d.pos.z)
    d.root.rotation.y = Math.atan2(-(playerPos.x - d.pos.x), -(playerPos.z - d.pos.z))
    if (d.hitPulse > 0) {
      d.hitPulse = Math.max(0, d.hitPulse - dt)
      d.root.scale.setScalar(1 + d.hitPulse * 0.6)
    } else {
      d.root.scale.setScalar(1)
    }
    d.fireIn -= dt
    if (d.fireIn <= 0) {
      const base = ENEMY_FIRE_MIN + this.rand() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN)
      d.fireIn = (d.isBoss ? base * 0.6 : base) / this.difficulty
      this.scratchDir.set(playerPos.x - d.pos.x, playerPos.y - d.hoverY, playerPos.z - d.pos.z).normalize()
      this.spawn(OWNER_ENEMY, d.pos.x, d.hoverY, d.pos.z, this.scratchDir, profile)
    }
  }

  private stepProjectiles(dt: number, playerPos: THREE.Vector3): void {
    for (const p of this.pool) {
      if (!p.active) continue
      p.prev.copy(p.pos)
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      p.ttl -= dt
      p.mesh.position.copy(p.pos)
      this.velDir.copy(p.vel).normalize()
      p.mesh.quaternion.setFromUnitVectors(this.forward, this.velDir)

      this.sweepPrev.x = p.prev.x; this.sweepPrev.y = p.prev.y; this.sweepPrev.z = p.prev.z
      this.sweepCur.x = p.pos.x; this.sweepCur.y = p.pos.y; this.sweepCur.z = p.pos.z

      let done = false
      if (this.insideObstacle(p.pos.x, p.pos.z, p.radius) && p.pos.y < this.obstacleTopAt(p.pos.x, p.pos.z)) {
        done = true
      } else if (p.owner === OWNER_PLAYER) {
        if (this.boss.alive && this.hitDrone(this.boss, p)) {
          this.boss.hp -= 1
          this.boss.hitPulse = 0.16
          if (this.boss.hp <= 0) { this.despawn(this.boss); this.bossDownThisFrame = true; this.killsThisFrame += 1 }
          done = true
        }
        if (!done) {
          for (const d of this.fodder) {
            if (!d.alive) continue
            if (this.hitDrone(d, p)) {
              d.hp -= 1
              d.hitPulse = 0.16
              if (d.hp <= 0) { this.despawn(d); d.respawnIn = RESPAWN_SEC; this.killsThisFrame += 1 }
              done = true
              break
            }
          }
        }
      } else {
        this.sweepCenter.x = playerPos.x; this.sweepCenter.y = playerPos.y; this.sweepCenter.z = playerPos.z
        if (sweepHitSphere(this.sweepPrev, this.sweepCur, this.sweepCenter, PLAYER_HIT_RADIUS + p.radius)) {
          this.playerDamageThisFrame += 1
          done = true
        }
      }

      if (done || p.ttl <= 0 || p.pos.y < GROUND_Y - 0.5
        || Math.abs(p.pos.x) > ARENA_HALF + 3 || Math.abs(p.pos.z) > ARENA_HALF + 3) {
        p.active = false
        p.mesh.visible = false
      }
    }
  }

  private hitDrone(d: Drone, p: Projectile): boolean {
    this.sweepCenter.x = d.pos.x
    this.sweepCenter.y = d.root.position.y
    this.sweepCenter.z = d.pos.z
    return sweepHitSphere(this.sweepPrev, this.sweepCur, this.sweepCenter, d.hitRadius + p.radius)
  }

  private applyStage(stage: number): void {
    const map = STAGE_MAPS[(stage - 1) % STAGE_MAPS.length]!
    this.obstacles = map.obstacles
    // 맵(엄폐물) 재구축 + 색 교체
    for (const m of this.obstacleMeshes) {
      this.obstacleGroup.remove(m)
      m.geometry.dispose()
    }
    this.obstacleMeshes.length = 0
    for (const o of map.obstacles) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(o.hx * 2, o.height, o.hz * 2), fixedMaterial(map.cover))
      box.position.set(o.cx, o.height / 2, o.cz)
      this.obstacleGroup.add(box)
      this.obstacleMeshes.push(box)
    }
    this.ground.material = fixedMaterial(map.ground)
    this.wall.material = fixedMaterial(map.wall)
    // 잡몹 리셋
    for (const d of this.fodder) this.spawnFodder(d)
    // 보스 — 스테이지 오를수록 강함
    this.spawnBoss(stage)
  }

  private spawnFodder(d: Drone): void {
    d.maxHp = FODDER_HP
    d.hp = FODDER_HP
    d.alive = true
    d.fireIn = ENEMY_FIRE_MIN + this.rand() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN)
    d.hitPulse = 0
    this.placeDrone(d, ENEMY_HOVER_Y)
    this.mountWeapon(d, 0.9)
  }

  private spawnBoss(stage: number): void {
    const b = this.boss
    b.maxHp = 6 + stage * 3 // 스테이지 오를수록 체력↑
    b.hp = b.maxHp
    b.alive = true
    b.fireIn = 0.9 + this.rand() * 0.8
    b.hitPulse = 0
    this.placeDrone(b, BOSS_HOVER_Y)
    this.mountWeapon(b, 1.4)
  }

  private placeDrone(d: Drone, hoverY: number): void {
    let x = 0
    let z = -4
    for (let i = 0; i < 8; i++) {
      x = (this.rand() - 0.5) * (ARENA_HALF * 1.3)
      z = -3 - this.rand() * 8
      if (!this.insideObstacle(x, z, ENEMY_RADIUS + 0.3)) break
    }
    d.pos.set(x, hoverY, z)
    this.pickWanderTarget(d)
    d.root.position.set(x, hoverY, z)
    d.root.visible = true
    d.root.scale.setScalar(1)
  }

  private mountWeapon(d: Drone, scaleTarget: number): void {
    if (d.built) { d.root.remove(d.built.group); d.built.dispose(); d.built = null }
    const loadout = PVP_LOADOUTS[this.loadoutCursor % PVP_LOADOUTS.length]!
    this.loadoutCursor += 1
    const built = buildBlaster(loadout.blaster, 'full')
    const box = new THREE.Box3().setFromObject(built.group)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const span = Math.max(size.x, size.y, size.z, 0.001)
    const scale = Math.min(1.4, scaleTarget / span)
    built.group.scale.setScalar(scale)
    built.group.position.set(-center.x * scale, -0.42 * (d.isBoss ? 1.6 : 1) - center.y * scale, -center.z * scale - 0.5)
    d.built = built
    d.root.add(built.group)
  }

  private despawn(d: Drone): void {
    d.alive = false
    d.root.visible = false
    if (d.built) { d.root.remove(d.built.group); d.built.dispose(); d.built = null }
  }

  private pickWanderTarget(d: Drone): void {
    for (let i = 0; i < 8; i++) {
      const x = (this.rand() - 0.5) * (ARENA_HALF * 1.5)
      const z = -1 - this.rand() * 10
      if (!this.insideObstacle(x, z, ENEMY_RADIUS + 0.4)) {
        d.target.set(x, d.hoverY, z)
        return
      }
    }
    d.target.set((this.rand() - 0.5) * 6, d.hoverY, -6)
  }

  private spawn(owner: Owner, x: number, y: number, z: number, dir: THREE.Vector3, profile: PvpProfile): void {
    let projectile: Projectile | undefined
    for (const c of this.pool) { if (!c.active) { projectile = c; break } }
    if (!projectile) {
      projectile = this.pool[0]!
      for (const c of this.pool) if (c.ttl < projectile.ttl) projectile = c
    }
    projectile.active = true
    projectile.owner = owner
    projectile.gravity = PROJECTILE_GRAVITY.dart
    projectile.radius = PROJECTILE_BASE_RADIUS.dart * profile.projectileScale
    projectile.ttl = PROJECTILE_TTL
    projectile.pos.set(x, y, z)
    projectile.prev.set(x, y, z)
    projectile.vel.copy(dir).normalize().multiplyScalar(profile.muzzleVelocity)
    projectile.mesh.position.set(x, y, z)
    projectile.mesh.scale.setScalar(Math.max(0.05, projectile.radius))
    projectile.mesh.visible = true
  }

  private insideObstacle(x: number, z: number, radius: number): boolean {
    for (const o of this.obstacles) {
      if (Math.abs(x - o.cx) < o.hx + radius && Math.abs(z - o.cz) < o.hz + radius) return true
    }
    return false
  }

  private obstacleTopAt(x: number, z: number): number {
    let top = 0
    for (const o of this.obstacles) {
      if (Math.abs(x - o.cx) < o.hx + 0.3 && Math.abs(z - o.cz) < o.hz + 0.3) top = Math.max(top, o.height)
    }
    return top
  }

  /** (x,z)를 경계·엄폐물 밖으로 밀어낸 좌표를 rcX/rcZ 에 쓴다. */
  private resolveCircle(x: number, z: number, radius: number): void {
    let px = clamp(x, -ARENA_HALF + radius, ARENA_HALF - radius)
    let pz = clamp(z, -ARENA_HALF + radius, ARENA_HALF - radius)
    for (const o of this.obstacles) {
      const dx = px - o.cx
      const dz = pz - o.cz
      const ox = o.hx + radius - Math.abs(dx)
      const oz = o.hz + radius - Math.abs(dz)
      if (ox > 0 && oz > 0) {
        if (ox < oz) px = o.cx + Math.sign(dx || 1) * (o.hx + radius)
        else pz = o.cz + Math.sign(dz || 1) * (o.hz + radius)
      }
    }
    this.rcX = px
    this.rcZ = pz
  }

  private rand(): number {
    this.rngState = xorShift(this.rngState)
    return this.rngState / 0x100000000
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
