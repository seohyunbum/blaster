// src/game/assembly.ts — 조립 합성: Blaster 데이터 → THREE.Group (leaf).
// buildPart 하나를 공유하므로 공방·사격장 뷰모델·썸네일이 같은 형태를 본다 (03 §7).
import * as THREE from 'three'
import type { Blaster, PartInstance, PartPaint, SlotType, ZoneId } from './types.ts'
import { buildPart, type BuiltPart } from './partVisuals.ts'
import { paintMaterial } from './materials.ts'
import { bodyOf } from './parts.ts'

const ZONE_DEFAULT: Record<ZoneId, { color: string; finish: 'matte' | 'gloss' | 'metal' }> = {
  primary: { color: 'blasterBlue', finish: 'gloss' },
  secondary: { color: 'toyGrayLight', finish: 'matte' },
  accent: { color: 'blasterOrange', finish: 'gloss' },
}

export function applyPaint(built: BuiltPart, paint: PartPaint): void {
  for (const zone of ['primary', 'secondary', 'accent'] as ZoneId[]) {
    const meshes = built.zones[zone]
    if (!meshes) continue
    const zp = paint[zone] ?? ZONE_DEFAULT[zone]
    const mat = paintMaterial(zp.color, zp.finish)
    for (const m of meshes) m.material = mat
  }
}

export interface BuiltBlaster {
  group: THREE.Group
  parts: Partial<Record<SlotType, BuiltPart>>
  dispose(): void
}

const ATTACH_SLOTS: SlotType[] = ['barrel', 'sight']

/**
 * 조립 전체 빌드. 몸통 → 앵커에 자식 파츠 부착(anchor.add + 원점 고정, attach() 금지, 09 §3.3) → 페인트.
 */
export function buildBlaster(
  blaster: Blaster,
  lod?: 'drag' | 'full',
): BuiltBlaster {
  const group = new THREE.Group()
  const parts: Partial<Record<SlotType, BuiltPart>> = {}

  const bodyInst = blaster.parts.body
  if (!bodyInst) {
    return { group, parts, dispose: () => {} }
  }
  const bodyBuilt = buildPart(bodyInst.partId, { morph: bodyInst.morph, lod })
  applyPaint(bodyBuilt, bodyInst.paint)
  parts.body = bodyBuilt
  group.add(bodyBuilt.group)

  for (const slot of ATTACH_SLOTS) {
    const inst = blaster.parts[slot]
    const anchor = bodyBuilt.anchors[slot]
    if (!inst || !anchor) continue
    const built = buildPart(inst.partId, { morph: inst.morph, lod })
    applyPaint(built, inst.paint)
    anchor.add(built.group)
    built.group.position.set(0, 0, 0)
    parts[slot] = built
  }

  return {
    group,
    parts,
    dispose: () => {
      for (const slot of Object.keys(parts) as SlotType[]) parts[slot]?.dispose()
    },
  }
}

/** 어느 슬롯이 이 몸통에 부착 가능한지 (빈 소켓 표시용). */
export function availableSlots(blaster: Blaster): SlotType[] {
  const body = bodyOf(blaster)
  if (!body) return []
  return ATTACH_SLOTS.filter((s) => body.sockets.includes(s))
}

/** 파츠 인스턴스의 색칠 존 목록 (paint 패널 버튼 활성화용). */
export function paintableZones(inst: PartInstance): ZoneId[] {
  const built = buildPart(inst.partId, { morph: inst.morph, lod: 'drag' })
  const zones = (['primary', 'secondary', 'accent'] as ZoneId[]).filter(
    (z) => (built.zones[z]?.length ?? 0) > 0,
  )
  built.dispose()
  return zones
}
