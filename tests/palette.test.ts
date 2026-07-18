import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canBePrimary, ALL_PALETTE_KEYS } from '../src/game/palette.ts'

test('검정은 본체색(primary) 허용, 어두운 회색은 불가 (사용자 요청)', () => {
  assert.equal(canBePrimary('toyBlack'), true, '검정이 본체색에서 막힘')
  assert.equal(canBePrimary('toyGrayDark'), false, '칙칙한 회색이 본체색에 허용됨')
  assert.equal(canBePrimary('blasterBlue'), true) // 밝은 색은 당연히 허용
})

// 구현식 미러가 아니라, "본체색 제외 대상은 toyGrayDark 딱 하나" 를 명시적으로 못박는다.
// (paintPanel 스와치 필터·main.ts 랜덤 primary 가 공유하는 실제 후보 집합)
const PRIMARY_EXCLUDED = new Set<string>(['toyGrayDark'])

test('본체색 후보 = toyGrayDark 만 제외, 그 외(검정 포함) 전부 허용', () => {
  for (const k of ALL_PALETTE_KEYS) {
    const expected = !PRIMARY_EXCLUDED.has(k)
    assert.equal(canBePrimary(k), expected, `${k} 본체색 허용 여부 불일치`)
  }
})

test('스와치·랜덤이 쓰는 본체색 후보 목록에 검정 포함, 회색 제외 (배선 검증)', () => {
  // paintPanel.ts:renderSwatches 와 main.ts:randomizeAll 이 동일하게 쓰는 필터
  const primaryKeys = ALL_PALETTE_KEYS.filter(canBePrimary)
  assert.ok(primaryKeys.includes('toyBlack'), '본체색 후보에 검정 없음')
  assert.ok(!primaryKeys.includes('toyGrayDark'), '본체색 후보에 칙칙한 회색이 샜음')
  assert.ok(primaryKeys.length === ALL_PALETTE_KEYS.length - 1, '제외 대상이 정확히 1개(toyGrayDark)가 아님')
})
