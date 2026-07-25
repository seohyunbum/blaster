// src/ui/streakBadge.ts — 만들기 화면 위쪽에 표시하는 연승(아레나 5스테이지 클리어) 뱃지 (leaf).
// 값은 localStorage 에 저장(세이브 스키마 미변경, additive).
const STORAGE_KEY = 'blaster_win_streak'

function readStreak(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  } catch {
    return 0
  }
}

export interface StreakBadge {
  readonly value: number
  increment(): void
  setVisible(visible: boolean): void
}

export function createStreakBadge(host: HTMLElement): StreakBadge {
  let value = readStreak()

  const el = document.createElement('div')
  el.className = 'streak-badge'
  el.style.cssText =
    'position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:30;' +
    'background:linear-gradient(90deg,#ff8a2b,#ff6b3d);color:#fff;font:700 15px/1 system-ui,sans-serif;' +
    'padding:8px 16px;border-radius:999px;box-shadow:0 2px 10px rgba(255,120,40,.4);pointer-events:none;display:none'
  host.appendChild(el)

  let shouldShow = false
  function render(): void {
    el.textContent = `🔥 연승 ${value}`
    el.style.display = shouldShow && value > 0 ? '' : 'none'
  }
  render()

  return {
    get value(): number {
      return value
    },
    increment(): void {
      value += 1
      try {
        localStorage.setItem(STORAGE_KEY, String(value))
      } catch {
        // 저장 실패해도 표시는 유지
      }
      render()
    },
    setVisible(visible: boolean): void {
      shouldShow = visible
      render()
    },
  }
}
