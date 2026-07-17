// src/game/presets.ts — 색칠 프리셋 단일 정본 (leaf).
// 미리보기 점(paintPanel)과 실제 적용(main.applyPreset)이 같은 배열을 쓰도록 한 곳에 둔다.
// (이전엔 두 곳에 중복 정의돼 인덱스로만 결합 — 한쪽만 고치면 보이는 색과 칠해지는 색이 갈렸다)
import type { PaletteKey } from './palette.ts'
import type { ZoneId } from './types.ts'

export interface PaintPreset {
  name: string
  /** [primary(밝은 색), secondary, accent] — 존 역할 순서 고정 */
  keys: readonly [PaletteKey, PaletteKey, PaletteKey]
}

export const PRESETS: readonly PaintPreset[] = [
  { name: '파스텔', keys: ['pastelSky', 'pastelCream', 'pastelPink'] },
  { name: '네온', keys: ['blasterGreen', 'toyBlack', 'blasterYellow'] },
  { name: '레이싱', keys: ['blasterRed', 'toyGrayLight', 'toyBlack'] },
  { name: '우주', keys: ['blasterPurple', 'toyGrayDark', 'blasterYellow'] },
  { name: '바다', keys: ['blasterTeal', 'pastelSky', 'toySilver'] },
  { name: '사탕', keys: ['blasterMagenta', 'pastelLavender', 'pastelCream'] },
  { name: '황금', keys: ['toyGold', 'toyCopper', 'toyBlack'] },
  { name: '정글', keys: ['blasterLime', 'blasterCoral', 'toyGrayDark'] },
]

/** 프리셋 키 배열의 존 순서 (primary/secondary/accent). */
export const PRESET_ZONE_ORDER: readonly ZoneId[] = ['primary', 'secondary', 'accent']
