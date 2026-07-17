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

## 2026-07-17 — 파츠 확충 QA(6 에이전트) 확정 버그 수정

- **콘페티 프러스텀 컬링(중)**: InstancedMesh frustumCulled 기본 true + boundingSphere 원-샷 계산이 전 인스턴스 -999 파킹 시점에 캐시 → 명중해도 콘페티 영구 미렌더. `confetti.frustumCulled=false`. 가이드 InstancedMesh 도 동일 방어 적용.
- **나팔 팁(muzzle_horn) 방향 역전(Low)**: CylinderGeometry(0.06,0.035) rotateX(π/2) 가 넓은 벨(0.06)을 +Z(뒤)로 보내 립 링(0.06)이 좁은 앞끝(0.035)에 떠 붙음. `rotateX(-π/2)` 로 벨 입구를 전방 -Z 로.
- **폴백 테스트 거짓통과(Low)**: `buildPart('body_ghost')` 는 body_ prefix 매칭돼 정상 팝콘 생성 → 돌덩이 규칙 미검증. prefix 불일치 id `'zzz_ghost'` + countMeshes===1 로 교정.
- **잠재/무해 기각**: prefix 매칭 미등록 파츠가 DIMS 폴백으로 회색박스 우회(현 카탈로그 전등록이라 미발현), availableSlots 죽은코드(호출자 0).

## 2026-07-17 — 보관함 QA(4 에이전트) 확정 버그 수정

- **이름 변경 후 첫 클릭 삼킴(낮음~중, 양 차원 독립 확인)**: 카드 이름 편집 중 다른 버튼 클릭 → blur→change→`renameBlaster`→`refreshPanels()`가 `list.innerHTML=''`로 목록을 mouseup 전에 재생성 → mousedown 대상 노드 detach → Chrome이 click 미발화(첫 클릭 유실, 데이터 무손상). `renameBlaster` 에서 `refreshPanels()` 제거(이름은 input·stationBar 로 이미 반영). 검증: rename 시 카드 DOM 노드 불변 + 편집후 즉시 열기 첫클릭 동작.
- **morphGesture 미초기화(방어)**: 슬라이더를 시작값과 동일값으로 되돌리면 change 미발화로 gesture 잔존 → 블래스터 전환 후 커밋 시 이전 스냅샷이 새 undo 에 혼입 가능(좁은 재현). open/duplicate/delete 의 `undoStack.length=0` 옆에 `morphGesture=null` 병기.

## 2026-07-17 — 쉐입·장식 QA(4 에이전트) 확정 버그 수정

- **barrelFlare 나팔 방향 역전(낮음)**: `CylinderGeometry(rFront+0.04, rFront)` + rotateX(π/2) 가 접합부에서 넓고 앞으로 좁아지는 역깔때기 + rFront(0.02)↔0.06 이음매 단차. 반경 순서 교체 `CylinderGeometry(rFront, rFront+0.04)` → 뒤끝=rFront(연속)·앞끝 넓게(벨 입구 전방). 지오메트리 실측 검증(앞 0.078>뒤 0.038, 이음매 연속). muzzle_horn 과 같은 방향 계열.
- **무해 확인**: bodyRound radius 항상 <최소변/2(0.42<0.49 캡), 캐리핸들 radius 0.02 초과는 three RoundedBox 내부 클램프로 무해(기존 코드), morphStatDelta 중립점 0.5 하드코딩은 스탯키가 전부 defaultT=0.5 라 현재 무해(defaultT≠0.5 스탯키 추가 시 방어 필요).
