// src/game/range.ts — 사격장 컨트롤러: 타겟 메시 + 발사체 풀(64) + 스윕 판정 (04).
// 핫패스(update) 할당 금지 — 모듈 스크래치 재사용, 풀 선할당.
import * as THREE from 'three'
import type { ShotProfile } from './types.ts'
import {
  PROJECTILE_BASE_RADIUS,
  PROJECTILE_GRAVITY,
  sweepHitSphere,
  type Vec3,
} from './ballistics.ts'
import { fixedMaterial, paintMaterial } from './materials.ts'

const POOL_SIZE = 64
const CONFETTI_MAX = 240
const ASSIST_RADIUS_MUL = 1.7 // 데스크톱 어시스트 — 아이 친화로 상향 (04 §8 ①)
const GUIDE_DOTS = 18 // 탄착 궤적 가이드 점
const GROUND_Y = 0

export type HitKind = 'board' | 'balloon'
export interface HitEvent {
  kind: HitKind
  points: number
  x: number
  y: number
  z: number
}

interface Pooled {
  active: boolean
  mesh: THREE.Mesh
  prev: THREE.Vector3
  pos: THREE.Vector3
  vel: THREE.Vector3
  gravity: number
  radius: number
  ttl: number
}

interface Balloon {
  root: THREE.Mesh
  alive: boolean
  center: THREE.Vector3
  hitRadius: number
  basePoints: number
  respawnAt: number
}

interface Board {
  center: THREE.Vector3
  hitRadius: number
  basePoints: number
}

// 모듈 스크래치 (핫패스 할당 금지)
const _v = new THREE.Vector3()
const _prev: Vec3 = { x: 0, y: 0, z: 0 }
const _cur: Vec3 = { x: 0, y: 0, z: 0 }
const _c: Vec3 = { x: 0, y: 0, z: 0 }
const _dummy = new THREE.Object3D()
const _spreadAxis = new THREE.Vector3()
const _origDir = new THREE.Vector3()
const _col = new THREE.Color()

export class RangeController {
  readonly group = new THREE.Group()
  private pool: Pooled[] = []
  private balloons: Balloon[] = []
  private boards: Board[] = []
  private confetti: THREE.InstancedMesh
  private confVel: THREE.Vector3[] = []
  private confLife: number[] = []
  private confActive: boolean[] = []
  private confHead = 0
  private guide: THREE.InstancedMesh
  onHit: ((e: HitEvent) => void) | null = null

  constructor() {
    this.buildScene()
    // 발사체 풀 선할당
    const dartGeo = new THREE.SphereGeometry(1, 8, 6)
    const dartMat = paintMaterial('blasterYellow', 'gloss')
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(dartGeo, dartMat)
      mesh.visible = false
      this.group.add(mesh)
      this.pool.push({
        active: false,
        mesh,
        prev: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gravity: 4,
        radius: 0.025,
        ttl: 0,
      })
    }
    // 콘페티 InstancedMesh 1개 (draw call 1)
    const confGeo = new THREE.PlaneGeometry(0.06, 0.06)
    const confMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      vertexColors: false,
      color: 0xffffff,
    })
    this.confetti = new THREE.InstancedMesh(confGeo, confMat, CONFETTI_MAX)
    this.confetti.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(CONFETTI_MAX * 3),
      3,
    )
    this.confetti.count = CONFETTI_MAX
    // 이동하는 InstancedMesh — 원-샷 boundingSphere 컬링 방지(명중 콘페티가 안 보이던 버그)
    this.confetti.frustumCulled = false
    for (let i = 0; i < CONFETTI_MAX; i++) {
      this.confVel.push(new THREE.Vector3())
      this.confLife.push(0)
      this.confActive.push(false)
      _dummy.position.set(0, -999, 0)
      _dummy.updateMatrix()
      this.confetti.setMatrixAt(i, _dummy.matrix)
    }
    this.confetti.instanceMatrix.needsUpdate = true
    this.group.add(this.confetti)

    // 탄착 궤적 가이드 (밝은 점 — draw call 1)
    const guideGeo = new THREE.SphereGeometry(0.05, 8, 6)
    const guideMat = new THREE.MeshBasicMaterial({
      color: 0xffe14d,
      transparent: true,
      opacity: 0.85,
    })
    this.guide = new THREE.InstancedMesh(guideGeo, guideMat, GUIDE_DOTS)
    this.guide.count = GUIDE_DOTS
    this.guide.frustumCulled = false // 동일 컬링 방지(방어)
    for (let i = 0; i < GUIDE_DOTS; i++) {
      _dummy.position.set(0, -999, 0)
      _dummy.updateMatrix()
      this.guide.setMatrixAt(i, _dummy.matrix)
    }
    this.guide.instanceMatrix.needsUpdate = true
    this.group.add(this.guide)
  }

  /** 현재 조준의 예상 포물선 위에 가이드 점을 배치 (조준 보조). */
  updateGuide(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, gravity: number): void {
    let px = origin.x
    let py = origin.y
    let pz = origin.z
    let vx = dir.x * speed
    let vy = dir.y * speed
    let vz = dir.z * speed
    const sub = 3
    const h = 0.05 / sub // 점 간격 0.05초
    for (let i = 0; i < GUIDE_DOTS; i++) {
      for (let s = 0; s < sub; s++) {
        vy -= gravity * h
        px += vx * h
        py += vy * h
        pz += vz * h
      }
      if (py < GROUND_Y) {
        _dummy.position.set(0, -999, 0)
        _dummy.scale.setScalar(0.0001)
      } else {
        _dummy.position.set(px, py, pz)
        _dummy.scale.setScalar(1 - i / (GUIDE_DOTS * 1.6)) // 멀수록 작게
      }
      _dummy.rotation.set(0, 0, 0)
      _dummy.updateMatrix()
      this.guide.setMatrixAt(i, _dummy.matrix)
    }
    this.guide.instanceMatrix.needsUpdate = true
  }

  private buildScene(): void {
    // 바닥
    const groundGeo = new THREE.CircleGeometry(30, 32)
    const ground = new THREE.Mesh(
      groundGeo,
      fixedMaterial(0x9fd6a0),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = GROUND_Y
    this.group.add(ground)

    // 뒷벽
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 14),
      fixedMaterial(0xbfe3ff),
    )
    wall.position.set(0, 6, -28)
    this.group.add(wall)

    // 링 과녁 3개 (8·15·25 m)
    const dists = [8, 15, 25]
    const heights = [1.3, 1.7, 2.2]
    const colors = [0xf05454, 0xffd23f, 0x4cd964]
    for (let i = 0; i < dists.length; i++) {
      const d = dists[i]!
      const y = heights[i]!
      const board = new THREE.Group()
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 24),
        fixedMaterial(0xffffff),
      )
      board.add(disc)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.05, 8, 24),
        fixedMaterial(colors[i]!),
      )
      board.add(ring)
      const bull = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 20),
        fixedMaterial(colors[i]!),
      )
      bull.position.z = 0.001
      board.add(bull)
      board.position.set((i - 1) * 2.2, y, -d)
      this.group.add(board)
      this.boards.push({
        center: new THREE.Vector3((i - 1) * 2.2, y, -d),
        hitRadius: 0.5,
        basePoints: 100,
      })
    }

    // 풍선 6개
    const balloonColors = [
      0xff8a2b, 0x2f7fe8, 0xf05454, 0x4cd964, 0xffd23f, 0xe4c1f9,
    ]
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI - Math.PI / 2
      const x = Math.sin(angle) * 4
      const z = -10 - (i % 3) * 3
      const y = 1.4 + (i % 2) * 0.9
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12),
        fixedMaterial(balloonColors[i]!),
      )
      mesh.scale.set(1, 1.2, 1)
      mesh.position.set(x, y, z)
      this.group.add(mesh)
      this.balloons.push({
        root: mesh,
        alive: true,
        center: new THREE.Vector3(x, y, z),
        hitRadius: 0.35,
        basePoints: 100,
        respawnAt: 0,
      })
    }
  }

  get balloonsAlive(): number {
    let n = 0
    for (const b of this.balloons) if (b.alive) n += 1
    return n
  }

  reset(): void {
    for (const p of this.pool) {
      p.active = false
      p.mesh.visible = false
    }
    for (const b of this.balloons) {
      b.alive = true
      b.root.visible = true
      b.respawnAt = 0
    }
  }

  fireOne(profile: ShotProfile, origin: THREE.Vector3, dir: THREE.Vector3): void {
    const p = this.pool.find((x) => !x.active) ?? this.oldest()
    p.active = true
    p.mesh.visible = true
    p.gravity = PROJECTILE_GRAVITY[profile.kind]
    p.radius = PROJECTILE_BASE_RADIUS[profile.kind] * profile.projectileScale
    p.mesh.scale.setScalar(Math.max(0.04, p.radius))
    p.ttl = 3
    p.pos.copy(origin)
    p.prev.copy(origin)
    // 퍼짐 적용
    _v.copy(dir).normalize()
    const spreadRad = (profile.spreadDeg * Math.PI) / 180
    applySpread(_v, spreadRad)
    p.vel.copy(_v).multiplyScalar(profile.muzzleVelocity)
    p.mesh.position.copy(origin)
  }

  private oldest(): Pooled {
    let best = this.pool[0]!
    for (const p of this.pool) if (p.ttl < best.ttl) best = p
    return best
  }

  update(dt: number, nowMs: number): void {
    // 발사체 적분 + 스윕 판정
    for (const p of this.pool) {
      if (!p.active) continue
      p.prev.copy(p.pos)
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      p.ttl -= dt
      p.mesh.position.copy(p.pos)

      _prev.x = p.prev.x
      _prev.y = p.prev.y
      _prev.z = p.prev.z
      _cur.x = p.pos.x
      _cur.y = p.pos.y
      _cur.z = p.pos.z

      let hit = false
      for (const b of this.balloons) {
        if (!b.alive) continue
        _c.x = b.center.x
        _c.y = b.center.y
        _c.z = b.center.z
        if (sweepHitSphere(_prev, _cur, _c, b.hitRadius * ASSIST_RADIUS_MUL + p.radius)) {
          b.alive = false
          b.root.visible = false
          b.respawnAt = nowMs + 3000
          this.spawnConfetti(b.center)
          this.onHit?.({
            kind: 'balloon',
            points: b.basePoints,
            x: b.center.x,
            y: b.center.y,
            z: b.center.z,
          })
          hit = true
          break
        }
      }
      if (!hit) {
        for (const bd of this.boards) {
          _c.x = bd.center.x
          _c.y = bd.center.y
          _c.z = bd.center.z
          // 어시스트 계수는 풍선·과녁 모두 동일 적용 (04 §8 ①)
          if (sweepHitSphere(_prev, _cur, _c, bd.hitRadius * ASSIST_RADIUS_MUL + p.radius)) {
            const dist = Math.hypot(p.pos.x - bd.center.x, p.pos.y - bd.center.y)
            const pts = dist < 0.15 ? 200 : dist < 0.35 ? 100 : 50
            this.onHit?.({ kind: 'board', points: pts, x: p.pos.x, y: p.pos.y, z: bd.center.z })
            hit = true
            break
          }
        }
      }
      if (hit || p.ttl <= 0 || p.pos.y < GROUND_Y - 0.5) {
        p.active = false
        p.mesh.visible = false
      }
    }

    // 풍선 리스폰
    for (const b of this.balloons) {
      if (!b.alive && nowMs >= b.respawnAt) {
        b.alive = true
        b.root.visible = true
      }
    }

    this.updateConfetti(dt)
  }

  private spawnConfetti(at: THREE.Vector3): void {
    const palette = [0xff8a2b, 0x2f7fe8, 0xf05454, 0x4cd964, 0xffd23f, 0xffb5c9]
    for (let k = 0; k < 12; k++) {
      const i = this.confHead
      this.confHead = (this.confHead + 1) % CONFETTI_MAX
      this.confActive[i] = true
      this.confLife[i] = 0.8
      this.confVel[i]!.set(
        (Math.random() - 0.5) * 3,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 3,
      )
      _dummy.position.copy(at)
      _dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0)
      _dummy.scale.setScalar(1)
      _dummy.updateMatrix()
      this.confetti.setMatrixAt(i, _dummy.matrix)
      this.confetti.setColorAt(i, _col.setHex(palette[k % palette.length]!))
    }
    this.confetti.instanceMatrix.needsUpdate = true
    if (this.confetti.instanceColor) this.confetti.instanceColor.needsUpdate = true
  }

  private updateConfetti(dt: number): void {
    let dirty = false
    for (let i = 0; i < CONFETTI_MAX; i++) {
      if (!this.confActive[i]) continue
      dirty = true
      this.confLife[i]! -= dt
      if (this.confLife[i]! <= 0) {
        this.confActive[i] = false
        _dummy.position.set(0, -999, 0)
        _dummy.scale.setScalar(0.0001)
        _dummy.updateMatrix()
        this.confetti.setMatrixAt(i, _dummy.matrix)
        continue
      }
      const v = this.confVel[i]!
      v.y -= 6 * dt
      this.confetti.getMatrixAt(i, _dummy.matrix)
      _dummy.matrix.decompose(_dummy.position, _dummy.quaternion, _dummy.scale)
      _dummy.position.addScaledVector(v, dt)
      _dummy.rotation.z += dt * 4
      _dummy.scale.setScalar(Math.max(0.2, this.confLife[i]!))
      _dummy.updateMatrix()
      this.confetti.setMatrixAt(i, _dummy.matrix)
    }
    if (dirty) this.confetti.instanceMatrix.needsUpdate = true
  }
}

// dir 을 원뿔(반각 spreadRad) 안에서 랜덤 편향 — 원래 축 기준 tilt + roll
function applySpread(dir: THREE.Vector3, spreadRad: number): void {
  if (spreadRad <= 0) {
    dir.normalize()
    return
  }
  _origDir.copy(dir).normalize()
  _spreadAxis.set(0, 1, 0)
  if (Math.abs(_origDir.y) > 0.9) _spreadAxis.set(1, 0, 0)
  _spreadAxis.crossVectors(_spreadAxis, _origDir).normalize()
  const a = Math.random() * spreadRad
  const roll = Math.random() * Math.PI * 2
  dir.copy(_origDir).applyAxisAngle(_spreadAxis, a).applyAxisAngle(_origDir, roll).normalize()
}
