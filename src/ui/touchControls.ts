// src/ui/touchControls.ts — 폰(터치)용 PVP 조종 UI (leaf).
// 왼쪽 가상 조이스틱(이동) · 오른쪽 드래그(시야 회전) · 오른쪽 아래 쏘기 버튼.
// 데스크톱(마우스+키보드)에는 영향 없음 — 모드가 coarse 포인터일 때만 보이게 한다.

export interface TouchControlsCallbacks {
  /** 조이스틱 방향. x: 오른쪽(+)/왼쪽(-), y: 앞(+)/뒤(-), 각각 -1..1. */
  onMove(x: number, y: number): void
  /** 오른쪽 화면 드래그의 픽셀 이동량 — 시야 회전용. */
  onLook(dx: number, dy: number): void
  /** 쏘기 버튼 눌림/뗌. */
  onFire(down: boolean): void
}

export interface TouchControls {
  setVisible(visible: boolean): void
  readonly isCoarse: boolean
  destroy(): void
}

const JOY_RADIUS = 52 // 엄지 이동 최대 반경(px)

function el(css: string, text?: string): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText = css
  if (text) d.textContent = text
  return d
}

export function createTouchControls(host: HTMLElement, cb: TouchControlsCallbacks): TouchControls {
  const isCoarse =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

  const PAD = 'pointer-events:auto;touch-action:none'
  const root = el('position:absolute;inset:0;z-index:22;display:none;touch-action:none;user-select:none')
  const lookZone = el(`position:absolute;right:0;top:0;width:58%;height:100%;${PAD}`)
  const joyBase = el(
    `position:absolute;left:26px;bottom:30px;width:132px;height:132px;border-radius:50%;` +
      `background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.55);${PAD}`,
  )
  const joyThumb = el(
    'position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;' +
      'border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.3)',
  )
  joyBase.appendChild(joyThumb)
  const fireBtn = el(
    `position:absolute;right:30px;bottom:44px;width:104px;height:104px;border-radius:50%;` +
      `display:flex;align-items:center;justify-content:center;color:#fff;font:800 22px/1 system-ui,sans-serif;` +
      `background:#ef5a2b;border:3px solid rgba(255,255,255,.75);box-shadow:0 4px 14px rgba(0,0,0,.35);${PAD}`,
    '쏘기',
  )
  root.append(lookZone, joyBase, fireBtn)
  host.appendChild(root)

  // ── 조이스틱 ──
  let joyId = -1
  let joyCX = 0
  let joyCY = 0
  function joyMove(e: PointerEvent): void {
    if (e.pointerId !== joyId) return
    let dx = e.clientX - joyCX
    let dy = e.clientY - joyCY
    const len = Math.hypot(dx, dy)
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS
      dy = (dy / len) * JOY_RADIUS
    }
    joyThumb.style.transform = `translate(${dx}px,${dy}px)`
    cb.onMove(dx / JOY_RADIUS, -dy / JOY_RADIUS) // 위(-y)로 밀면 전진(+)
    e.preventDefault()
  }
  function joyUp(e: PointerEvent): void {
    if (e.pointerId !== joyId) return
    joyId = -1
    joyThumb.style.transform = 'translate(0,0)'
    cb.onMove(0, 0)
  }
  joyBase.addEventListener('pointerdown', (e) => {
    if (joyId !== -1) return
    joyId = e.pointerId
    const r = joyBase.getBoundingClientRect()
    joyCX = r.left + r.width / 2
    joyCY = r.top + r.height / 2
    joyBase.setPointerCapture(e.pointerId)
    joyMove(e)
    e.preventDefault()
  })
  joyBase.addEventListener('pointermove', joyMove)
  joyBase.addEventListener('pointerup', joyUp)
  joyBase.addEventListener('pointercancel', joyUp)

  // ── 시야 드래그 ──
  let lookId = -1
  let lookX = 0
  let lookY = 0
  lookZone.addEventListener('pointerdown', (e) => {
    if (lookId !== -1) return
    lookId = e.pointerId
    lookX = e.clientX
    lookY = e.clientY
    lookZone.setPointerCapture(e.pointerId)
    e.preventDefault()
  })
  lookZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return
    cb.onLook(e.clientX - lookX, e.clientY - lookY)
    lookX = e.clientX
    lookY = e.clientY
    e.preventDefault()
  })
  const lookEnd = (e: PointerEvent): void => {
    if (e.pointerId === lookId) lookId = -1
  }
  lookZone.addEventListener('pointerup', lookEnd)
  lookZone.addEventListener('pointercancel', lookEnd)

  // ── 쏘기 버튼 ──
  const setFire = (down: boolean) => (e: PointerEvent): void => {
    fireBtn.style.filter = down ? 'brightness(.85)' : ''
    cb.onFire(down)
    e.preventDefault()
  }
  fireBtn.addEventListener('pointerdown', setFire(true))
  fireBtn.addEventListener('pointerup', setFire(false))
  fireBtn.addEventListener('pointercancel', setFire(false))
  fireBtn.addEventListener('pointerleave', setFire(false))

  return {
    isCoarse,
    setVisible(visible: boolean): void {
      root.style.display = visible ? '' : 'none'
      if (!visible) {
        joyId = lookId = -1
        joyThumb.style.transform = 'translate(0,0)'
        cb.onMove(0, 0)
        cb.onFire(false)
      }
    },
    destroy(): void {
      root.remove()
    },
  }
}
