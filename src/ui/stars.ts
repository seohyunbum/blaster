// src/ui/stars.ts — 스탯 별 표시 (연속 채움, 숫자 금지 — 결정문 3, 09 §4).
const STAR_PATH =
  'M12 2 l2.9 6 6.6 .6 -5 4.3 1.5 6.4 -6-3.4 -6 3.4 1.5-6.4 -5-4.3 6.6-.6z'

/** 0~5 연속값 별바 (부분 채움). value 는 1~10 스탯을 2로 나눈 값. */
export function makeStarBar(): {
  el: HTMLElement
  set: (value0to5: number, max?: boolean) => void
} {
  const el = document.createElement('div')
  el.className = 'starbar'
  const base = document.createElement('div')
  base.className = 'starbar-row base'
  const fill = document.createElement('div')
  fill.className = 'starbar-row fill'
  const clip = document.createElement('div')
  clip.className = 'starbar-clip'
  clip.appendChild(fill)
  for (let i = 0; i < 5; i++) {
    base.innerHTML += star('base')
    fill.innerHTML += star('fill')
  }
  el.appendChild(base)
  el.appendChild(clip)
  const set = (value0to5: number, max = false): void => {
    const v = Math.max(0, Math.min(5, value0to5))
    clip.style.width = `${(v / 5) * 100}%`
    el.classList.toggle('is-max', max)
  }
  set(0)
  return { el, set }
}

function star(kind: 'base' | 'fill'): string {
  return `<svg viewBox="0 0 24 24" class="star ${kind}" width="19" height="19"><path d="${STAR_PATH}"/></svg>`
}

/** 결과 화면 별 1~3개 (간이 별점). */
export function resultStars(n: 0 | 1 | 2 | 3): string {
  let out = ''
  for (let i = 0; i < 3; i++) {
    out += `<svg viewBox="0 0 24 24" class="rstar ${i < n ? 'on' : 'off'}" width="46" height="46"><path d="${STAR_PATH}"/></svg>`
  }
  return out
}
