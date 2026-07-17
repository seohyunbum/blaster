// src/game/materials.ts — toon 룩 머티리얼 팩토리 4종 + 색|finish 캐시 (03 §2·§5).
// 캐시된 머티리얼은 절대 dispose 하지 않는다(상한 보장). 색 변경 = 캐시에서 새 머티리얼 받아 교체.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { Finish } from './types.ts'
import { resolveHex } from './palette.ts'

function makeMatte(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.75,
    metalness: 0.02,
    envMapIntensity: 0.35,
    flatShading: false,
  })
}
function makeGloss(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.28,
    metalness: 0.05,
    envMapIntensity: 0.7,
  })
}
function makeMetal(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.38,
    metalness: 0.34,
    envMapIntensity: 1.0,
  })
}

const FINISH_FACTORY: Record<Finish, (hex: number) => THREE.MeshStandardMaterial> = {
  matte: makeMatte,
  gloss: makeGloss,
  metal: makeMetal,
}

const paintMatCache = new Map<string, THREE.MeshStandardMaterial>()

/** 색|finish 캐시 조회. 없으면 생성. 절대 dispose 금지. */
export function paintMaterial(color: string, finish: Finish): THREE.MeshStandardMaterial {
  const key = `${color}|${finish}`
  let mat = paintMatCache.get(key)
  if (!mat) {
    mat = FINISH_FACTORY[finish](resolveHex(color))
    paintMatCache.set(key, mat)
  }
  return mat
}

// 고정(비색칠) 머티리얼 — 안전팁 주황·발광 dot·투명창.
// hex 별로 캐시 (단일 싱글턴이면 첫 색이 이후 모든 발광 파츠를 덮어씀 — QA 지적)
const glowCache = new Map<number, THREE.MeshStandardMaterial>()
export function glowMaterial(hex: number): THREE.MeshStandardMaterial {
  let m = glowCache.get(hex)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.6,
      roughness: 0.28,
      metalness: 0.04,
    })
    glowCache.set(hex, m)
  }
  return m
}

const fixedCache = new Map<number, THREE.MeshStandardMaterial>()
export function fixedMaterial(hex: number): THREE.MeshStandardMaterial {
  let m = fixedCache.get(hex)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.1 })
    fixedCache.set(hex, m)
  }
  return m
}

export const TIP_ORANGE = 0xff7a1a // 안전팁 고정 (토이 아이덴티티)

/** 환경맵 부팅 배선 (M1 명문 태스크, 03 §2.1) — toyMetal/gloss no-op 방지. */
export function installEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = env.texture
  pmrem.dispose()
}
