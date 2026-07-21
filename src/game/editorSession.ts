// src/game/editorSession.ts — 편집 한 세션의 파츠·모프·색칠·undo 상태 소유자.
// 렌더·DOM·저장·오디오는 모르며 변경 여부만 반환한다.
import type {
  Blaster,
  Finish,
  MorphKey,
  MorphState,
  PartPaint,
  SlotType,
  ZoneId,
} from './types.ts'
import type { PaletteKey } from './palette.ts'
import { ALL_PALETTE_KEYS, canBePrimary } from './palette.ts'
import { RANDOMIZABLE_SLOTS } from './definitions.ts'
import { archetypeForSlot, MORPH_PARAMS, type MorphArchetype } from './morph.ts'
import { partsForSlot } from './parts.ts'
import { makeInstance } from './save.ts'
import { PRESETS, PRESET_ZONE_ORDER } from './presets.ts'

export interface RandomSource {
  next(): number
}

export interface Clock {
  now(): number
}

const browserRandom: RandomSource = { next: () => Math.random() }
const browserClock: Clock = { now: () => performance.now() }
const FINISHES: readonly Finish[] = ['matte', 'gloss', 'metal']

type PartsSnapshot = Partial<
  Record<SlotType, { partId: string; morph: MorphState; paint: PartPaint }>
>

export interface MorphInputResult {
  changed: boolean
  playSound: boolean
}

export class EditorSession {
  private activeValue: Blaster
  private readonly undoStack: PartsSnapshot[] = []
  private morphGesture: PartsSnapshot | null = null
  private morphDirtyValue = false
  private lastMorphSoundAt = 0
  private readonly random: RandomSource
  private readonly clock: Clock

  constructor(
    active: Blaster,
    random: RandomSource = browserRandom,
    clock: Clock = browserClock,
  ) {
    this.activeValue = active
    this.random = random
    this.clock = clock
  }

  setActive(active: Blaster, clearHistory = true): void {
    this.activeValue = active
    this.cancelGesture()
    if (clearHistory) this.undoStack.length = 0
  }

  cancelGesture(): void {
    this.morphGesture = null
    this.morphDirtyValue = false
  }

  selectPart(slot: SlotType, partId: string | null): boolean {
    const prev = this.activeValue.parts[slot]
    if (partId === null && !prev) return false
    if (partId !== null && prev?.partId === partId) return false
    this.cancelGesture()
    this.pushUndo()
    if (partId === null) {
      if (slot !== 'body') delete this.activeValue.parts[slot]
    } else {
      const inst = makeInstance(partId)
      if (prev) inst.paint = prev.paint
      this.activeValue.parts[slot] = inst
    }
    return true
  }

  morphInput(slot: SlotType, key: MorphKey, t: number): MorphInputResult {
    const inst = this.activeValue.parts[slot]
    if (!inst) return { changed: false, playSound: false }
    if (!this.morphGesture) this.morphGesture = this.captureSnapshot()
    inst.morph = { ...inst.morph, [key]: t }
    this.morphDirtyValue = true
    const now = this.clock.now()
    const playSound = now - this.lastMorphSoundAt > 80
    if (playSound) this.lastMorphSoundAt = now
    return { changed: true, playSound }
  }

  morphCommit(slot: SlotType, key: MorphKey, t: number): boolean {
    const inst = this.activeValue.parts[slot]
    if (!inst) return false
    inst.morph = { ...inst.morph, [key]: t }
    this.morphDirtyValue = false
    if (this.morphGesture) {
      this.undoStack.push(this.morphGesture)
      this.trimUndo()
      this.morphGesture = null
    }
    return true
  }

  consumeMorphDirty(): boolean {
    if (!this.morphDirtyValue) return false
    this.morphDirtyValue = false
    return true
  }

  randomizeSlot(slot: SlotType): boolean {
    const inst = this.activeValue.parts[slot]
    if (!inst) return false
    const archetype = archetypeForSlot(slot)
    if (!archetype) return false
    this.cancelGesture()
    this.pushUndo()
    inst.morph = this.randomMorphFor(archetype)
    return true
  }

  randomizeAll(): boolean {
    this.cancelGesture()
    this.pushUndo()
    const primaryKeys = ALL_PALETTE_KEYS.filter(canBePrimary)
    const randomPaint = (): PartPaint => ({
      primary: { color: this.pick(primaryKeys), finish: this.pick(FINISHES) },
      secondary: { color: this.pick(ALL_PALETTE_KEYS), finish: this.pick(FINISHES) },
      accent: { color: this.pick(ALL_PALETTE_KEYS), finish: this.pick(FINISHES) },
    })
    const next: Blaster['parts'] = {}
    next.body = {
      partId: this.pick(partsForSlot('body')).id,
      paint: randomPaint(),
      morph: this.randomMorphFor('body'),
    }
    for (const slot of RANDOMIZABLE_SLOTS) {
      if (slot === 'body') continue
      const options = partsForSlot(slot)
      if (options.length === 0 || this.random.next() < 0.22) continue
      const archetype = archetypeForSlot(slot)
      next[slot] = {
        partId: this.pick(options).id,
        paint: randomPaint(),
        morph: archetype ? this.randomMorphFor(archetype) : {},
      }
    }
    this.activeValue.parts = next
    return true
  }

  pickColor(slot: SlotType, zone: ZoneId, color: PaletteKey): boolean {
    const inst = this.activeValue.parts[slot]
    if (!inst) return false
    const finish = inst.paint[zone]?.finish ?? 'gloss'
    inst.paint[zone] = { color, finish }
    return true
  }

  pickFinish(slot: SlotType, zone: ZoneId, finish: Finish): boolean {
    const inst = this.activeValue.parts[slot]
    if (!inst) return false
    const color = inst.paint[zone]?.color ?? 'blasterBlue'
    inst.paint[zone] = { color, finish }
    return true
  }

  applyPreset(index: number): boolean {
    const preset = PRESETS[index]
    if (!preset) return false
    for (const slot of Object.keys(this.activeValue.parts) as SlotType[]) {
      const inst = this.activeValue.parts[slot]
      if (!inst) continue
      PRESET_ZONE_ORDER.forEach((zone, keyIndex) => {
        const current = inst.paint[zone]
        if (current) inst.paint[zone] = { color: preset.keys[keyIndex]!, finish: current.finish }
      })
    }
    return true
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop()
    if (!snapshot) return false
    this.cancelGesture()
    const nextSlots = new Set(Object.keys(snapshot) as SlotType[])
    for (const slot of Object.keys(this.activeValue.parts) as SlotType[]) {
      if (!nextSlots.has(slot) && slot !== 'body') delete this.activeValue.parts[slot]
    }
    for (const slot of nextSlots) {
      const saved = snapshot[slot]!
      const current = this.activeValue.parts[slot]
      if (current) {
        current.partId = saved.partId
        current.morph = { ...saved.morph }
      } else {
        const inst = makeInstance(saved.partId, saved.morph)
        inst.paint = clonePaint(saved.paint)
        this.activeValue.parts[slot] = inst
      }
    }
    return true
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  private randomMorphFor(archetype: MorphArchetype): MorphState {
    const morph: MorphState = {}
    for (const param of MORPH_PARAMS) {
      if (param.archetype !== archetype) continue
      if (param.group === 'deco' && this.random.next() < 0.5) continue
      if (param.discrete) {
        const steps = Math.max(1, param.max - param.min)
        morph[param.key] = Math.round(this.random.next() * steps) / steps
      } else {
        morph[param.key] = 0.1 + this.random.next() * 0.8
      }
    }
    return morph
  }

  private pick<T>(values: readonly T[]): T {
    return values[Math.floor(this.random.next() * values.length)]!
  }

  private captureSnapshot(): PartsSnapshot {
    const snapshot: PartsSnapshot = {}
    for (const slot of Object.keys(this.activeValue.parts) as SlotType[]) {
      const inst = this.activeValue.parts[slot]
      if (!inst) continue
      snapshot[slot] = {
        partId: inst.partId,
        morph: { ...inst.morph },
        paint: clonePaint(inst.paint),
      }
    }
    return snapshot
  }

  private pushUndo(): void {
    this.undoStack.push(this.captureSnapshot())
    this.trimUndo()
  }

  private trimUndo(): void {
    while (this.undoStack.length > 30) this.undoStack.shift()
  }
}

function clonePaint(paint: PartPaint): PartPaint {
  const copy: PartPaint = {}
  for (const zone of ['primary', 'secondary', 'accent'] as const) {
    const value = paint[zone]
    if (value) copy[zone] = { color: value.color, finish: value.finish }
  }
  return copy
}
