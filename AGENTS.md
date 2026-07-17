# AGENTS.md — 블래스터 공방 작업지침 (정본 / source of truth)

> 이 파일은 AI 에이전트(Claude Code·Codex)가 매 세션 읽는 엔지니어링 작업지침이다.
> 게임 설계(무엇을 왜 만드나)는 `docs/design/` 을 본다. 여기는 "코드를 어디에·어떻게 넣는가"만 다룬다.
> 전작 `C:/ai-game-lab`(AGENTS.md)의 검증된 규약을 계승했다.

## 0. 이 프로젝트는

- 초등 자녀와 함께 만드는 **3D 블래스터 공방 게임** — 파츠 조합 + 자유 변형(파라메트릭 조형) + 색칠 + 사격 시뮬레이션.
- Three.js + Vite + TypeScript strict. 로컬 브라우저 실행(`launch-game.bat` / `npm run dev`).
- 한 번에 작은 변경 · 30분 안에 움직이는 결과 · 재미있어진 순간마다 커밋.

## 1. 제1원칙 ⛔

**신규 기능 코드를 `src/main.ts` 에 추가하지 않는다.**

- 게임 로직·데이터 → `src/game/` (main.ts import 금지 — leaf)
- 화면 표현(HTML/DOM) → `src/ui/` (main.ts import 금지 — leaf)
- 메시 생성 → `src/game/*Visuals.ts` (데이터 → THREE.Object3D 순수 팩토리, 부수효과 금지)
- `main.ts` 는 **지휘자(conductor)**: 루프·입력·공유 상태·배선만. 늘어나면 안 된다.

## 2. 아키텍처 지도

| 경로 | 역할 |
| --- | --- |
| `src/main.ts` | 지휘자: 씬 부팅, update 루프, 스테이션 전환 배선 |
| `src/game/types.ts` | 공용 타입 (Blaster·PartDef·MorphParamDef·SavedGame) |
| `src/game/parts.ts` | 파츠 카탈로그 데이터 (정본: docs/design/02_parts.md) |
| `src/game/morph.ts` | 자유 변형 파라미터 정의·클램프 (정본: docs/design/09_freeform.md) |
| `src/game/assembly.ts` | 조합 상태·스탯 합성 (computeStats) |
| `src/game/partVisuals.ts` | 파라메트릭 메시 빌더 (morph → BufferGeometry) |
| `src/game/palette.ts` | PaletteKey 색 정본 (자유 RGB 금지 — 가드레일) |
| `src/game/ballistics.ts` | 탄도(포물선)·판정 순수 코어 |
| `src/game/targets.ts` | 타겟(과녁·풍선) 데이터·상태 |
| `src/game/save.ts` | localStorage 세이브 + SAVE_VERSION 마이그레이션 |
| `src/ui/*.ts` | 패널·HUD 렌더 (뷰모델 + DOM) |

**의존 방향:** `main.ts → (game/, ui/)` 단방향. leaf 가 main.ts 를 import 하면 실패다.

## 3. 게이트

- `npm run verify` = typecheck + 단위 테스트(스탯 합성·세이브 roundtrip·금칙어 lint). **커밋 전 필수.**
- 세이브 스키마 변경 시 `SAVE_VERSION` 증가 + 마이그레이션 + roundtrip 테스트.
- **금칙어 lint**: 게임 문자열에 실총 명칭·금지 어휘(정본: docs/design/08_safety.md §3.1) 유입을 테스트로 차단.

## 4. 성능 예산 (핫패스 규칙)

- `update*`/`animate*`/`tick*` 안에서 `new THREE.*`·새 객체/배열/클로저 할당 금지 — 스크래치 필드 재사용.
- 머티리얼은 색|finish 캐시 공유(`material.color.set()` 직접 변경 금지). 지오메트리 재생성은 morph 드래그 중 스로틀 + 이전 지오메트리 dispose.
- 모든 spawn(투사체·파티클)은 풀링 + 상한 (투사체 풀 64). 블래스터 draw call ≤ 12, 씬 총 300.

## 5. 연령 가드레일 (하드 룰)

- 토이 블래스터 스타일. 실총 브랜드·모델명 금지, 사람·동물형 타겟 금지, 유혈 금지.
- 어휘·색·이펙트 기준 정본 = `docs/design/08_safety.md`. 코드 식별자도 금칙어 적용(예: sniper → precision).

## 6. 커밋 규율

- pathspec 으로 대상 한정, 무관 파일 섞지 않기. 실패·되돌림은 `docs/work-history.md` 에 기록.
