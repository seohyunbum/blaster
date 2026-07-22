# 블래스터 공방 (Blaster Lab)

초등학생 아들과 함께 만드는 **3D 블래스터 디자인 게임** — 몸통·파츠를 조합하고, 슬라이더로 형태를 자유롭게 변형(파라메트릭 조형)하고, 색칠한 뒤, 사격 테스트장에서 내가 만든 블래스터의 성능을 직접 확인한다.

> 토이 블래스터 스타일 (전체이용가 감각). 실총 명칭·사람/동물 타겟·유혈 없음 — 기준: `docs/design/08_safety.md`

## 실행

- **아들용**: 바탕화면 **"블래스터 공방"** 아이콘 더블클릭 (콘솔 창이 뜨고 브라우저가 자동으로 열림. 다 놀면 콘솔 창을 닫기)
- 개발: `npm run dev` (포트 5175)
- 빠른 검증: `npm run verify` (typecheck + 91개 테스트 + 아키텍처/핫패스 게이트)
- 커밋 전 전체 검증: `npm run verify:full` (빠른 검증 + 프로덕션 빌드/번들 예산 + Playwright 시각·성능 smoke). Windows 로컬은 설치된 Edge, CI는 Playwright Chromium 사용

## 문서

| 무엇 | 어디 |
| --- | --- |
| 엔지니어링 작업지침 (AI 에이전트 정본) | `AGENTS.md` |
| 게임 설계서 (컨셉·파츠·자유 변형·시뮬레이션·마일스톤) | `docs/design/` |
| 작업 이력 (실패 기록 포함) | `docs/work-history.md` |

## 스택

Three.js + Vite + TypeScript strict. 절차 생성 메시(에셋 파일 없음), 레지스트리 기반 슬롯·스테이션·발사체 확장, 세션 객체(Editor/Range), storage 주입형 localStorage 세이브(SAVE_VERSION 마이그레이션), 전작 `C:/ai-game-lab` 규약 계승.
