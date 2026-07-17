// src/game/ballistics.ts — 스탯→발사 변환·탄도 순수 수학 (leaf, THREE 비의존 → 테스트 대상).
// 이 파일의 ShotProfile 계약·클램프가 정본 (04 §2.2, 결정문 4).
import type { BlasterStats, ProjectileKind, ShotProfile } from './types.ts'

// kind 파생 상수 — 단일 소스 (04 §2.1). foam 은 00_DECISIONS R1 로 폐기.
export const PROJECTILE_GRAVITY: Record<ProjectileKind, number> = {
  dart: 4,
  gel: 6,
  paint: 14,
}
export const PROJECTILE_BASE_RADIUS: Record<ProjectileKind, number> = {
  dart: 0.025,
  gel: 0.035,
  paint: 0.045,
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n
}

/** 09 §2.3 — 발사체 크기(시각·충돌 공용). */
export function composeProjectileScale(power: number, boreScale: number): number {
  return clamp(boreScale * (1 + 0.02 * (power - 5.5)), 0.85, 1.35)
}

/**
 * 스탯(1~10) → ShotProfile. 모든 출력이 04 클램프 안에서 태어난다 (02 §4.0).
 * boreScale = 배럴 굵기 morph 기여 (없으면 1.0).
 */
export function toShotProfile(stats: BlasterStats, boreScale = 1): ShotProfile {
  const p = stats.power
  const a = stats.accuracy
  const r = stats.fireRate
  const h = stats.handling

  const muzzleVelocity = clamp(20 + ((p - 1) * 40) / 9, 20, 60)
  const spreadDeg = clamp(4.0 - ((a - 1) * 3.7) / 9, 0.3, 4.0)
  const fireIntervalMs = clamp(600 - (r - 1) * 50, 150, 600)

  // 반동: 도 단위 직접 산출 (00_DECISIONS nit) + riseRate 계약 클램프 (04 §3).
  let recoilKickDeg = clamp(0.2 + 0.24 * (p - 1) - 0.05 * (h - 5), 0.2, 2.5)
  const maxKick = (20 * fireIntervalMs) / 1000 // riseRate = kick×(1000/interval) ≤ 20
  if (recoilKickDeg > maxKick) recoilKickDeg = maxKick

  const projectileScale = composeProjectileScale(p, boreScale)

  return {
    kind: stats.kind,
    muzzleVelocity,
    spreadDeg,
    fireIntervalMs,
    projectileScale,
    recoilKickDeg: round3(recoilKickDeg),
  }
}

/** riseRate = kick × (1000/interval) — 반동 상승률(°/s). 게이트 불변식 검증용. */
export function riseRate(profile: ShotProfile): number {
  return profile.recoilKickDeg * (1000 / profile.fireIntervalMs)
}

/** 반동 복귀율 동적화 (04 §3). */
export function recoveryDegPerSec(profile: ShotProfile): number {
  return Math.max(8, riseRate(profile) * 0.7)
}

export const RECOIL_MAX_DEG = 6

/**
 * 포물선 저각 조준 해 (04 §8). 수평거리 d·높이차 h·탄속 v·중력 g → pitch(rad).
 * 사거리 밖이면 null(개입 안 함).
 */
export function solveBallisticPitchRad(
  d: number,
  h: number,
  v: number,
  g: number,
): number | null {
  if (d <= 0) return null
  const disc = v ** 4 - g * (g * d * d + 2 * h * v * v)
  if (disc < 0) return null
  return Math.atan((v * v - Math.sqrt(disc)) / (g * d))
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * 선분(prev→cur) vs 구(center, radius) 스윕 판정 (04 §2, 터널링 방지).
 * 최근접점이 반경 안이면 true.
 */
export function sweepHitSphere(
  prev: Vec3,
  cur: Vec3,
  center: Vec3,
  radius: number,
): boolean {
  const dx = cur.x - prev.x
  const dy = cur.y - prev.y
  const dz = cur.z - prev.z
  const len2 = dx * dx + dy * dy + dz * dz
  let t = 0
  if (len2 > 1e-12) {
    t =
      ((center.x - prev.x) * dx +
        (center.y - prev.y) * dy +
        (center.z - prev.z) * dz) /
      len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
  }
  const cxp = prev.x + dx * t - center.x
  const cyp = prev.y + dy * t - center.y
  const czp = prev.z + dz * t - center.z
  return cxp * cxp + cyp * cyp + czp * czp <= radius * radius
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
