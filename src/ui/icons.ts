// src/ui/icons.ts — 절차 SVG 아이콘 (이모지 금지, 결정문 25). 문자열 반환.

export function icoUndo(): string {
  return `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path d="M9 7 L4 12 L9 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 12 H15 a5 5 0 0 1 0 10 H11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`
}

export function icoWorkshop(): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <rect x="3" y="9" width="14" height="6" rx="2" fill="currentColor"/>
    <rect x="17" y="10.5" width="4" height="3" rx="1" fill="currentColor"/>
    <rect x="6" y="15" width="3" height="4" rx="1" fill="currentColor"/>
  </svg>`
}

export function icoPaint(): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M6 3 h9 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -3 3 h-4 v3 a2 2 0 1 1 -4 0 v-3 a3 3 0 0 1 -3 -3 v-5 a3 3 0 0 1 2 -2.8z" fill="currentColor"/>
  </svg>`
}

export function icoRange(): string {
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <circle cx="12" cy="12" r="3" fill="currentColor"/>
  </svg>`
}

export function icoShoot(): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="2" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="2" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="17" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`
}

export function icoDice(): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/>
    <circle cx="9" cy="9" r="1.6" fill="#fff"/>
    <circle cx="15" cy="9" r="1.6" fill="#fff"/>
    <circle cx="12" cy="12" r="1.6" fill="#fff"/>
    <circle cx="9" cy="15" r="1.6" fill="#fff"/>
    <circle cx="15" cy="15" r="1.6" fill="#fff"/>
  </svg>`
}
