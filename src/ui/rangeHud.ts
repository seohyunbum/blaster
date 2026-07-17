// src/ui/rangeHud.ts — 사격장 HUD: 조준점·명중 수·결과 별 (leaf).
import { resultStars } from './stars.ts'

export interface RangeHudCallbacks {
  onBack: () => void
  onRetry: () => void
}

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
  hint.textContent = '화면을 끌어서 조준하고, 눌러서 발사!'
  root.appendChild(hint)

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
        cb.onBack()
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
