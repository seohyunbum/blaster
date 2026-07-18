// src/ui/rangeHud.ts — 사격장 HUD: 조준점·명중 수·결과 별 (leaf).
import { resultStars } from './stars.ts'

/** 조준 선택: null=일반(맨눈) · 'reddot'=레드도트(저배율+빨간점) · 4~15=망원 스코프 배율. */
export type AimSel = number | 'reddot' | null
export type AimMode = 'none' | 'reddot' | 'scope'

export interface RangeHudCallbacks {
  onBack: () => void // 상단 "공방으로" — 라운드 종료(결과 표시)
  onRetry: () => void // 결과 카드 "한 번 더"
  onExit: () => void // 결과 카드 "공방으로" — 공방으로 실제 이동
  onSelectMag: (sel: AimSel) => void
}

/** 망원 스코프 배율 선택지 (4~15배). */
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
  hint.textContent = '끌어서 조준 · 눌러서 발사 · 아래에서 레드도트나 배율을 골라 조준'
  root.appendChild(hint)

  // 망원 스코프 오버레이 (4~15배 — 검은 원형 비네트)
  const scope = document.createElement('div')
  scope.className = 'scope-overlay hidden'
  scope.innerHTML =
    '<div class="scope-ring"></div><div class="scope-cross-v"></div><div class="scope-cross-h"></div>'
  root.appendChild(scope)

  // 레드도트 오버레이 (저배율 — 비네트 없이 빨간 점 조준경)
  const reddot = document.createElement('div')
  reddot.className = 'reddot-overlay hidden'
  reddot.innerHTML = '<div class="rd-ring"></div><div class="rd-dot"></div>'
  root.appendChild(reddot)

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

  const magChips: { sel: AimSel; el: HTMLButtonElement }[] = []
  const addChip = (sel: AimSel, label: string, cls = ''): void => {
    const b = document.createElement('button')
    b.className = 'mag-chip' + (cls ? ' ' + cls : '')
    b.textContent = label
    b.addEventListener('click', () => cb.onSelectMag(sel))
    magList.appendChild(b)
    magChips.push({ sel, el: b })
  }
  addChip(null, '일반')
  addChip('reddot', '레드도트', 'reddot-chip')
  for (const m of MAG_OPTIONS) addChip(m, `${m}배`)

  // 탄약 계기 — 우하단(조준경 위). 탄창 있을 때만 표시, 없으면 무한
  const ammoEl = document.createElement('div')
  ammoEl.className = 'ammo-counter'
  root.appendChild(ammoEl)

  const result = document.createElement('div')
  result.className = 'result-overlay hidden'
  root.appendChild(result)

  let hits = 0
  let ammoCur = 0
  let ammoMax = 0
  let reloading = false

  function renderHits(): void {
    hitsEl.textContent = `맞힌 개수: ${hits}`
  }
  renderHits()

  function renderAmmo(): void {
    if (ammoMax <= 0) {
      // 다트 팩 없음 = 무한 (지금까지와 동일)
      ammoEl.innerHTML = '<span class="ammo-inf">다트 ∞</span>'
      return
    }
    if (reloading) {
      ammoEl.innerHTML =
        '<span class="ammo-reload">재장전 중…</span>' +
        '<span class="ammo-bar"><span class="ammo-bar-fill"></span></span>'
      return
    }
    // 12발 이하면 점으로, 많으면 숫자만 (드럼·젤리 탱크)
    const dots =
      ammoMax <= 12
        ? '🔵'.repeat(ammoCur) + '⚪'.repeat(Math.max(0, ammoMax - ammoCur))
        : ''
    ammoEl.innerHTML =
      `<span class="ammo-num${ammoCur <= 0 ? ' empty' : ''}">${ammoCur} / ${ammoMax}</span>` +
      (dots ? `<span class="ammo-dots">${dots}</span>` : '')
  }
  renderAmmo()

  return {
    setHits(n: number): void {
      hits = n
      renderHits()
    },
    /** 탄약 계기 갱신. max<=0 이면 무한(탄창 없음). reloadFrac 0..1 이면 재장전 진행. */
    setAmmo(current: number, max: number, isReloading: boolean, reloadFrac = 0): void {
      const wasReloading = reloading
      ammoCur = current
      ammoMax = max
      reloading = isReloading
      const fillPct = `${Math.round(Math.max(0, Math.min(1, reloadFrac)) * 100)}%`
      // 재장전 진행 중엔 DOM 재생성 없이 진행바만 갱신 (프레임당 호출 최적화)
      if (isReloading && wasReloading) {
        const fill = ammoEl.querySelector<HTMLElement>('.ammo-bar-fill')
        if (fill) {
          fill.style.width = fillPct
          return
        }
      }
      renderAmmo()
      if (isReloading) {
        const fill = ammoEl.querySelector<HTMLElement>('.ammo-bar-fill')
        if (fill) fill.style.width = fillPct
      }
    },
    /** 조준 링 크기를 퍼짐각에 비례 (04 §4.1-3). */
    setSpread(spreadDeg: number): void {
      const size = 18 + spreadDeg * 14
      cross.style.setProperty('--ring-size', `${size}px`)
    },
    /** 조준 모드 반영 — 스코프/레드도트 오버레이·조준점·선택 칩 하이라이트. */
    setMagSelection(mode: AimMode, zoom: number): void {
      scope.classList.toggle('hidden', mode !== 'scope')
      reddot.classList.toggle('hidden', mode !== 'reddot')
      cross.style.display = mode === 'none' ? '' : 'none'
      const active: AimSel = mode === 'none' ? null : mode === 'reddot' ? 'reddot' : zoom
      for (const c of magChips) c.el.classList.toggle('active', c.sel === active)
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
