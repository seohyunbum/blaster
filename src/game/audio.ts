// src/game/audio.ts — 절차 WebAudio SFX (파일 에셋 없음). 첫 탭에서 resume (결정문 26).
// 톤 규칙: 밝고 높게, 저역·노이즈 금지 (08 §1.3).

let ctx: AudioContext | null = null
let enabled = true

function ac(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  return ctx
}

/** 첫 사용자 제스처에서 호출 — AudioContext resume. */
export function resumeAudio(): void {
  const c = ac()
  if (c && c.state === 'suspended') void c.resume()
}

export function setAudioEnabled(on: boolean): void {
  enabled = on
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.14): void {
  const c = ac()
  if (!c || c.state !== 'running') return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
  osc.connect(g).connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + dur + 0.02)
}

export const sfx = {
  click: () => tone(660, 0.06, 'triangle', 0.1),
  snap: () => {
    tone(880, 0.05, 'square', 0.08)
    tone(1320, 0.08, 'triangle', 0.06)
  },
  shoot: () => tone(520, 0.09, 'triangle', 0.12),
  pop: () => {
    const f = 800 + Math.random() * 400
    tone(f, 0.12, 'sine', 0.16)
  },
  /** 슬라이더 드래그 — t 를 따라 피치 슬라이드 (09 §5). */
  morph: (t: number) => tone(500 + 600 * t, 0.05, 'sine', 0.05),
  /** 재장전 시작 — 딸깍(탄창 결합) 두 톤. */
  reload: () => {
    tone(360, 0.05, 'square', 0.08)
    setTimeout(() => tone(720, 0.07, 'triangle', 0.09), 70)
  },
  /** 재장전 완료 — 장전 완료 상승 톤. */
  reloadDone: () => {
    tone(680, 0.06, 'triangle', 0.09)
    setTimeout(() => tone(1020, 0.09, 'sine', 0.1), 80)
  },
  /** 빈 탄창에 발사 시도 — 짧은 빈총 클릭. */
  empty: () => tone(200, 0.05, 'square', 0.06),
  star: () => {
    tone(880, 0.12, 'sine', 0.12)
    setTimeout(() => tone(1100, 0.12, 'sine', 0.12), 90)
    setTimeout(() => tone(1320, 0.16, 'sine', 0.12), 180)
  },
}
