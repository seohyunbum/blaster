// src/ui/paintPanel.ts — 꾸미기 패널: 파츠·존 선택 + 팔레트 색칠 + 프리셋 (leaf).
import type { Blaster, Finish, SlotType, ZoneId } from '../game/types.ts'
import { ALL_PALETTE_KEYS, canBePrimary, TOY_PALETTE, type PaletteKey } from '../game/palette.ts'
import { paintableZones } from '../game/assembly.ts'
import { PRESETS } from '../game/presets.ts'

export interface PaintCallbacks {
  onSelectPaintPart: (slot: SlotType) => void
  onPickColor: (slot: SlotType, zone: ZoneId, color: PaletteKey) => void
  onPickFinish: (slot: SlotType, zone: ZoneId, finish: Finish) => void
  onApplyPreset: (index: number) => void
}

const ZONE_LABELS: { zone: ZoneId; label: string }[] = [
  { zone: 'primary', label: '본체색' },
  { zone: 'secondary', label: '보조색' },
  { zone: 'accent', label: '포인트색' },
]

const FINISHES: { finish: Finish; label: string }[] = [
  { finish: 'matte', label: '매트' },
  { finish: 'gloss', label: '광택' },
  { finish: 'metal', label: '메탈' },
]

// 프리셋 정본 = src/game/presets.ts (미리보기와 실제 적용이 같은 배열을 공유)

export function createPaintPanel(root: HTMLElement, cb: PaintCallbacks) {
  let blaster: Blaster | null = null
  let activeSlot: SlotType = 'body'
  let activeZone: ZoneId = 'primary'

  root.innerHTML = ''
  root.className = 'panel paint-panel'

  const partTabs = document.createElement('div')
  partTabs.className = 'slot-tabs'
  root.appendChild(partTabs)

  const zoneRow = document.createElement('div')
  zoneRow.className = 'zone-row'
  root.appendChild(zoneRow)

  const swatches = document.createElement('div')
  swatches.className = 'swatch-grid'
  root.appendChild(swatches)

  const finishRow = document.createElement('div')
  finishRow.className = 'finish-row'
  root.appendChild(finishRow)

  const presetTitle = document.createElement('div')
  presetTitle.className = 'preset-title'
  presetTitle.textContent = '한 번에 꾸미기'
  root.appendChild(presetTitle)

  const presetRow = document.createElement('div')
  presetRow.className = 'preset-row'
  root.appendChild(presetRow)
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button')
    b.className = 'preset-btn'
    b.innerHTML =
      `<span class="preset-name">${p.name}</span>` +
      `<span class="preset-dots">${p.keys.map((k) => `<i style="background:#${hex(k)}"></i>`).join('')}</span>`
    b.addEventListener('click', () => cb.onApplyPreset(i))
    presetRow.appendChild(b)
  })

  function slotsOfBlaster(): SlotType[] {
    if (!blaster) return []
    return (
      ['body', 'barrel', 'magazine', 'sight', 'grip', 'stock', 'muzzle'] as SlotType[]
    ).filter((s) => blaster!.parts[s])
  }

  function renderPartTabs(): void {
    partTabs.innerHTML = ''
    const names: Record<string, string> = {
      body: '몸통',
      barrel: '배럴',
      magazine: '다트 팩',
      sight: '조준기',
      grip: '그립',
      stock: '스톡',
      muzzle: '총구',
    }
    for (const s of slotsOfBlaster()) {
      const b = document.createElement('button')
      b.className = 'slot-tab' + (s === activeSlot ? ' active' : '')
      b.textContent = names[s] ?? s
      b.addEventListener('click', () => {
        activeSlot = s
        activeZone = 'primary'
        cb.onSelectPaintPart(s)
        renderAll()
      })
      partTabs.appendChild(b)
    }
  }

  function renderZones(): void {
    zoneRow.innerHTML = ''
    if (!blaster) return
    const inst = blaster.parts[activeSlot]
    const zones = inst ? paintableZones(inst) : []
    for (const z of ZONE_LABELS) {
      const b = document.createElement('button')
      const enabled = zones.includes(z.zone)
      b.className = 'zone-btn' + (z.zone === activeZone ? ' active' : '') + (enabled ? '' : ' disabled')
      b.textContent = z.label
      b.disabled = !enabled
      b.addEventListener('click', () => {
        activeZone = z.zone
        renderAll()
      })
      zoneRow.appendChild(b)
    }
  }

  function renderSwatches(): void {
    swatches.innerHTML = ''
    if (!blaster) return
    const cur = blaster.parts[activeSlot]?.paint[activeZone]?.color
    // 본체색(primary) = 밝은 색 + 검정 / 보조·포인트 = 전 색
    const keys = ALL_PALETTE_KEYS.filter((k) => (activeZone === 'primary' ? canBePrimary(k) : true))
    for (const k of keys) {
      const b = document.createElement('button')
      b.className = 'swatch' + (k === cur ? ' active' : '')
      b.style.background = `#${hex(k)}`
      b.title = k
      b.addEventListener('click', () => cb.onPickColor(activeSlot, activeZone, k))
      swatches.appendChild(b)
    }
  }

  function renderFinish(): void {
    finishRow.innerHTML = ''
    if (!blaster) return
    const cur = blaster.parts[activeSlot]?.paint[activeZone]?.finish
    for (const f of FINISHES) {
      const b = document.createElement('button')
      b.className = 'finish-btn' + (f.finish === cur ? ' active' : '')
      b.textContent = f.label
      b.addEventListener('click', () => cb.onPickFinish(activeSlot, activeZone, f.finish))
      finishRow.appendChild(b)
    }
  }

  function renderAll(): void {
    renderPartTabs()
    renderZones()
    renderSwatches()
    renderFinish()
  }

  return {
    setBlaster(b: Blaster): void {
      blaster = b
      if (!b.parts[activeSlot]) activeSlot = 'body'
      renderAll()
    },
    get activeSlot(): SlotType {
      return activeSlot
    },
    get activeZone(): ZoneId {
      return activeZone
    },
  }
}

function hex(key: PaletteKey): string {
  return TOY_PALETTE[key].toString(16).padStart(6, '0')
}
