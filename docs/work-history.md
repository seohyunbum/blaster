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
