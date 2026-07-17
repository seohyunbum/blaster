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

## 2026-07-17 — 전체 완성도 종합 QA(14 에이전트 7차원) 수정 9건

여러 차원이 **독립 확인**한 것 위주. 런타임 적대 스윕(과체중·장식만땅·맨몸·100발·세이브손상)은 JS 에러 0로 통과.

- **[중] 과녁 명중이 카운터·별점에 0 반영**: `onHit` 이 `kind==='balloon'` 만 카운트 → 과녁만 쏘면 "맞힌 개수 0" + 무피드백 종료("결과는 항상 플러스" 설계 파괴). `totalHits` 로 통합(풍선+과녁). 검증: 과녁만 쏴서 10 명중.
- **[중] 반동이 안 보임**: tick 복귀율 하드코딩 `dt*2.2`(=**126°/s**)가 설계 `recoveryDegPerSec()`(8~14°/s)의 ~9배 → 킥(≤2.5°)이 첫 렌더 전 소멸, 저파워는 0 클램프. `recoveryDegPerSec(profile)` 를 enterRange 에서 캐시해 배선 + `RECOIL_MAX_DEG` 클램프. 검증: 복귀율 8°/s, 1프레임 후 0.2° 잔존.
- **[중] 파츠 제거→되돌리기 시 색칠 유실**(2차원 독립 확인): `captureSnapshot` 이 paint 미포함 → `doUndo` 재생성 분기가 `makeInstance`→`defaultPaint`. 스냅샷에 paint 추가, 재생성 분기만 복원(살아있는 파츠는 현재 paint 유지 = 결정문 15 규칙 불변). 검증: blasterRed 복원.
- **[낮] 활성 '쏘기' 재탭 → 라운드 무경고 리셋**(2차원): `setStation` 가드의 range 예외 제거(재시작은 결과카드 "한 번 더"로만).
- **[낮] 우클릭이 레드도트 토글 + 오발사**: pointerdown 에 `ev.button !== 0` 가드.
- **[낮] 보관함 활성카드 '만들기'가 undo 소거**: `openBlaster` 에서 `b.id !== active.id` 일 때만 전환 처리(스테이션 탭 경로와 동작 일치).
- **[낮] 사격 중 undo 가 뷰모델·스프레드·가이드 미갱신**: `enterRange` 에서 `setCanUndo(false)` 로 잠금.
- **[낮~중] morph 드래그 리빌드 무코얼레싱**: input 마다 전체 지오메트리(12~20 BufferGeometry) 재생성 → `morphDirty` 플래그 + tick 프레임당 1회 소비.
- **금칙어 가드 커버리지 구멍**: 테스트가 파츠·morph 라벨만 스캔(프리셋·UI 크롬 0개) + `scanString` 이 한글 있으면 EN 토큰 스킵("glock 배럴" 통과). → 병행 스캔으로 수정 + **소스 전수 한글 리터럴 스캔 테스트**(드리프트 방지, vocab.ts 사전 자신은 제외). PRESETS 이중정의 → `game/presets.ts` 단일 정본. glowMaterial 단색 싱글턴 → hex Map 캐시.
- **기각**: fireRate 미적용(탭=단발 설계 + maxKick 에 실제 기여), randomizeSlot 유령 undo(UI 도달 불가·방어만 적용), 15배 과함(취향), ENVELOPE 미강제(스펙 드리프트지만 correctness 아님 — 후속).

## 2026-07-17 — variation 대폭 확대

병목 진단: morph 가 body·barrel 에만 있었고(조준기·그립·스톡·총구는 고정), 몸통 4종이 전부 같은 RoundedBox 실루엣, 색 12.

- **전 슬롯 morph**: `MorphArchetype` 을 6종(body·barrel·sight·grip·stock·muzzle)으로 확장 + `archetypeForSlot(slot)` 헬퍼(슬롯명=원형명). 신규 키 11 → **총 22 파라미터**(body 8·barrel 5·sight 2·grip 3·stock 2·muzzle 2). workshopPanel·randomizeSlot 의 하드코딩 분기(`slot==='body'?…:null`) 제거.
- **몸통 실루엣 자체 분화**: `BodyDims.shell = 'box'|'capsule'|'sphere'` + `makeShell()`. 신규 몸통 4종(로켓=캡슐·오브=구·웨지·청크), 젤리=구로 전환.
- **파츠 증설**: 배럴 5→7(트윈 튜브·니들), 조준기 3→4(경통 스코프), 그립 2→3, 스톡 3→4, 머즐 3→4. 총 16→27.
- **장식 추가**: bodyTail(꼬리날개 V자 2메시)·barrelRib(마디 고리, ribT 에 비례해 1~5개).
- **색·프리셋**: 팔레트 12→22키(보라·청록·마젠타·라임·코랄·라벤더·피치·실버·골드·코퍼), primary 밝은색 20종. 프리셋 4→8.
- **완전 랜덤 버튼**: 파츠 선택·morph·장식·색·finish 를 한 번에 재추첨. 장식은 50% 확률로만 켜고 부착 슬롯은 22% 확률로 비워 "없는 것도 변형"으로. 검증: 5회 연속 전부 다른 결과.
- **테스트 드리프트 방지**: visuals 테스트를 하드코딩 목록 → **카탈로그·MORPH_PARAMS 파생**으로 전환(파츠·키 추가 시 자동 커버). 메시 예산 10→14(몸통 최대 12=기본5+장식7, 배럴 최대 8).
