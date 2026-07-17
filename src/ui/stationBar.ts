// src/ui/stationBar.ts — 상단 스테이션 탭(공방/꾸미기/사격장) + 되돌리기 (leaf).
import { icoWorkshop, icoPaint, icoRange, icoUndo, icoCollection } from './icons.ts'

export type StationId = 'workshop' | 'paint' | 'range' | 'collection'

export interface StationCallbacks {
  onStation: (id: StationId) => void
  onUndo: () => void
}

const STATIONS: { id: StationId; label: string; ico: () => string }[] = [
  { id: 'workshop', label: '만들기', ico: icoWorkshop },
  { id: 'paint', label: '꾸미기', ico: icoPaint },
  { id: 'range', label: '쏘기', ico: icoRange },
  { id: 'collection', label: '보관함', ico: icoCollection },
]

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
  for (const s of STATIONS) {
    const b = document.createElement('button')
    b.className = 'station-tab'
    b.innerHTML = `${s.ico()}<span>${s.label}</span>`
    b.addEventListener('click', () => cb.onStation(s.id))
    tabsWrap.appendChild(b)
    buttons.push({ id: s.id, el: b })
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
