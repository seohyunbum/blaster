// src/game/pvpArena.ts — 밝은 드론 태그전 무대와 양방향 투사체 물리.
// 사람·동물 형태 없이 무표정 구형 드론만 표시하며, update 핫패스는 선할당 상태만 갱신한다.
import * as THREE from 'three'
import { buildBlaster, type BuiltBlaster } from './assembly.ts'
import {
  PROJECTILE_BASE_RADIUS,
  PROJECTILE_GRAVITY,
  sweepHitSphere,
  type Vec3,
} from './ballistics.ts'
import { PERFORMANCE_BUDGETS } from './budgets.ts'
import { PROJECTILE_DEFS, PROJECTILE_KINDS } from './definitions.ts'
import { fixedMaterial, glowMaterial } from './materials.ts'
import { TOY_PALETTE } from './palette.ts'
import type { PvpProfile } from './pvpSession.ts'
import type { Blaster, ProjectileKind } from './types.ts'

const OWNER_PLAYER = 0
const OWNER_RIVAL = 1
type ProjectileOwner = typeof OWNER_PLAYER | typeof OWNER_RIVAL

const GROUND_Y = 0
const PLAYER_HIT_RADIUS = 0.48
const RIVAL_HIT_RADIUS = 0.72
const PROJECTILE_TTL_SEC = 4
const ARENA_LIMIT = 32
const DEFAULT_SEED = 0x6d2b79f5

interface PooledProjectile {
  active: boolean
  owner: ProjectileOwner
  mesh: THREE.Mesh
  prev: THREE.Vector3
  pos: THREE.Vector3
  vel: THREE.Vector3
  gravity: number
  radius: number
  ttl: number
  kind: ProjectileKind
}

/** 0 seed도 고정 상수로 치환하는 결정론적 xorshift32. */
export class XorShift32 {
  private state = DEFAULT_SEED

  constructor(seed = DEFAULT_SEED) {
    this.setSeed(seed)
  }

  setSeed(seed: number): void {
    const normalized = seed >>> 0
    this.state = normalized === 0 ? DEFAULT_SEED : normalized
  }

  nextFloat(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state / 0x100000000
  }
}

export class PvpArena {
  readonly group = new THREE.Group()

  private readonly pool: PooledProjectile[] = []
  private readonly projectileVisuals: Record<
    ProjectileKind,
    { geometry: THREE.BufferGeometry; material: THREE.Material }
  >
  private readonly rng = new XorShift32()

  private readonly rivalRoot = new THREE.Group()
  private readonly rivalWeaponMount = new THREE.Group()
  private readonly rivalEnergyRing: THREE.Mesh
  private readonly leftPropeller = new THREE.Group()
  private readonly rightPropeller = new THREE.Group()
  private rivalBuilt: BuiltBlaster | null = null

  private elapsedSec = 0
  private hoverPhase = 0
  private weaponYaw = Math.PI
  private rivalImpactCount = 0
  private playerImpactCount = 0
  private rivalPulseSec = 0
  private playerPulseSec = 0

  private readonly fireDir = new THREE.Vector3()
  private readonly fireOrigin = new THREE.Vector3()
  private readonly originalDir = new THREE.Vector3()
  private readonly spreadAxis = new THREE.Vector3()
  private readonly playerCenter = new THREE.Vector3()
  private readonly rivalCenter = new THREE.Vector3()
  private readonly velocityDir = new THREE.Vector3()
  private readonly projectileForward = new THREE.Vector3(0, 0, 1)
  private readonly modelBox = new THREE.Box3()
  private readonly modelSize = new THREE.Vector3()
  private readonly modelCenter = new THREE.Vector3()
  private readonly sweepPrev: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCur: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly sweepCenter: Vec3 = { x: 0, y: 0, z: 0 }

  constructor() {
    this.group.name = 'pvp-arena'
    this.group.visible = false
    this.buildStage()
    this.rivalEnergyRing = this.buildRivalDrone()
    this.group.add(this.rivalRoot)

    const projectileVisuals = {} as Record<
      ProjectileKind,
      { geometry: THREE.BufferGeometry; material: THREE.Material }
    >
    for (const kind of PROJECTILE_KINDS) {
      const def = PROJECTILE_DEFS[kind]
      const geometry = def.shape === 'dart'
        ? new THREE.CapsuleGeometry(0.55, 0.9, 4, 8).rotateX(Math.PI / 2)
        : new THREE.SphereGeometry(1, 8, 6)
      projectileVisuals[kind] = {
        geometry,
        material: fixedMaterial(def.color),
      }
    }
    this.projectileVisuals = projectileVisuals

    const initial = this.projectileVisuals.dart
    for (let i = 0; i < PERFORMANCE_BUDGETS.projectilePool; i++) {
      const mesh = new THREE.Mesh(initial.geometry, initial.material)
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

  get projectileCapacity(): number {
    return this.pool.length
  }

  /**
   * 한 라운드를 초기화하고 드론에 해당 로드아웃을 장착한다.
   * profile은 첫 위치 폭을 정하는 데만 쓰며 매 프레임 성능은 update 인자가 정본이다.
   */
  startRound(blaster: Blaster, profile: PvpProfile, seed: number): void {
    this.reset()
    this.rng.setSeed(seed)
    this.elapsedSec = 0
    this.hoverPhase = this.rng.nextFloat() * Math.PI * 2
    this.weaponYaw = Math.PI
    const openingWidth = Math.min(2.5, Math.max(0.6, profile.strafeSpeed * 0.25))
    this.rivalRoot.position.set(
      (this.rng.nextFloat() - 0.5) * openingWidth,
      1.75,
      -12,
    )
    this.rivalRoot.scale.setScalar(1)
    this.rivalRoot.visible = true
    this.setRivalHealth(10, 10)
    this.mountRivalBlaster(blaster)
    this.group.visible = true
  }

  firePlayer(origin: THREE.Vector3, dir: THREE.Vector3, profile: PvpProfile): void {
    this.spawnProjectile(OWNER_PLAYER, origin, dir, profile)
  }

  fireRival(playerPos: THREE.Vector3, profile: PvpProfile): void {
    this.fireOrigin.set(
      this.rivalRoot.position.x,
      this.rivalRoot.position.y - 0.2,
      this.rivalRoot.position.z + 0.7,
    )
    const horizontalDistance = Math.max(
      0.001,
      Math.hypot(
        playerPos.x - this.fireOrigin.x,
        playerPos.z - this.fireOrigin.z,
      ),
    )
    // 실제 발사 방향도 추적 중인 마운트 방향을 사용해 다루기(aimFollowPerSec)가 체감된다.
    this.fireDir.set(
      -Math.sin(this.weaponYaw),
      (playerPos.y - this.fireOrigin.y) / horizontalDistance,
      -Math.cos(this.weaponYaw),
    ).normalize()
    this.spawnProjectile(OWNER_RIVAL, this.fireOrigin, this.fireDir, profile)
  }

  update(dt: number, playerPos: THREE.Vector3, profile: PvpProfile): void {
    this.elapsedSec += dt
    const strafeRate = 0.45 + profile.strafeSpeed * 0.08
    const strafeWidth = Math.min(5.2, 1.8 + profile.strafeSpeed * 0.32)
    this.rivalRoot.position.x = Math.sin(this.elapsedSec * strafeRate + this.hoverPhase) * strafeWidth
    this.rivalRoot.position.y = 1.75 + Math.sin(this.elapsedSec * 2.1 + this.hoverPhase) * 0.16

    this.leftPropeller.rotation.z += dt * (9 + profile.strafeSpeed)
    this.rightPropeller.rotation.z -= dt * (9 + profile.strafeSpeed)

    const dx = playerPos.x - this.rivalRoot.position.x
    const dz = playerPos.z - this.rivalRoot.position.z
    const wantedYaw = Math.atan2(-dx, -dz)
    const yawDelta = Math.atan2(
      Math.sin(wantedYaw - this.weaponYaw),
      Math.cos(wantedYaw - this.weaponYaw),
    )
    this.weaponYaw += yawDelta * Math.min(1, dt * profile.aimFollowPerSec)
    this.rivalWeaponMount.rotation.y = this.weaponYaw

    if (this.rivalPulseSec > 0) {
      this.rivalPulseSec = Math.max(0, this.rivalPulseSec - dt)
      const pulseScale = 1 + this.rivalPulseSec * 0.7
      this.rivalRoot.scale.setScalar(pulseScale)
    } else {
      this.rivalRoot.scale.setScalar(1)
    }
    if (this.playerPulseSec > 0) this.playerPulseSec = Math.max(0, this.playerPulseSec - dt)

    this.updateProjectiles(dt, playerPos)
  }

  consumePlayerImpact(): number {
    const count = this.playerImpactCount
    this.playerImpactCount = 0
    return count
  }

  consumeRivalImpact(): number {
    const count = this.rivalImpactCount
    this.rivalImpactCount = 0
    return count
  }

  setRivalHealth(current: number, maximum = 10): void {
    const ratio = maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 0
    const scale = Math.max(0.08, ratio)
    this.rivalEnergyRing.scale.setScalar(scale)
    this.rivalEnergyRing.visible = current > 0
    this.rivalRoot.visible = current > 0
  }

  getRivalPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.rivalRoot.position)
  }

  reset(): void {
    for (const projectile of this.pool) {
      projectile.active = false
      projectile.mesh.visible = false
      projectile.ttl = 0
    }
    this.rivalImpactCount = 0
    this.playerImpactCount = 0
    this.rivalPulseSec = 0
    this.playerPulseSec = 0
    this.rivalRoot.visible = false
    this.rivalRoot.scale.setScalar(1)
    this.rivalEnergyRing.visible = true
    this.rivalEnergyRing.scale.setScalar(1)
    if (this.rivalBuilt) {
      this.rivalWeaponMount.remove(this.rivalBuilt.group)
      this.rivalBuilt.dispose()
      this.rivalBuilt = null
    }
  }

  private buildStage(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 40),
      fixedMaterial(TOY_PALETTE.pastelMint),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = GROUND_Y
    this.group.add(ground)

    const playRing = new THREE.Mesh(
      new THREE.RingGeometry(5.5, 6, 40),
      fixedMaterial(TOY_PALETTE.pastelCream),
    )
    playRing.rotation.x = -Math.PI / 2
    playRing.position.y = GROUND_Y + 0.004
    playRing.position.z = -9
    this.group.add(playRing)

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 13),
      fixedMaterial(TOY_PALETTE.pastelSky),
    )
    backdrop.position.set(0, 6, -24)
    this.group.add(backdrop)

    const ringGeometry = new THREE.TorusGeometry(1.7, 0.14, 8, 24)
    const ringColors = [
      TOY_PALETTE.blasterMagenta,
      TOY_PALETTE.blasterYellow,
      TOY_PALETTE.blasterTeal,
    ] as const
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(ringGeometry, fixedMaterial(ringColors[i]!))
      ring.position.set((i - 1) * 4.6, 4.5 + (i % 2) * 0.8, -23.8)
      this.group.add(ring)
    }

    const postGeometry = new THREE.CylinderGeometry(0.18, 0.24, 3.2, 10)
    for (let side = -1; side <= 1; side += 2) {
      const post = new THREE.Mesh(
        postGeometry,
        fixedMaterial(side < 0 ? TOY_PALETTE.blasterPurple : TOY_PALETTE.blasterCoral),
      )
      post.position.set(side * 6.8, 1.6, -15)
      this.group.add(post)
    }
  }

  private buildRivalDrone(): THREE.Mesh {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 12, 10),
      fixedMaterial(TOY_PALETTE.blasterMagenta),
    )
    this.rivalRoot.add(core)

    const shellRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.09, 8, 20),
      fixedMaterial(TOY_PALETTE.pastelCream),
    )
    shellRing.rotation.x = Math.PI / 2
    this.rivalRoot.add(shellRing)

    const energyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.71, 0.045, 8, 24),
      glowMaterial(TOY_PALETTE.blasterYellow),
    )
    energyRing.position.z = 0.5
    this.rivalRoot.add(energyRing)

    const rotorRingGeometry = new THREE.TorusGeometry(0.29, 0.045, 7, 18)
    const bladeGeometry = new THREE.BoxGeometry(0.44, 0.055, 0.035)
    const rotorMaterial = fixedMaterial(TOY_PALETTE.blasterTeal)
    const bladeMaterial = fixedMaterial(TOY_PALETTE.pastelCream)
    for (let side = -1; side <= 1; side += 2) {
      const rotor = side < 0 ? this.leftPropeller : this.rightPropeller
      rotor.position.set(side * 0.92, 0.08, 0)
      rotor.add(new THREE.Mesh(rotorRingGeometry, rotorMaterial))
      const bladeA = new THREE.Mesh(bladeGeometry, bladeMaterial)
      const bladeB = new THREE.Mesh(bladeGeometry, bladeMaterial)
      bladeB.rotation.z = Math.PI / 2
      rotor.add(bladeA, bladeB)
      this.rivalRoot.add(rotor)
    }

    this.rivalWeaponMount.position.set(0, -0.42, 0)
    this.rivalWeaponMount.rotation.y = Math.PI
    this.rivalRoot.add(this.rivalWeaponMount)
    this.rivalRoot.visible = false
    return energyRing
  }

  private mountRivalBlaster(blaster: Blaster): void {
    this.rivalBuilt = buildBlaster(blaster, 'full')
    const model = this.rivalBuilt.group
    this.modelBox.setFromObject(model)
    this.modelBox.getSize(this.modelSize)
    this.modelBox.getCenter(this.modelCenter)
    const span = Math.max(this.modelSize.x, this.modelSize.y, this.modelSize.z, 0.001)
    const scale = Math.min(1, 1.15 / span)
    model.scale.setScalar(scale)
    model.position.set(
      -this.modelCenter.x * scale,
      -this.modelCenter.y * scale,
      -this.modelCenter.z * scale,
    )
    this.rivalWeaponMount.add(model)
  }

  private spawnProjectile(
    owner: ProjectileOwner,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    profile: PvpProfile,
  ): void {
    let projectile: PooledProjectile | undefined
    for (const candidate of this.pool) {
      if (!candidate.active) {
        projectile = candidate
        break
      }
    }
    projectile ??= this.oldestProjectile()

    projectile.active = true
    projectile.owner = owner
    projectile.kind = profile.kind
    projectile.gravity = PROJECTILE_GRAVITY[profile.kind]
    projectile.radius = PROJECTILE_BASE_RADIUS[profile.kind] * profile.projectileScale
    projectile.ttl = PROJECTILE_TTL_SEC
    projectile.pos.copy(origin)
    projectile.prev.copy(origin)
    this.applySpread(dir, profile.spreadDeg)
    projectile.vel.copy(this.fireDir).multiplyScalar(profile.muzzleVelocity)

    const visual = this.projectileVisuals[profile.kind]
    projectile.mesh.geometry = visual.geometry
    projectile.mesh.material = visual.material
    projectile.mesh.position.copy(origin)
    projectile.mesh.scale.setScalar(Math.max(0.04, projectile.radius))
    projectile.mesh.visible = true
  }

  private applySpread(dir: THREE.Vector3, spreadDeg: number): void {
    this.originalDir.copy(dir).normalize()
    const spreadRad = Math.max(0, spreadDeg) * Math.PI / 180
    if (spreadRad <= 0) {
      this.fireDir.copy(this.originalDir)
      return
    }
    this.spreadAxis.set(0, 1, 0)
    if (Math.abs(this.originalDir.y) > 0.9) this.spreadAxis.set(1, 0, 0)
    this.spreadAxis.crossVectors(this.spreadAxis, this.originalDir).normalize()
    const angle = Math.sqrt(this.rng.nextFloat()) * spreadRad
    const roll = this.rng.nextFloat() * Math.PI * 2
    this.fireDir
      .copy(this.originalDir)
      .applyAxisAngle(this.spreadAxis, angle)
      .applyAxisAngle(this.originalDir, roll)
      .normalize()
  }

  private oldestProjectile(): PooledProjectile {
    let oldest = this.pool[0]!
    for (const projectile of this.pool) {
      if (projectile.ttl < oldest.ttl) oldest = projectile
    }
    return oldest
  }

  private updateProjectiles(dt: number, playerPos: THREE.Vector3): void {
    this.playerCenter.copy(playerPos)
    this.rivalCenter.copy(this.rivalRoot.position)

    for (const projectile of this.pool) {
      if (!projectile.active) continue
      projectile.prev.copy(projectile.pos)
      projectile.vel.y -= projectile.gravity * dt
      projectile.pos.addScaledVector(projectile.vel, dt)
      projectile.ttl -= dt
      projectile.mesh.position.copy(projectile.pos)
      if (projectile.kind === 'dart') {
        this.velocityDir.copy(projectile.vel).normalize()
        projectile.mesh.quaternion.setFromUnitVectors(this.projectileForward, this.velocityDir)
      }

      this.sweepPrev.x = projectile.prev.x
      this.sweepPrev.y = projectile.prev.y
      this.sweepPrev.z = projectile.prev.z
      this.sweepCur.x = projectile.pos.x
      this.sweepCur.y = projectile.pos.y
      this.sweepCur.z = projectile.pos.z

      let impacted = false
      if (projectile.owner === OWNER_PLAYER && this.rivalRoot.visible) {
        this.sweepCenter.x = this.rivalCenter.x
        this.sweepCenter.y = this.rivalCenter.y
        this.sweepCenter.z = this.rivalCenter.z
        impacted = sweepHitSphere(
          this.sweepPrev,
          this.sweepCur,
          this.sweepCenter,
          RIVAL_HIT_RADIUS + projectile.radius,
        )
        if (impacted) {
          this.rivalImpactCount += 1
          this.rivalPulseSec = 0.16
        }
      } else if (projectile.owner === OWNER_RIVAL) {
        this.sweepCenter.x = this.playerCenter.x
        this.sweepCenter.y = this.playerCenter.y
        this.sweepCenter.z = this.playerCenter.z
        impacted = sweepHitSphere(
          this.sweepPrev,
          this.sweepCur,
          this.sweepCenter,
          PLAYER_HIT_RADIUS + projectile.radius,
        )
        if (impacted) {
          this.playerImpactCount += 1
          this.playerPulseSec = 0.16
        }
      }

      if (
        impacted
        || projectile.ttl <= 0
        || projectile.pos.y < GROUND_Y - 0.5
        || Math.abs(projectile.pos.x) > ARENA_LIMIT
        || Math.abs(projectile.pos.z) > ARENA_LIMIT
      ) {
        projectile.active = false
        projectile.mesh.visible = false
      }
    }
  }
}
