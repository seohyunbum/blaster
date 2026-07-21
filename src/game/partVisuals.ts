// src/game/partVisuals.ts — 슬롯별 시각 빌더를 묶는 typed registry 파사드.
import * as THREE from 'three'
import type { PartId, SlotType } from './types.ts'
import { SLOT_DEFS, SLOT_ORDER } from './definitions.ts'
import { fixedMaterial } from './materials.ts'
import { buildBody } from './visuals/bodyVisuals.ts'
import { buildBarrel } from './visuals/barrelVisuals.ts'
import { buildSight } from './visuals/sightVisuals.ts'
import { buildGrip } from './visuals/gripVisuals.ts'
import { buildStock } from './visuals/stockVisuals.ts'
import { buildMuzzle } from './visuals/muzzleVisuals.ts'
import { buildMagazine } from './visuals/magazineVisuals.ts'
import { buildStrap } from './visuals/strapVisuals.ts'
import { VISUAL_RECIPE_ID_SET } from './visuals/visualRecipeIds.ts'
import type { BuildOpts, BuiltPart } from './visuals/types.ts'

export type { AnchorId, BuildOpts, BuiltPart } from './visuals/types.ts'
export { VISUAL_RECIPE_IDS } from './visuals/visualRecipeIds.ts'

type PartVisualBuilder = (partId: PartId, opts: BuildOpts) => BuiltPart

export const PART_VISUAL_BUILDERS = {
  body: buildBody,
  barrel: buildBarrel,
  magazine: buildMagazine,
  sight: buildSight,
  stock: buildStock,
  muzzle: buildMuzzle,
  grip: buildGrip,
  strap: buildStrap,
} satisfies Record<SlotType, PartVisualBuilder>

const FALLBACK_MAT = fixedMaterial(0x999999)

function buildFallback(): BuiltPart {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1), FALLBACK_MAT)
  group.add(mesh)
  return {
    group,
    zones: { primary: [mesh] },
    anchors: {},
    dispose: () => mesh.geometry.dispose(),
  }
}

function slotForPartId(partId: PartId): SlotType | null {
  for (const slot of SLOT_ORDER) {
    if (partId.startsWith(SLOT_DEFS[slot].idPrefix)) return slot
  }
  return null
}

export function buildPart(partId: PartId, opts: BuildOpts): BuiltPart {
  const slot = slotForPartId(partId)
  if (!slot || !VISUAL_RECIPE_ID_SET.has(partId)) return buildFallback()
  return PART_VISUAL_BUILDERS[slot](partId, opts)
}

export function countMeshes(group: THREE.Object3D): number {
  let count = 0
  group.traverse((object) => { if (object instanceof THREE.Mesh) count += 1 })
  return count
}
