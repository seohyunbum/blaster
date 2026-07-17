// src/game/palette.ts — 전 섹션 공용 색 정본 (08 §1.2). 이 밖의 색을 쓰려면 여기 추가부터.
// 자유 RGB/색상환 금지 — 저장은 PaletteKey 문자열, 렌더 시 TOY_PALETTE[key] 로 해석.

export const TOY_PALETTE = {
  // 주역 원색 (몸통·파츠 메인)
  blasterBlue: 0x2f7fe8,
  blasterOrange: 0xff8a2b, // 총구 팁 고정색 — 모든 블래스터 공통
  blasterYellow: 0xffd23f,
  blasterRed: 0xf05454, // 채도 높지만 '피 빨강' 아님
  blasterGreen: 0x4cd964, // 라임 그린 — 군녹색 아님
  // 파스텔 (꾸미기·배경·타겟)
  pastelPink: 0xffb5c9,
  pastelMint: 0xa8e6cf,
  pastelSky: 0xbde0fe,
  pastelCream: 0xfff3d6,
  // 중립·다크 (secondary/accent 전용 — primary 존 사용 금지)
  toyGrayLight: 0xd9dde3,
  toyGrayDark: 0x6b7280,
  toyBlack: 0x2b2f36, // 검정 줄무늬·타이어 그립용. 몸통 베이스 불가
} as const

export type PaletteKey = keyof typeof TOY_PALETTE

export const ALL_PALETTE_KEYS = Object.keys(TOY_PALETTE) as PaletteKey[]

/** primary 존 = 밝은 색 강제 (08 슬롯 차등). 어두운 중립색은 secondary/accent 전용. */
export const DARK_KEYS: ReadonlySet<PaletteKey> = new Set<PaletteKey>([
  'toyGrayDark',
  'toyBlack',
])

export function isBright(key: PaletteKey): boolean {
  return !DARK_KEYS.has(key)
}

/** 존별 폴백 기본키 (08 §1.2) — 삭제·개명된 키의 무소음 대체. */
export const ZONE_FALLBACK = {
  primary: 'blasterBlue',
  secondary: 'toyGrayLight',
  accent: 'toyGrayLight',
} as const

export function resolveHex(key: string): number {
  const k = key as PaletteKey
  return k in TOY_PALETTE ? TOY_PALETTE[k] : TOY_PALETTE.blasterBlue
}

export function isPaletteKey(key: string): key is PaletteKey {
  return key in TOY_PALETTE
}
