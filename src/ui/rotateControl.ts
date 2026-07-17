// src/ui/rotateControl.ts — 공방 회전판 속도 선택(멈춤·0.5x·1x·2x) (leaf).

export interface RotateCallbacks {
  onSelect: (mul: number) => void
}

const OPTIONS: { mul: number; label: string }[] = [
  { mul: 0, label: '멈춤' },
  { mul: 0.5, label: '0.5x' },
  { mul: 1, label: '1x' },
  { mul: 2, label: '2x' },
]

export function createRotateControl(root: HTMLElement, cb: RotateCallbacks) {
  root.innerHTML = ''
  root.className = 'rotate-control'

  const title = document.createElement('span')
  title.className = 'rotate-title'
  title.textContent = '회전'
  root.appendChild(title)

  const chips: { mul: number; el: HTMLButtonElement }[] = []
  for (const o of OPTIONS) {
    const b = document.createElement('button')
    b.className = 'rotate-chip'
    b.textContent = o.label
    b.addEventListener('click', () => cb.onSelect(o.mul))
    root.appendChild(b)
    chips.push({ mul: o.mul, el: b })
  }

  return {
    setActive(mul: number): void {
      for (const c of chips) c.el.classList.toggle('active', c.mul === mul)
    },
  }
}
