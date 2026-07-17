// src/game/vocab.ts — 금칙어 단일 정본 (08 §3.1). 파츠명·UI 문자열·morph 라벨을 스캔.
// 실총 명칭·폭력 어휘 유입을 verify 게이트에서 기계 차단한다.

export const FORBIDDEN_KO: readonly string[] = [
  '총알', '탄환', '탄약', '사살', '헤드샷', '데미지', '대미지', '무기', '화기',
  '처치', '적군', '탄창', '발포', '폭파', '저격', '스나이퍼', '게임오버', '패배',
  '사망', '글록',
]

/** 금지어를 부분 포함하지만 허용하는 복합어 (선허용 후매칭). 현재 없음. */
export const ALLOWED_KO_COMPOUNDS: readonly string[] = []

/** 식별자를 camelCase/snake_case/숫자 경계로 분해한 토큰과 "완전 일치". */
export const FORBIDDEN_EN_TOKENS: readonly string[] = [
  'kill', 'damage', 'weapon', 'ammo', 'sniper', 'gun', 'bullet',
  'ak', 'm16', 'm4', 'mp5', 'glock',
]

export interface VocabHit {
  text: string
  term: string
  lang: 'ko' | 'en'
}

function tokenizeIdentifier(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

/** 한글 문자열(리터럴)을 검사 — 부분 문자열 매칭, 허용 복합어는 통과. */
export function scanKo(text: string): VocabHit[] {
  const hits: VocabHit[] = []
  for (const term of FORBIDDEN_KO) {
    let from = 0
    while (true) {
      const at = text.indexOf(term, from)
      if (at < 0) break
      const inAllowed = ALLOWED_KO_COMPOUNDS.some((c) => {
        const cAt = text.indexOf(c)
        return cAt >= 0 && at >= cAt && at + term.length <= cAt + c.length
      })
      if (!inAllowed) hits.push({ text, term, lang: 'ko' })
      from = at + term.length
    }
  }
  return hits
}

/** 영문 식별자를 토큰 단위 완전 일치로 검사. */
export function scanIdentifier(id: string): VocabHit[] {
  const tokens = tokenizeIdentifier(id)
  const hits: VocabHit[] = []
  for (const t of tokens) {
    if (FORBIDDEN_EN_TOKENS.includes(t)) hits.push({ text: id, term: t, lang: 'en' })
  }
  return hits
}

/** 한글이 섞였으면 KO 스캔, 순수 식별자면 EN 스캔. */
export function scanString(s: string): VocabHit[] {
  const hasKo = /[가-힣]/.test(s)
  return hasKo ? scanKo(s) : scanIdentifier(s)
}
