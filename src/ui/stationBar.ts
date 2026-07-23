// src/ui/stationBar.ts — 상단 스테이션 탭(공방/꾸미기/사격장/PVP/보관함) + 되돌리기 (leaf).
import { icoWorkshop, icoPaint, icoRange, icoPvp, icoUndo, icoCollection } from './icons.ts'
import { STATION_DEFS, STATION_ORDER, type StationIcon } from '../game/definitions.ts'
import type { StationId } from '../game/definitions.ts'

export type { StationId } from '../game/definitions.ts'

export interface StationCallbacks {
  onStation: (id: StationId) => void
  onUndo: () => void
}

const ICONS: Record<StationIcon, () => string> = {
  workshop: icoWorkshop,
  paint: icoPaint,
  range: icoRange,
  pvp: icoPvp,
  collection: icoCollection,
}

export function createStationBar(root: HTMLElement, cb: StationCallbacks) {
  root.innerHTML = ''
  root.className = 'station-bar'

  const undoBtn = document.createElement('button')
  undoBtn.className = 'undo-btn'
  undoBtn.innerHTML = icoUndo()
  undoBtn.title = '되돌리기'
  undoBtn.addEventListener('click', () => cb.onUndo())
  root.appendChild(undoBtn)

  const tabsWrap = document.createElement('div')
  tabsWrap.className = 'station-tabs'
  root.appendChild(tabsWrap)

  const nameEl = document.createElement('div')
  nameEl.className = 'blaster-name'
  root.appendChild(nameEl)

  const buttons: { id: StationId; el: HTMLButtonElement }[] = []
  for (const id of STATION_ORDER) {
    const s = STATION_DEFS[id]
    const b = document.createElement('button')
    b.className = 'station-tab'
    b.innerHTML = `${ICONS[s.icon]()}<span>${s.labelKo}</span>`
    b.addEventListener('click', () => cb.onStation(id))
    tabsWrap.appendChild(b)
    buttons.push({ id, el: b })
  }

  return {
    setActive(id: StationId): void {
      for (const b of buttons) b.el.classList.toggle('active', b.id === id)
    },
    setName(name: string): void {
      nameEl.textContent = name
    },
    setCanUndo(can: boolean): void {
      undoBtn.disabled = !can
    },
  }
}
