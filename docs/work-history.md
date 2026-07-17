# 작업 이력 (실패까지 기록)

> 전작 규약 계승: 실패한 시도·되돌린 변경·보류한 접근을 남긴다. 같은 문제가 보이면 여기부터 확인.

## 2026-07-17 — 바탕화면 바로가기(.lnk) 생성 우회

- **시도한 것**: ① WScript.Shell(VBS/JScript) CreateShortcut → TargetPath 할당에서 "Invalid procedure call or argument" 런타임 오류. 속성 읽기도 빈 값(정책이 IWshShortcut 을 무력화). ② node 로 MS-SHLLINK 최소 구현(.lnk, LinkInfo 만·IDList 생략) → 파일은 생성되나 셸 실행 시 "지정된 프로그램을 찾을 수 없습니다" — 이 셸은 IDList 없는 .lnk 를 해석하지 못함.
- **성공한 것**: ③ `pip install pylnk3` 후 `pylnk3.for_file(...)` (IDList 포함 생성) → `cmd /c start` 행동 테스트로 실행까지 검증.
- **다음 작업자가 반복하지 말 것**: 이 PC 에서 WSH 로 .lnk 를 만들려는 시도, IDList 생략한 수제 .lnk. 재생성은 `python scripts/make-shortcut.py`.
- **관련 파일**: `scripts/make-shortcut.py`(정본), `scripts/gen-icon.mjs`(아이콘), `launch-game.bat`(대상). 폐기: `scripts/make-shortcut.mjs`(IDList 미지원 — 삭제).

## 2026-07-17 — 조준경 배율(4~15배) M1 편입 (사용자 요청)

- 설계상 줌은 M2(04 §8)였으나 사용자 요청으로 M1 편입. **광학적 FOV** = `2·atan(tan(baseFov/2)/zoom)` — 4배=11.82°, 15배=3.16°.
- 조작: 우클릭/조준경 버튼=토글, 휠·[−][+]=배율. 조준 감도는 `fov/baseFov` 비례로 낮춰 고배율 정밀 조준. 사격장↔공방 전환 시 fov 원복 필수(같은 카메라 공유).
- 검증: `__blasterLab.zoomState/setScope/changeZoom` + step(). 고배율에선 좁은 프러스텀이 화면 밖 타겟을 컬링(정상).

## 2026-07-17 — 적대적 QA(10 에이전트 5차원) 확정 버그 5건 수정

- **발사 클릭 불가(치명)**: `createRangeHud` 가 host className 을 `range-hud` 로 덮어써 `.hud-host{pointer-events:none}` 무효 → 투명 HUD 가 캔버스 클릭 가로챔. `.range-hud pointer-events:none` + 상호작용 요소만 auto. (별도 커밋)
- **결과카드 "공방으로" 루프**: 상단 back 과 결과카드 back 이 둘 다 `finishRange`(=결과 재표시)에 묶임 → `onExit` 분리.
- **과녁 어시스트 누락**: 풍선은 ×1.25 인데 과녁만 계수 빠져 판정 반경 20% 작음(`range.ts` board 스윕). 계수 적용.
- **STAR_CUTS 정본 불일치**: [6,12,20] → **[1,6,9]** (00_DECISIONS: ★1=완주·★2=6·★3=9).
- **같은 파츠 재선택 시 morph 리셋 + phantom undo**: `selectPart` 가 변화 없어도 새 인스턴스 생성(morph 소거)+undo push → 무변화 시 조기 return.
- **뷰모델 180° 뒤집힘(시각)**: `viewmodel.rotation.y=Math.PI` 면 총구가 뷰어를 향함 → y=0(총구 -Z 전방). 발사엔 무영향.
- **기각/보류**: morph 배율형 파라미터 t=0.5 ≠ 카탈로그 치수(barrelBore 등)는 §7 봉투 제약이 대칭 재중심을 막아 **코드버그 아닌 설계-문서 모순**(값 유지, 03 §8 t=0.5 ±10% 스모크는 미구현 보류). 히트숫자 DOM은 재진입 시 자가정리(누수 아님).
