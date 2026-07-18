// src/ui/collectionPanel.ts — 내 블래스터 보관함: 새로 만들기·열기·복제·이름·삭제 (leaf).
import type { Blaster } from '../game/types.ts'
import { computeStats } from '../game/parts.ts'
import { resolveHex } from '../game/palette.ts'

export interface CollectionCallbacks {
  onNew: () => void
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImportFile: (file: File) => void
}

export function createCollectionPanel(root: HTMLElement, cb: CollectionCallbacks) {
  root.innerHTML = ''
  root.className = 'panel collection-panel'

  const newBtn = document.createElement('button')
  newBtn.className = 'new-blaster-btn'
  newBtn.textContent = '＋ 새 블래스터'
  newBtn.addEventListener('click', () => cb.onNew())
  root.appendChild(newBtn)

  // 백업 파일 내보내기/불러오기 — 코드 업데이트와 무관하게 내 총들을 안전 보관
  const backupRow = document.createElement('div')
  backupRow.className = 'backup-row'
  const exportBtn = document.createElement('button')
  exportBtn.className = 'backup-btn'
  exportBtn.textContent = '💾 백업 저장'
  exportBtn.addEventListener('click', () => cb.onExport())
  const importBtn = document.createElement('button')
  importBtn.className = 'backup-btn'
  importBtn.textContent = '📂 백업 불러오기'
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'application/json,.json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]
    if (f) cb.onImportFile(f)
    fileInput.value = '' // 같은 파일 재선택 허용
  })
  importBtn.addEventListener('click', () => fileInput.click())
  backupRow.append(exportBtn, importBtn, fileInput)
  root.appendChild(backupRow)

  const list = document.createElement('div')
  list.className = 'collection-list'
  root.appendChild(list)

  function starText(v: number): string {
    const full = Math.round(v / 2) // 1~10 → 0~5
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
  }

  function render(blasters: Blaster[], activeId: string | null): void {
    list.innerHTML = ''
    const sorted = [...blasters].sort((a, b) => b.createdAt - a.createdAt)
    for (const b of sorted) {
      const stats = computeStats(b)
      const primary = b.parts.body?.paint.primary?.color ?? 'blasterBlue'
      const hex = resolveHex(primary).toString(16).padStart(6, '0')
      const isActive = b.id === activeId

      const card = document.createElement('div')
      card.className = 'collection-card' + (isActive ? ' active' : '')

      const swatch = document.createElement('div')
      swatch.className = 'coll-swatch'
      swatch.style.background = `#${hex}`
      card.appendChild(swatch)

      const mid = document.createElement('div')
      mid.className = 'coll-mid'
      const nameInput = document.createElement('input')
      nameInput.className = 'coll-name'
      nameInput.value = b.name
      nameInput.maxLength = 16
      const commit = (): void => {
        const v = nameInput.value.trim() || b.name
        nameInput.value = v
        if (v !== b.name) cb.onRename(b.id, v)
      }
      nameInput.addEventListener('change', commit)
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nameInput.blur()
      })
      mid.appendChild(nameInput)
      const statLine = document.createElement('div')
      statLine.className = 'coll-stats'
      statLine.innerHTML =
        `<span>파워 <b>${starText(stats.power)}</b></span>` +
        `<span>정확 <b>${starText(stats.accuracy)}</b></span>`
      mid.appendChild(statLine)
      if (isActive) {
        const badge = document.createElement('div')
        badge.className = 'coll-badge'
        badge.textContent = '지금 만드는 중'
        mid.appendChild(badge)
      }
      card.appendChild(mid)

      const btns = document.createElement('div')
      btns.className = 'coll-btns'
      const openBtn = document.createElement('button')
      openBtn.className = 'coll-open'
      openBtn.textContent = isActive ? '만들기' : '열기'
      openBtn.addEventListener('click', () => cb.onOpen(b.id))
      const dupBtn = document.createElement('button')
      dupBtn.className = 'coll-dup'
      dupBtn.textContent = '복제'
      dupBtn.addEventListener('click', () => cb.onDuplicate(b.id))
      const delBtn = document.createElement('button')
      delBtn.className = 'coll-del'
      delBtn.textContent = '삭제'
      delBtn.disabled = blasters.length <= 1
      delBtn.addEventListener('click', () => cb.onDelete(b.id))
      btns.append(openBtn, dupBtn, delBtn)
      card.appendChild(btns)

      list.appendChild(card)
    }
  }

  return {
    setData(blasters: Blaster[], activeId: string | null): void {
      render(blasters, activeId)
    },
  }
}
