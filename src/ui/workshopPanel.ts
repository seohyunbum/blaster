// src/ui/workshopPanel.ts — 공방 패널: 파츠 선택 + 자유 변형 슬라이더 + 스탯 별 (leaf, main import 금지).
import type { Blaster, BlasterStats, MorphKey, SlotType } from '../game/types.ts'
import { partsForSlot } from '../game/parts.ts'
import { morphParamsFor, resolveMorph, type MorphArchetype } from '../game/morph.ts'
import { makeStarBar } from './stars.ts'
import { icoShoot, icoDice } from './icons.ts'

export interface WorkshopCallbacks {
  onSelectPart: (slot: SlotType, partId: string | null) => void
  onMorphInput: (slot: SlotType, key: MorphKey, t: number) => void
  onMorphCommit: (slot: SlotType, key: MorphKey, t: number) => void
  onRandomize: (slot: SlotType) => void
  onGoRange: () => void
}

const SLOT_TABS: { slot: SlotType; label: string }[] = [
  { slot: 'body', label: '몸통' },
  { slot: 'barrel', label: '배럴' },
  { slot: 'sight', label: '조준기' },
  { slot: 'grip', label: '그립' },
  { slot: 'stock', label: '스톡' },
  { slot: 'muzzle', label: '총구' },
]

const STAT_ROWS: { key: keyof BlasterStats; label: string }[] = [
  { key: 'power', label: '파워' },
  { key: 'fireRate', label: '연사' },
  { key: 'accuracy', label: '정확' },
  { key: 'handling', label: '다루기' },
]

export function createWorkshopPanel(root: HTMLElement, cb: WorkshopCallbacks) {
  let activeSlot: SlotType = 'body'
  let blaster: Blaster | null = null

  root.innerHTML = ''
  root.className = 'panel workshop-panel'

  const tabs = document.createElement('div')
  tabs.className = 'slot-tabs'
  root.appendChild(tabs)

  const parts = document.createElement('div')
  parts.className = 'part-grid'
  root.appendChild(parts)

  const morphWrap = document.createElement('div')
  morphWrap.className = 'morph-wrap'
  root.appendChild(morphWrap)

  const statBox = document.createElement('div')
  statBox.className = 'stat-box'
  root.appendChild(statBox)
  const bars = STAT_ROWS.map((r) => {
    const row = document.createElement('div')
    row.className = 'stat-row'
    const label = document.createElement('span')
    label.className = 'stat-label'
    label.textContent = r.label
    const bar = makeStarBar()
    row.appendChild(label)
    row.appendChild(bar.el)
    statBox.appendChild(row)
    return { key: r.key, bar }
  })
  const overweight = document.createElement('div')
  overweight.className = 'overweight-note'
  overweight.textContent = '무거워서 낑낑대요!'
  statBox.appendChild(overweight)

  const goBtn = document.createElement('button')
  goBtn.className = 'go-range-btn'
  goBtn.innerHTML = `${icoShoot()}<span>쏘러 가기</span>`
  goBtn.addEventListener('click', () => cb.onGoRange())
  root.appendChild(goBtn)

  function renderTabs(): void {
    tabs.innerHTML = ''
    for (const t of SLOT_TABS) {
      const b = document.createElement('button')
      b.className = 'slot-tab' + (t.slot === activeSlot ? ' active' : '')
      b.textContent = t.label
      b.addEventListener('click', () => {
        activeSlot = t.slot
        renderAll()
      })
      tabs.appendChild(b)
    }
  }

  function renderParts(): void {
    parts.innerHTML = ''
    if (!blaster) return
    const current = blaster.parts[activeSlot]?.partId ?? null
    const options = partsForSlot(activeSlot)
    if (activeSlot !== 'body') {
      parts.appendChild(partCard('없음', current === null, () => cb.onSelectPart(activeSlot, null)))
    }
    for (const def of options) {
      parts.appendChild(
        partCard(def.nameKo, current === def.id, () => cb.onSelectPart(activeSlot, def.id)),
      )
    }
  }

  function renderMorph(): void {
    morphWrap.innerHTML = ''
    if (!blaster) return
    const inst = blaster.parts[activeSlot]
    const arche: MorphArchetype | null =
      activeSlot === 'body' ? 'body' : activeSlot === 'barrel' ? 'barrel' : null
    if (!inst || !arche) {
      const hint = document.createElement('p')
      hint.className = 'morph-hint'
      hint.textContent = !inst ? '먼저 파츠를 골라요' : '이 파츠는 모양을 바꿀 수 없어요'
      morphWrap.appendChild(hint)
      return
    }
    const params = morphParamsFor(arche)
    const groups: { g: 'shape' | 'deco'; title: string }[] = [
      { g: 'shape', title: '모양 바꾸기' },
      { g: 'deco', title: '장식 붙이기' },
    ]
    for (const grp of groups) {
      const inGroup = params.filter((p) => p.group === grp.g)
      if (inGroup.length === 0) continue
      const title = document.createElement('div')
      title.className = 'morph-title'
      title.textContent = grp.title
      morphWrap.appendChild(title)

      for (const p of inGroup) {
        const t = resolveMorph(inst.morph, p.key)
        const isShape = p.group === 'shape'
        const row = document.createElement('div')
        row.className = 'morph-row'
        const lab = document.createElement('div')
        lab.className = 'morph-label'
        lab.innerHTML = `<span>${p.labelKo}</span>`
        const ends = document.createElement('div')
        ends.className = 'morph-ends'
        ends.innerHTML = `<span>${p.minLabelKo}</span><span>${p.maxLabelKo}</span>`
        const input = document.createElement('input')
        input.type = 'range'
        input.min = '0'
        input.max = '1'
        input.step = '0.01'
        input.value = String(t)
        input.className = 'morph-slider'
        const snap = (raw: number): number => (isShape ? snapCenter(raw) : raw)
        input.addEventListener('input', () => {
          cb.onMorphInput(activeSlot, p.key, snap(parseFloat(input.value)))
        })
        input.addEventListener('change', () => {
          const v = snap(parseFloat(input.value))
          input.value = String(v)
          cb.onMorphCommit(activeSlot, p.key, v)
        })
        row.appendChild(lab)
        row.appendChild(input)
        row.appendChild(ends)
        morphWrap.appendChild(row)
      }
    }

    const rnd = document.createElement('button')
    rnd.className = 'randomize-btn'
    rnd.innerHTML = `${icoDice()}<span>랜덤 섞기</span>`
    rnd.addEventListener('click', () => cb.onRandomize(activeSlot))
    morphWrap.appendChild(rnd)
  }

  function renderStats(stats: BlasterStats): void {
    for (const b of bars) {
      const raw =
        b.key === 'power'
          ? stats.powerRaw
          : b.key === 'fireRate'
            ? stats.fireRateRaw
            : b.key === 'accuracy'
              ? stats.accuracyRaw
              : stats.handling
      const clamped = Number(stats[b.key])
      b.bar.set(clamped / 2, clamped >= 10 && raw >= 10)
    }
    overweight.classList.toggle('show', stats.overweight)
  }

  function renderAll(): void {
    renderTabs()
    renderParts()
    renderMorph()
  }

  return {
    setBlaster(b: Blaster, stats: BlasterStats): void {
      blaster = b
      renderAll()
      renderStats(stats)
    },
    /** morph 드래그 중 별만 갱신 (재렌더 없이). */
    updateStats(stats: BlasterStats): void {
      renderStats(stats)
    },
    get activeSlot(): SlotType {
      return activeSlot
    },
  }
}

function partCard(label: string, active: boolean, onClick: () => void): HTMLElement {
  const b = document.createElement('button')
  b.className = 'part-card' + (active ? ' active' : '')
  b.textContent = label
  b.addEventListener('click', onClick)
  return b
}

/** 중앙(0.5) ±0.03 자석 스냅 (09 §5). */
function snapCenter(v: number): number {
  return Math.abs(v - 0.5) < 0.03 ? 0.5 : v
}
