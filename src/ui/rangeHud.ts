// src/ui/rangeHud.ts — 사격장 HUD: 조준점·명중 수·결과 별 (leaf).
import { resultStars } from './stars.ts'

export interface RangeHudCallbacks {
  onBack: () => void // 상단 "공방으로" — 라운드 종료(결과 표시)
  onRetry: () => void // 결과 카드 "한 번 더"
  onExit: () => void // 결과 카드 "공방으로" — 공방으로 실제 이동
  /** 배율 선택 — null = 조준경 끄기(일반), 4~15 = 그 배율로 조준경 켜기. */
  onSelectMag: (mag: number | null) => void
}

/** 조준경 배율 선택지 (4~15배). */
export const MAG_OPTIONS: readonly number[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

export function createRangeHud(root: HTMLElement, cb: RangeHudCallbacks) {
  root.innerHTML = ''
  root.className = 'range-hud'

  const cross = document.createElement('div')
  cross.className = 'crosshair'
  cross.innerHTML =
    '<span class="ch-dot"></span><span class="ch-ring"></span>'
  root.appendChild(cross)

  const top = document.createElement('div')
  top.className = 'range-top'
  const hitsEl = document.createElement('div')
  hitsEl.className = 'hits-counter'
  const backBtn = document.createElement('button')
  backBtn.className = 'back-btn'
  backBtn.textContent = '공방으로'
  backBtn.addEventListener('click', () => cb.onBack())
  top.appendChild(hitsEl)
  top.appendChild(backBtn)
  root.appendChild(top)

  const hint = document.createElement('div')
  hint.className = 'range-hint'
  hint.textContent = '끌어서 조준 · 눌러서 발사 · 아래에서 배율(4~15배)을 골라 조준'
  root.appendChild(hint)

  // 스코프 오버레이 (조준경 ON 일 때 원형 비네트)
  const scope = document.createElement('div')
  scope.className = 'scope-overlay hidden'
  scope.innerHTML =
    '<div class="scope-ring"></div><div class="scope-cross-v"></div><div class="scope-cross-h"></div>'
  root.appendChild(scope)

  // 배율 선택 시스템 — 일반(끄기) + 4~15배 중 하나 선택
  const zoomCtl = document.createElement('div')
  zoomCtl.className = 'zoom-control'
  const title = document.createElement('span')
  title.className = 'zoom-title'
  title.textContent = '조준경'
  zoomCtl.appendChild(title)
  const magList = document.createElement('div')
  magList.className = 'mag-list'
  zoomCtl.appendChild(magList)
  root.appendChild(zoomCtl)

  const magChips: { mag: number | null; el: HTMLButtonElement }[] = []
  const addChip = (mag: number | null, label: string): void => {
    const b = document.createElement('button')
    b.className = 'mag-chip'
    b.textContent = label
    b.addEventListener('click', () => cb.onSelectMag(mag))
    magList.appendChild(b)
    magChips.push({ mag, el: b })
  }
  addChip(null, '일반')
  for (const m of MAG_OPTIONS) addChip(m, `${m}배`)

  const result = document.createElement('div')
  result.className = 'result-overlay hidden'
  root.appendChild(result)

  let hits = 0

  function renderHits(): void {
    hitsEl.textContent = `맞힌 개수: ${hits}`
  }
  renderHits()

  return {
    setHits(n: number): void {
      hits = n
      renderHits()
    },
    /** 조준 링 크기를 퍼짐각에 비례 (04 §4.1-3). */
    setSpread(spreadDeg: number): void {
      const size = 18 + spreadDeg * 14
      cross.style.setProperty('--ring-size', `${size}px`)
    },
    /** 배율 선택 상태 반영 — 스코프 비네트·조준점·선택 칩 하이라이트. */
    setMagSelection(scopedOn: boolean, zoom: number): void {
      scope.classList.toggle('hidden', !scopedOn)
      cross.style.display = scopedOn ? 'none' : ''
      const active: number | null = scopedOn ? zoom : null
      for (const c of magChips) c.el.classList.toggle('active', c.mag === active)
    },
    showResult(stars: 0 | 1 | 2 | 3, hitCount: number): void {
      result.innerHTML =
        `<div class="result-card">` +
        `<div class="result-title">${stars >= 3 ? '완벽해요!' : stars >= 1 ? '잘했어요!' : '다시 해볼까요?'}</div>` +
        `<div class="result-stars">${resultStars(stars)}</div>` +
        `<div class="result-hits">풍선 ${hitCount}개 명중</div>` +
        `<div class="result-btns">` +
        `<button class="result-retry">한 번 더</button>` +
        `<button class="result-back">공방으로</button>` +
        `</div></div>`
      result.classList.remove('hidden')
      result.querySelector('.result-retry')?.addEventListener('click', () => {
        result.classList.add('hidden')
        cb.onRetry()
      })
      result.querySelector('.result-back')?.addEventListener('click', () => {
        result.classList.add('hidden')
        cb.onExit()
      })
    },
    hideResult(): void {
      result.classList.add('hidden')
    },
    /** 히트 숫자 팝업 (점수 이벤트 — 스탯 UI 아님, 결정문 3 무관). */
    popNumber(points: number, sx: number, sy: number): void {
      const el = document.createElement('div')
      el.className = 'hit-number'
      el.textContent = `+${points}`
      el.style.left = `${sx}px`
      el.style.top = `${sy}px`
      root.appendChild(el)
      el.addEventListener('animationend', () => el.remove())
    },
  }
}
