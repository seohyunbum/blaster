// src/game/arenaField.ts — 로블록스식 아레나 FPS 무대(자체 완결).
// 여러 적 드론이 맵을 돌아다니고, 상자 엄폐물이 다트를 막는다. 사람·동물 형태 없음(08 가드레일).
// pvpArena.ts(1대1 드론태그, 테스트 보유)와 별개 모듈 — 그 파일은 건드리지 않는다.
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
import type { ProjectileKind } from './types.ts'

const OWNER_PLAYER = 0
const OWNER_ENEMY = 1
type Owner = typeof OWNER_PLAYER | typeof OWNER_ENEMY

const ARENA_HALF = 13
const ENEMY_COUNT = 4
const ENEMY_HP = 3
const ENEMY_HOVER_Y = 1.35
const ENEMY_SPEED = 2.4
const ENEMY_FIRE_MIN = 1.1
const ENEMY_FIRE_MAX = 2.2
const RESPAWN_SEC = 2.2
const PLAYER_HIT_RADIUS = 0.5
const ENEMY_HIT_RADIUS = 0.72
const PROJECTILE_TTL = 4
const GROUND_Y = 0
const DEFAULT_SEED = 0x6d2b79f5

interface Obstacle {
  cx: number
  cz: number
  hx: number // half width (x)
  hz: number // half depth (z)
  height: number
}

// 고정 엄폐물 배치 — 예측 가능하고 숨을 곳이 고르게. (앞쪽 −z 가 적 구역, +z 가 시작점)
const OBSTACLES: readonly Obstacle[] = [
  { cx: 0, cz: -3.5, hx: 2.2, hz: 0.5, height: 2.0 },
  { cx: -6, cz: -6.5, hx: 0.6, hz: 1.8, height: 2.2 },
  { cx: 6, cz: -6.5, hx: 0.6, hz: 1.8, height: 2.2 },
  { cx: -4.5, cz: 1.5, hx: 1.6, hz: 0.6, height: 1.7 },
  { cx: 4.5, cz: 1.5, hx: 1.6, hz: 0.6, height: 1.7 },
  { cx: 0, cz: -10, hx: 1.0, hz: 1.0, height: 2.4 },
]

class Enemy {
  readonly root = new THREE.Group()
  built: BuiltBlaster | null = null
  hp = ENEMY_HP
  alive = false
  respawnIn = 0
  fireIn = 0
  hitPulse = 0
  readonly pos = new THREE.Vector3()
  readonly target = new THREE.Vector3()
  bob = 0
  readonly energyRing: THREE.Mesh

  constructor(color: number) {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), fixedMaterial(color))
    this.root.add(core)
    const shell = new THREE.Mesh(
      new THREE.TorusGeometry(0.76, 0.08, 8, 18),
      fixedMaterial(TOY_PALETTE.pastelCream),
    )
    shell.rotation.x = Math.PI / 2
    this.root.add(shell)
    this.energyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.05, 8, 20),
      glowMaterial(TOY_PALETTE.blasterYellow),
    )
    this.energyRing.position.z = 0.48
    this.root.add(this.energyRing)
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
  kind: ProjectileKind
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

  private readonly enemies: Enemy[] = []
  private readonly pool: Projectile[] = []
  private readonly projectileVisual: { geometry: THREE.BufferGeometry; material: THREE.Material }
  private rngState = DEFAULT_SEED
  private killsThisFrame = 0
  private playerDamageThisFrame = 0
  private loadoutCursor = 0
  private difficulty = 1 // 스테이지가 올라갈수록 적이 조금씩 빨라짐

  private readonly scratchDir = new THREE.Vector3()
  private readonly sweepPrev: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCur: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCenter: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly velDir = new THREE.Vector3()
  private readonly forward = new THREE.Vector3(0, 0, 1)

  constructor() {
    this.group.name = 'arena-field'
    this.group.visible = false
    this.buildStage()

    const enemyColors = [
      TOY_PALETTE.blasterMagenta,
      TOY_PALETTE.blasterTeal,
      TOY_PALETTE.blasterPurple,
      TOY_PALETTE.blasterCoral,
    ]
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const enemy = new Enemy(enemyColors[i % enemyColors.length]!)
      this.enemies.push(enemy)
      this.group.add(enemy.root)
    }

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
        active: false,
        owner: OWNER_PLAYER,
        mesh,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gravity: PROJECTILE_GRAVITY.dart,
        radius: PROJECTILE_BASE_RADIUS.dart,
        ttl: 0,
        kind: 'dart',
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
    let n = 0
    for (const enemy of this.enemies) if (enemy.alive) n += 1
    return n
  }

  start(seed: number): void {
    this.reset()
    this.rngState = (seed >>> 0) || DEFAULT_SEED
    this.loadoutCursor = 0
    this.difficulty = 1
    for (const enemy of this.enemies) this.spawnEnemy(enemy)
    this.group.visible = true
  }

  /** 스테이지 난이도(적 속도·연사) 배율. 1=기본. */
  setDifficulty(mult: number): void {
    this.difficulty = mult > 0.5 ? mult : 1
  }

  reset(): void {
    for (const p of this.pool) {
      p.active = false
      p.mesh.visible = false
    }
    for (const enemy of this.enemies) {
      enemy.alive = false
      enemy.root.visible = false
      if (enemy.built) {
        enemy.root.remove(enemy.built.group)
        enemy.built.dispose()
        enemy.built = null
      }
    }
    this.killsThisFrame = 0
    this.playerDamageThisFrame = 0
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

  /** 플레이어 (x,z)를 아레나 경계·엄폐물 밖으로 밀어낸 좌표를 resolvedX/Z 에 쓴다. */
  resolvePlayer(x: number, z: number, radius: number): void {
    let px = clamp(x, -ARENA_HALF + radius, ARENA_HALF - radius)
    let pz = clamp(z, -ARENA_HALF + radius, ARENA_HALF - radius)
    for (const o of OBSTACLES) {
      const dx = px - o.cx
      const dz = pz - o.cz
      const ox = o.hx + radius - Math.abs(dx)
      const oz = o.hz + radius - Math.abs(dz)
      if (ox > 0 && oz > 0) {
        // 겹침 — 침투가 적은 축으로 밀어낸다
        if (ox < oz) px = o.cx + Math.sign(dx || 1) * (o.hx + radius)
        else pz = o.cz + Math.sign(dz || 1) * (o.hz + radius)
      }
    }
    this.resolvedX = px
    this.resolvedZ = pz
  }

  firePlayer(origin: THREE.Vector3, dir: THREE.Vector3, profile: PvpProfile): void {
    this.spawn(OWNER_PLAYER, origin.x, origin.y, origin.z, dir, profile)
  }

  update(dt: number, playerPos: THREE.Vector3, enemyProfile: PvpProfile): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        enemy.respawnIn -= dt
        if (enemy.respawnIn <= 0) this.spawnEnemy(enemy)
        continue
      }
      this.stepEnemy(enemy, dt, playerPos, enemyProfile)
    }
    this.stepProjectiles(dt, playerPos)
  }

  private stepEnemy(enemy: Enemy, dt: number, playerPos: THREE.Vector3, profile: PvpProfile): void {
    // 목표 지점으로 이동 (도착·타이머면 새 목표)
    const dx = enemy.target.x - enemy.pos.x
    const dz = enemy.target.z - enemy.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.4) this.pickWanderTarget(enemy)
    else {
      const step = Math.min(dist, ENEMY_SPEED * this.difficulty * dt)
      let nx = enemy.pos.x + (dx / dist) * step
      let nz = enemy.pos.z + (dz / dist) * step
      // 엄폐물에 부딪히면 목표 새로 뽑기(관통 방지)
      if (this.insideObstacle(nx, nz, 0.6)) {
        this.pickWanderTarget(enemy)
      } else {
        enemy.pos.x = clamp(nx, -ARENA_HALF + 1, ARENA_HALF - 1)
        enemy.pos.z = clamp(nz, -ARENA_HALF + 1, 4)
      }
    }
    enemy.bob += dt * 2.4
    enemy.root.position.set(enemy.pos.x, ENEMY_HOVER_Y + Math.sin(enemy.bob) * 0.14, enemy.pos.z)
    // 플레이어를 바라보게 (총구가 플레이어 향함)
    const toPlayer = Math.atan2(-(playerPos.x - enemy.pos.x), -(playerPos.z - enemy.pos.z))
    enemy.root.rotation.y = toPlayer
    if (enemy.hitPulse > 0) {
      enemy.hitPulse = Math.max(0, enemy.hitPulse - dt)
      enemy.root.scale.setScalar(1 + enemy.hitPulse * 0.8)
    } else {
      enemy.root.scale.setScalar(1)
    }
    // 발사
    enemy.fireIn -= dt
    if (enemy.fireIn <= 0) {
      enemy.fireIn = (ENEMY_FIRE_MIN + this.rand() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN)) / this.difficulty
      this.scratchDir
        .set(playerPos.x - enemy.pos.x, playerPos.y - (ENEMY_HOVER_Y), playerPos.z - enemy.pos.z)
        .normalize()
      this.spawn(OWNER_ENEMY, enemy.pos.x, ENEMY_HOVER_Y, enemy.pos.z, this.scratchDir, profile)
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
      // 엄폐물에 맞으면 막힘(숨을 수 있음)
      if (this.insideObstacle(p.pos.x, p.pos.z, p.radius) && p.pos.y < obstacleTopAt(p.pos.x, p.pos.z)) {
        done = true
      } else if (p.owner === OWNER_PLAYER) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue
          this.sweepCenter.x = enemy.pos.x
          this.sweepCenter.y = enemy.root.position.y
          this.sweepCenter.z = enemy.pos.z
          if (sweepHitSphere(this.sweepPrev, this.sweepCur, this.sweepCenter, ENEMY_HIT_RADIUS + p.radius)) {
            enemy.hp -= 1
            enemy.hitPulse = 0.16
            if (enemy.hp <= 0) this.killEnemy(enemy)
            done = true
            break
          }
        }
      } else {
        this.sweepCenter.x = playerPos.x
        this.sweepCenter.y = playerPos.y
        this.sweepCenter.z = playerPos.z
        if (sweepHitSphere(this.sweepPrev, this.sweepCur, this.sweepCenter, PLAYER_HIT_RADIUS + p.radius)) {
          this.playerDamageThisFrame += 1
          done = true
        }
      }

      if (
        done
        || p.ttl <= 0
        || p.pos.y < GROUND_Y - 0.5
        || Math.abs(p.pos.x) > ARENA_HALF + 3
        || Math.abs(p.pos.z) > ARENA_HALF + 3
      ) {
        p.active = false
        p.mesh.visible = false
      }
    }
  }

  private killEnemy(enemy: Enemy): void {
    enemy.alive = false
    enemy.root.visible = false
    enemy.respawnIn = RESPAWN_SEC
    this.killsThisFrame += 1
    if (enemy.built) {
      enemy.root.remove(enemy.built.group)
      enemy.built.dispose()
      enemy.built = null
    }
  }

  private spawnEnemy(enemy: Enemy): void {
    enemy.hp = ENEMY_HP
    enemy.alive = true
    enemy.fireIn = ENEMY_FIRE_MIN + this.rand() * (ENEMY_FIRE_MAX - ENEMY_FIRE_MIN)
    enemy.hitPulse = 0
    enemy.pos.set((this.rand() - 0.5) * (ARENA_HALF * 1.4), ENEMY_HOVER_Y, -3 - this.rand() * 8)
    this.pickWanderTarget(enemy)
    enemy.root.position.set(enemy.pos.x, ENEMY_HOVER_Y, enemy.pos.z)
    enemy.root.visible = true
    enemy.root.scale.setScalar(1)
    // 총 장착 (로드아웃 순환)
    const loadout = PVP_LOADOUTS[this.loadoutCursor % PVP_LOADOUTS.length]!
    this.loadoutCursor += 1
    const built = buildBlaster(loadout.blaster, 'full')
    const box = new THREE.Box3().setFromObject(built.group)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const span = Math.max(size.x, size.y, size.z, 0.001)
    const scale = Math.min(1, 1.0 / span)
    built.group.scale.setScalar(scale)
    built.group.position.set(-center.x * scale, -0.42 - center.y * scale, -center.z * scale - 0.5)
    enemy.built = built
    enemy.root.add(built.group)
  }

  private pickWanderTarget(enemy: Enemy): void {
    enemy.target.set(
      (this.rand() - 0.5) * (ARENA_HALF * 1.6),
      ENEMY_HOVER_Y,
      -1 - this.rand() * 10,
    )
  }

  private spawn(owner: Owner, x: number, y: number, z: number, dir: THREE.Vector3, profile: PvpProfile): void {
    let projectile: Projectile | undefined
    for (const candidate of this.pool) {
      if (!candidate.active) { projectile = candidate; break }
    }
    if (!projectile) {
      projectile = this.pool[0]!
      for (const c of this.pool) if (c.ttl < projectile.ttl) projectile = c
    }
    projectile.active = true
    projectile.owner = owner
    projectile.kind = 'dart'
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
    for (const o of OBSTACLES) {
      if (Math.abs(x - o.cx) < o.hx + radius && Math.abs(z - o.cz) < o.hz + radius) return true
    }
    return false
  }

  private buildStage(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_HALF + 4, 44),
      fixedMaterial(TOY_PALETTE.pastelMint),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = GROUND_Y
    this.group.add(ground)

    // 경계 벽 (낮은 링)
    const wall = new THREE.Mesh(
      new THREE.TorusGeometry(ARENA_HALF + 1.5, 0.5, 8, 44),
      fixedMaterial(TOY_PALETTE.pastelSky),
    )
    wall.rotation.x = Math.PI / 2
    wall.position.y = 0.5
    this.group.add(wall)

    // 엄폐물 상자들 (숨을 곳)
    const coverColors = [
      TOY_PALETTE.blasterBlue,
      TOY_PALETTE.blasterYellow,
      TOY_PALETTE.blasterCoral,
      TOY_PALETTE.blasterPurple,
      TOY_PALETTE.blasterTeal,
      TOY_PALETTE.pastelPeach,
    ]
    OBSTACLES.forEach((o, i) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(o.hx * 2, o.height, o.hz * 2),
        fixedMaterial(coverColors[i % coverColors.length]!),
      )
      box.position.set(o.cx, o.height / 2, o.cz)
      this.group.add(box)
    })
  }

  private rand(): number {
    this.rngState = xorShift(this.rngState)
    return this.rngState / 0x100000000
  }
}

function obstacleTopAt(x: number, z: number): number {
  let top = 0
  for (const o of OBSTACLES) {
    if (Math.abs(x - o.cx) < o.hx + 0.3 && Math.abs(z - o.cz) < o.hz + 0.3) top = Math.max(top, o.height)
  }
  return top
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
