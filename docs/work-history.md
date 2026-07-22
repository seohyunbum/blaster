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

## 2026-07-18 — 변형 확대 QA(6 에이전트) 부착 간극/클리핑 8건 수정

전 슬롯 morph·신규 실루엣 도입으로 파츠가 앵커에 flush 하지 않아 뜨거나 파묻히던 무리(양 차원 독립 확인). 원인 공통: `attachTo` 가 파츠 로컬 원점을 앵커에 놓는데 morph 스케일 시 부착면이 원점과 안 맞음. 전부 시각 결함(크래시·손실 없음)이나 "멋진 총" 경험 직결.

- **[높음] A 코 collar**: 구·캡슐 몸통은 앞끝이 점(반경0)이라 코 원판이 공중에 뜸. `dims.shell!=='box'` 면 곡면 62% 안쪽에 base 를 심고 셸 반경으로 clamp(box 는 앞면 평평→기존 유지). 기본 상태서도 발현하던 것.
- **[중] C 조준기 높이**: 높이 슬라이더 올리면 몸체가 마운트에서 뜸 → 마운트 윗면(yTop) 기준으로 전 부품(도트박스·핀·링·경통) 밑면 배치.
- **[중] D 스톡**: 앞면이 몸통 뒷면(z=0)에 항상 붙게(arm·pad·풍선 각각) — 기본값서도 상시 갭이던 것.
- **[중] B 마디고리**: 링 반경이 뒤끝 r 고정이라 테이퍼 배럴서 매몰/부유 → 링별로 그 z 의 실반경 추종.
- **[낮~중] E 그립**: 길게·기울게서 몸통 밑에서 떨어짐 → 캡슐 상단을 몸통 밑면에 고정(아래로만 성장).
- **[낮] F 경통 렌즈**(작은 크기서 묻힘)·**G 반짝이 별**(길고 작을 때 분리) → 앞면 바깥 고정.
- **[낮/기존] H 부스터 지느러미**: 원점 회전이라 콘에 완전 매몰(항상 안 보임) → 콘 반경 밖으로 방사 배치.
- **검증**: 부착 파츠 bbox×몸통 bbox join축 간극 실측 = 전부 음수(겹침=부착, 부유 0). 46테스트·typecheck·build. 기본 룩 보존(그립 기본 간극 불변).

## 2026-07-18 — 총구 여러 개(더블배럴·미니건)

별도 슬롯 확장 대신 배럴에 `barrelCount` morph(1~6, discrete) 추가.
- `MorphParamDef.discrete` 신설 — UI 중앙스냅 없이 정수 스텝(step=1/(max-min)). barrelCount 는 shape 그룹·defaultT 0(기본 1개)·스탯 0(다발 발사가 보상).
- `barrelLayout(count,r)`: 1=중앙·2=나란히·3+=링 클러스터(개틀링). buildBarrel 이 총열 count 개(지오 공유)+개틀링 허브 렌더, count>1 이면 나팔/마디고리 장식 게이트 오프(예산 유지: 미니건 6열=6튜브+6링+허브=13≤14).
- 발사: `fire()` 가 `barrelCountFromMorph` 만큼 range.fireOne — 좌우 fan 퍼짐. 반동은 다발 비례 소폭↑(RECOIL_MAX 클램프 내). 검증: 미니건 1트리거→6발→6명중.
- 테스트: barrelCount 총열 메시 증가·예산 확인(총 47).

## 2026-07-18 — 세이브 내구성 강화 ("업데이트해도 보관함 절대 유실 금지")

먼저 **현 상태가 이미 안전함을 테스트로 증명**: 구버전 세이브·미니건 morph·미지 morph 키·미지 최상위 필드·삭제된 파츠 id·30개 대량 보관함 — 전부 블래스터 보존(normalizeSave 는 바디 있는 블래스터를 절대 안 버리고, 미지 필드 무시·id 보존). 신규 파츠/morph 는 전부 additive 라 구세이브 무손상.

그 위에 안전망 3중화:
- **롤링 백업(최근 5개)**: persistSave 가 이전 저장본을 링(bak0~4, 라운드로빈)+레거시 백업에 남김. loadSave 는 메인이 읽히면 그걸 쓰고(삭제 등 의도 존중), 메인 손상/부재 시 **백업 중 블래스터가 가장 많은 것으로 복구**. 검증: 메인 JSON 손상·완전삭제 두 재앙에서 3개 전량 복구.
- **백업 파일 내보내기/불러오기**: 보관함에 "💾 백업 저장"(collection JSON 다운로드)·"📂 백업 불러오기"(파일→**병합**, 기존 id 는 건너뛰어 아무것도 안 잃음). 코드 버그·기기 교체와 무관한 사용자 소유 사본. 형식 불명 파일은 무시(현 보관함 미변경).
- 백업 실패는 메인 저장을 막지 않음(try 분리). 테스트 54(내구성 8 신설: 구/미래 세이브·삭제파츠·30개·라운드트립·병합·불명거부).

## 2026-07-18 — 다트 팩(탄창) 시스템: 유한 탄약 + 재장전

사용자 요청 "탄창 시스템, 디자인 때 선택". 단 **"탄창/탄약"은 토이 연령 가드레일 금칙어**(vocab.ts)라 기능은 구현하되 사용자 표기는 **"다트 팩 / 다트"**로.
- **파츠 4종**(`parts.ts`, slot `magazine`): 미니 클립 6발·0.5초 / 스프링 팩 12발·1.2초 / 드럼통 24발·2.5초 / 젤리 탱크 30발·3.2초. 전 몸통 소켓에 `magazine` 추가. computeStats 가 capacity/reloadSec 반영(기존 배선 재사용), 무게 델타 포함.
- **선택제(옵트인)**: 다트 팩 없음 = **무한 탄약**(기존 동작 그대로). 달면 그 용량만큼 발사·소진 시 재장전. → 기존 저장 총(다트팩 없음) 완전 무영향.
- **비주얼**(`partVisuals.ts` buildMagazine): 몸통 아래 급탄구(magAnchor `(0,-h*0.44,-d*0.02)`)에서 -Y로 매달림. 상자형(미니/스프링/젤리)=케이스+옆창+다트캡슐, 드럼통=옆으로 누운 원반+허브. magSize·magLength morph(신규 archetype `magazine`). 검증: 4종 모두 몸통 아래로 0.14~0.16 돌출·부유 0(top이 몸통에 겹침).
- **사격장 게임플레이**(`main.ts`): ammoMax/Cur·reloading·reloadEndT 상태. `fire()` 는 `shots=min(barrelCount, ammoCur)` 소비(미니건 6연장은 6씩, 부분탄이면 남은 만큼), 0 되면 자동 재장전. 재장전 중 발사 불가. **R 키 수동 재장전**. tick+step 양쪽서 재장전 완료 처리(헤드리스 QA 대응).
- **HUD**(`rangeHud.ts`): 우하단 다트 계기 — 12발 이하 점(🔵/⚪), 초과 숫자, 재장전 진행바. 무한이면 "다트 ∞". SFX reload/reloadDone/empty 신설(`audio.ts`).
- **UI**: 공방 탭 "다트 팩"(용량 표기 카드)·색칠 탭 편입. paintPanel/workshopPanel.
- **세이브**: magazine 슬롯·magSize/magLength morph 가 normalizeSave 라운드트립 보존(테스트). 기존 총 무손상.
- **검증**: 헤드리스 __blasterLab — drum 24발 소진→자동재장전→2.5초 후 완료, 미니건 6소비, 부분탄(count4·6발→4→2), 무한모드 20발 불변, R 수동재장전, 콘솔 에러 0. 실 UI 클릭으로 탭·카드·장착 동작 확인. 58테스트(다트팩 4 신설)·typecheck·build.

## 2026-07-18 — 검정 본체색 허용 + 미니건 손잡이(몸통 위 그립)

사용자 요청 2건.

**A. 검정을 본체색(primary)에 허용** — 기존 규칙(08 §1.2 "primary=밝은 색만")에서 검정만 예외.
- `palette.ts`: `canBePrimary(key)=isBright(key)||key==='toyBlack'` 신설. toyGrayDark 는 계속 primary 불가(칙칙한 회색 몸통 방지). toyBlack 0x2b2f36→**0x1e2126**(확실히 검정으로 읽히게). paintPanel 스와치 필터·main.ts 랜덤 primary 가 canBePrimary 사용.
- 검증: 본체색 스와치 21종(검정 포함·회색 제외), 몸통 실제 색칠 toyBlack 적용, 에러 0.

**B. 미니건 손잡이(grip_minigun)** — 그립 슬롯 신규, "총 몸통 위" 장착.
- `partVisuals.ts`: buildBody 에 `gripTopAnchor(0,h*0.5,d*0.06)` 신설, `BuiltPart.anchors` 타입을 `AnchorId=SocketId|'gripTop'` 로 확장. buildGrip 의 grip_minigun 분기 = +Y로 솟는 스페이드 핸들(수직기둥2+가로바+그립링2=5메시), gripLength/Thick/Angle morph 재사용.
- `assembly.ts`: grip_minigun 만 `anchors.gripTop`(없으면 grip 폴백)로 라우팅, 그 외 그립은 하단 유지.
- `parts.ts`: grip_minigun(미니건 손잡이, delta accuracy+1/weight+1). vocab 통과('minigun'≠'gun' 토큰).
- 검증: 4개 몸통(불도그/오브/로켓/타이탄)에서 몸통 위로 +0.10 솟고 float 간극 음수(부유 0), 5메시. 실 UI 장착 확인, 에러 0.

- 세이브: grip_minigun 슬롯·그립 morph·primary=toyBlack 라운드트립 보존(추가만이라 기존 총 무영향).
- 테스트 62(palette 2·미니건 손잡이 2 신설)·typecheck·build. 결정 로그 = 00_DECISIONS 스코프 변경.

### 적대적 QA (Workflow fan-out 5관점×검증) — 확정 12건 처리
- **[high] 미니건 손잡이 앞기둥이 몸통 캐리핸들 관통** (기본 morph·전 몸통 상시): assembly 가 grip_minigun 장착 시 `hideCarryHandle` 로 캐리핸들 생략(BuildOpts 신규 플래그) → 두 손잡이 자리다툼 제거. 검증: 조립 시 몸통 자체 메시 4(vs 일반그립 5).
- **[med] 앵커 위치 재조정**: gripTop 을 d*0.06→**d*0.19**(후방-상단 스페이드 위치)로 이동해 조준기·스코프 앞 파츠 회피. 기본 스코프까지 Z-클리어(그립앞 0.022>스코프뒤 0.019). 최대크기 스코프+미니건그립만 미세 그레이즈(극단 조합, 잔존).
- **[low] 곡면 몸통·기울기 극단 부유**: embed 0.02→**0.04** + span 상한 축소(0.035+0.02·gLen) → 6몸통×3극단 morph 최소 여유 0.061(어디서도 안 뜸).
- **[low] 그립 링 축 오정렬**: 바가 Z축이라 토러스 `rotation.y` 제거(무회전=구멍축 Z 로 바를 감쌈, 마디고리/머즐링과 동일 규약).
- **[low] 문서 불일치**: 08_safety.md toyBlack 0x2b2f36·"몸통 베이스 불가" → 0x1e2126·canBePrimary 허용으로 동기화.
- **[low/med] 테스트 보강**: palette 배선 테스트(스와치·랜덤 후보에 검정 포함/회색 제외), 미러 테스트 탈-동어반복, 캐리핸들 생략 테스트 2건, 메시예산 EXTREMES 에 단일배럴+장식만땅 케이스 추가.
- **[정책 유지] '미니건' 명칭**: 금칙어 사전에 없고(탄창과 달리), 이미 barrelCount 라벨로 쓰이는 프로젝트 확립 용어이자 일반 완구/만화 표현이라 사용자 요청대로 유지(글록/M4 같은 특정 브랜드·모델명과 구분). 차단 시 기존 사용·사용자 요청과 충돌.
- 최종: 64테스트·typecheck·build·헤드리스(관통0·부유0·에러0).

## 2026-07-19 — 미니건 코어(초대형 구형 몸통) 추가

사용자 요청 "몸통 파츠에서 미니건 몸통 만들어줘. 동그랗게 생기고 엄청나게 커."
- **`parts.ts` BODIES**: `body_minigun`(미니건 코어) 신설. base P8/R5/A3/W9·weightLimit 18 — 전 몸통 중 가장 무겁고 든든(대신 정확도 3으로 최저, "크고 우람" 체감). 소켓 풀세트(barrel·sight·grip·stock·muzzle·magazine).
- **`partVisuals.ts` BODY_DIMS**: `shell:'sphere'` + `w/h 0.36·d 0.52` — 오브(0.19)·타이탄(0.2)보다 폭·높이 ~2배인 압도적 왕구슬. 기존 sphere 빌드 경로(코 collar·앵커 곡면 처리) 그대로 재사용이라 신규 지오 코드 0.
- **가드레일**: `minigun` 토큰은 08 §3.1 금칙어 아님(`gun`과 토큰 불일치). 한글 "미니건"도 금칙어 없음. 기존 grip_minigun·barrelCount 와 동일 정책.
- **세이브**: 몸통 id 추가만이라 additive — 기존 저장 총 완전 무영향(normalizeSave 라운드트립 보존).
- **검증**: 64테스트·typecheck 통과. 헤드리스 실측 — body_minigun bbox 0.396×0.455×0.575(오브 0.209×0.242 대비 최대), 기본 5메시·장식만땅 12(≤예산 14), 배럴+그립+조준기+스톡 풀조립 크래시 0.

## 2026-07-19 — 리볼버(권총류) 부품 추가

사용자 요청 "리볼버 같은 권총류 부품도 추가해줘". 08 §1.1 하드룰(실총 실루엣 금지·둥글고 통통하게·"다트 끝 보이면 장난감답다")에 맞춰, realistic 권총 몸통 대신 **토이 블래스터식 회전 실린더 + 둥근 그립**으로 구현.
- **`mag_revolver` (리볼버 실린더, 다트 팩)**: 배럴 방향(축=Z) 통통·짧은 회전 실린더. 앞면에 다트 6발이 링으로 튀어나옴(고정 주황=토이 시그니처). capacity 6·reloadSec 1.5·delta{accuracy+1,weight+1}. buildMagazine 신규 분기: 실린더+요크핀 축+다트6+톱스트랩 = 9메시(≤14). 몸통 밑면에 바싹(cy −0.022) 총구쪽 전진(cz −0.045·sz), 스트랩으로 몸통 연결(부유 0).
- **`grip_revolver` (리볼버 그립)**: 뒤로 젖힌 캡슐 + 둥근 뒤꿈치(heel) 공 + 링 장식. buildGrip 신규 분기(4메시). delta{accuracy+1}.
- **가드레일**: `revolver`/`리볼버` 는 08 §3.1 금칙어 아님(vocab lint 통과). computeStats·세이브·HUD 다트 계기는 기존 magazine 배선 재사용(additive, 기존 저장 총 무영향).
- **검증**: 64테스트·typecheck 통과. **실브라우저(Playwright) 확인** — 다트 팩 목록에 "리볼버 실린더 · 6발", 그립 목록에 "리볼버 그립" 노출·장착·렌더 정상, JS 에러 0, 실린더 앞 다트 링 가시.

## 2026-07-19 — 총구 많을수록 연사 빠르게 (사용자 요청)

10살 사용자 요청 "총구가 많을수록 연사가 빠르게".
- **`parts.ts computeStats`**: 배럴 슬롯 처리 시 `barrelCountFromMorph(inst.morph)` 로 총구 수를 읽어 `fireRate += (총구수 − 1) × FIRE_RATE_PER_EXTRA_BARREL(=1)`. 총구 1개=+0, 2개=+1, …, 6개(미니건)=+5. clamp(1..10) 유지.
- **왜 morph deltaAt 로 안 했나**: barrelCount 는 defaultT 0(1개)인데 piecewise 스탯델타 중립점은 t=0.5 → "t=0부터 단조 증가" 불가 → computeStats 직접 가산이 정답. morph.ts 주석만 갱신.
- 기존 총(총구 1개)은 +0 이라 무영향. 다발 발사(총열 수만큼)는 유지 = 미니건이 더 강해짐(사용자 의도).
- **검증**: 65테스트(신규 1)·typecheck 통과. 실브라우저 — 숏스냅 총구1개 연사 8 → 미니건(6개) 연사 10.

## 2026-07-19 — 미니건 풀세트면 손잡이를 몸통 아래(-Y)로 (사용자 요청)

10살 사용자 요청 "미니건 세트(미니건 코어+총구6+미니건 손잡이) 다 장착하면 손잡이가 -Y좌표에 장착되게".
- **문제**: grip_minigun 은 항상 gripTop(+Y, 몸통 위) 마운트인데, 미니건 코어(거대 구)에선 손잡이가 위로 붕 떠 몸통과 분리돼 보였음.
- **수정(`assembly.ts`)**: `isMinigunSet = body_minigun && grip_minigun && barrelCountFromMorph(barrel)===6` 이면 미니건 손잡이를 하단 grip 앵커(-Y)로 라우팅 + `rotation.x += π` 로 180° 뒤집어 아래로 매달리게(원래 +Y로 자라는 톱 핸들). 풀세트 아니면 기존대로 gripTop(위).
- 손잡이의 embed(0.04)가 뒤집혀 구 밑면 안으로 파고들어 연결(부유 0). 특별 조합 보너스 느낌.
- **검증**: 66테스트(신규 1: 풀세트 grip maxY<-0.05, 일반 minY>0.05)·typecheck 통과. 실브라우저 — 미니건 세트에서 손잡이가 공 아래에 매달림 확인.

## 2026-07-19 — 쏘기 화면: 큰 총이 시야를 안 가리게 자동 축소·하단 배치 (사용자 요청)

10살 사용자 요청 "쏘기에서 보이는 화면 아래쪽에 보이게" (미니건 코어가 뷰모델로 화면을 가리던 문제).
- **문제**: 사격장 뷰모델은 고정 위치·크기라, 거대 구(미니건 코어, 화면 가로세로 ~0.6)를 끼우면 총이 화면 오른쪽·가운데를 다 가려 과녁이 안 보였다.
- **수정(`main.ts` fitViewmodel)**: 뷰모델 빌드 후 bbox 측정 → 화면을 가리는 가로·세로 `max(x,y)`가 TARGET(0.34) 초과면 `TARGET/max(x,y)` 로 축소하고, 총 윗부분이 뷰모델 원점(화면 하단) 근처에 오도록 아래로 매달아 배치. 깊이(z=길이)는 시야를 안 가리므로 판정에서 제외.
- 보통 총(기본 0.266·불도그풀 0.298)은 TARGET 미만이라 **기존 위치·크기 그대로**(early return). 미니건 세트(0.597)만 ~0.57배로 축소돼 화면 아래에서 빼꼼.
- 반동은 카메라 aim(recoilPitch)에 적용되므로 뷰모델 scale/position 변경과 무충돌.
- **검증**: 66테스트·typecheck 통과. 실브라우저 — 미니건 세트에서 총이 화면 하단에 걸쳐 과녁 전부 가시, 기본 총은 기존과 동일(수치 0.266<0.34 → 무변).

## 2026-07-19 — 총구가 몇 개든 발사 총알은 항상 1발 (사용자 요청)

10살 사용자 요청 "총구가 몇 개든 나가는 총알은 1개로 고정, 속도(연사)만 올라가고". (AskUserQuestion 으로 '속도'=연사 확인.)
- **수정(`main.ts` fire)**: `count = barrelCountFromMorph(...)` → `count = 1`. 총구 개수만큼 다발(fan) 발사하던 것을 항상 1발로. barrelCountFromMorph import 제거(noUnusedLocals).
- 총구 개수는 이제 **연사(computeStats fireRate 보너스, 2026-07-19)·모양(총열 렌더)** 에만 반영. 발사 수·탄약 소비·반동은 단발 기준.
- **검증**: 66테스트·typecheck 통과. 실브라우저 — 총구 6개+6발 클립으로 1탭 시 다트 6→5(정확히 1발 소비, 이전엔 6발 소비→즉시 재장전).

## 2026-07-19 — 화면에 버전 뱃지 추가 (배포 반영 확인용)

사용자(10살)가 "반영 안 됨"을 반복 보고 → 실제로 새 빌드가 로드됐는지 눈으로 확인할 수단이 필요. index.html 좌하단에 고정 뱃지("버전 N ✨") 추가. **배포할 때마다 번호를 올린다**(현재 "버전 4"). 새로고침 후 번호가 바뀌면 = 새 코드 로드 성공(캐시 vs 실제버그 구분). pointer-events:none 이라 조작 방해 없음.

## 2026-07-19 — 로켓 다트(1발·고파워) 추가 + 미니건 손잡이 위로 원복 (사용자 요청)

10살 사용자 요청 2건.
- **A. 로켓 다트(`mag_rocket`)**: 다트 팩. capacity 1(한 발) + `delta{power:6, weight:3}`(파워 대폭↑). 08 금칙어라 "대미지" 대신 "파워" 표기. 장착 시 대부분 몸통 파워 10(clamp). power→composeProjectileScale·탄속 반영이라 발사체가 더 크고 빠름. buildMagazine 신규 분기: 몸통 아래 매달린 토이 로켓(둥근 몸체+주황 노즈콘 고정색+꼬리 지느러미3+목) = 6메시.
- **B. 미니건 손잡이 위로 원복**: 직전 "미니건 풀세트면 손잡이 하단(-Y)" 을 사용자가 "다시 위로" 요청 → assembly 의 isMinigunSet 하단-라우팅·180° 뒤집기 제거, grip_minigun 은 항상 gripTop(+Y). barrelCountFromMorph import 제거. 관련 테스트를 "손잡이 항상 위" 로 교체.
- **버전 뱃지 5**: index.html 뱃지 "버전 4→5"(배포 반영 확인용).
- **검증**: 66테스트·typecheck 통과. 실브라우저 — 로켓 다트 장착 파워 10·로켓 렌더, 미니건 손잡이 몸통 위 복귀 확인. vocab: "로켓 다트"·"파워"·"재장전" 금칙어 아님.

## 2026-07-19 — 쏘기 뷰모델 위치를 파츠 기준으로 (사용자 요청)

10살 사용자 요청 "모든 총을 내리지 말고, 미니건 이름 파츠 다 착용 시만 화면 밑으로. 리볼버는 조금만."
- **fitViewmodel 규칙을 크기기반 → 파츠기반으로 교체**:
  - `isFullMinigun`(body_minigun && grip_minigun): 크게 축소 + 화면 하단으로 매달기(기존 미니건 로직).
  - `hasRevolver`(grip_revolver || mag_revolver): `position.y = -0.08` 로 조금만 아래.
  - 그 외: 무변(모든 총을 내리지 않음). 이전엔 max(x,y)>0.34 인 큰 보통 총(타이탄+스코프 등)도 내려가던 걸 중단.
- 미니건 판정에서 barrelCount 6 요구 제거 — "이름에 미니건 든 파츠(코어+손잡이)" 착용 기준.
- 버전 뱃지 5→6.
- **검증**: 66테스트·typecheck 통과. 실브라우저 3케이스 — 미니건풀=쭉 내림, 리볼버=조금, 타이탄+스코프=무변(원위치).

## 2026-07-19 — 리볼버 뷰모델 아주 살짝 위로 (사용자 요청)

fitViewmodel 의 리볼버 하강량 `position.y -0.08 → -0.05` (아주 살짝 위로). 버전 뱃지 6→7. 실브라우저 확인.

## 2026-07-21 — 어깨에 멜 수 있는 말랑 어깨끈 추가

사용자 요청 "파츠 중에 끈(어깨에 멜 수 있는)을 추가".
- **독립 슬롯**: `SlotType`에 `strap` 추가, 전 몸통 소켓·공방 탭·색칠 탭·완전 랜덤 조립에 배선. 기존 그립·스톡과 동시 장착 가능.
- **파츠**: `strap_comfy`(말랑 어깨끈), 스탯 델타 0. 몸통 오른쪽 측면의 앞·뒤 체결 고리를 U자 TubeGeometry로 연결해 아래로 늘어지는 실루엣. 끈=primary, 고리=accent 색칠.
- **morph 대응**: 몸통 폭·높이·길이로 strap 앵커 위치와 스케일을 재계산해 9개 몸통 모두에 밀착. 기존 저장은 strap 키가 없어도 그대로이며 SAVE_VERSION 변경 없음.
- **회귀 방지**: 전 카탈로그 메시/색칠 자동 검사에 포함하고, 9개 몸통 실제 조립 위치·아래 늘어짐·측면 부착 및 세이브 roundtrip 전용 테스트 추가.
- **배포 표식**: index.html 버전 뱃지 7→8.
- **검증**: 최신 원격 9커밋 통합 후 `npm run verify` 68/68·`npm run build` 통과. 헤드리스 Edge 실 UI에서 버전 8·탭 선택→장착→12프레임 수동 렌더→localStorage 자동저장 확인, JS/WebGL 오류 0. 실제 캡처에서 끈과 앞·뒤 고리 가시성 확인.

## 2026-07-21 — 현실 장비의 기능 인상을 가상 토이 7계열로 대규모 확장

사용자가 제시한 여러 현실 장비의 비율·배치 요소를 참고하되, `08_safety` 하드룰에 따라 브랜드/모델명과 완성 실루엣은 복제하지 않고 장척·중량·초소형·후방중심·나란한 2열·곡선형·경주형 토이 계열로 분산 재해석했다.

- **카탈로그 40→76종**: 몸통 7종(`body_comet/turbine/buzz/reverse/duo/hook/racer`) + 부착 파츠 29종 추가. 슬롯별 총수는 몸통16·배럴13·다트팩10·조준기8·그립10·꼬리10·끈1·끝장식8.
- **몸통 고유 실루엣**: `BodyDims.detail` 7스타일(pods/wheels/bumpers/rearBubble/twinCheeks/hook/wings) 신설. 기본 공통 셸에 최대 2메시 시그니처만 더해 몸통끼리 구분하면서 자유 장식 최대에서도 14메시 예산 유지.
- **부착 파츠 전용 레시피**: 신규 29종 모두 전용 메시 분기. 구슬 고리/동력 휠/균형 방울/지느러미 튜브, 빛구슬/브리지/버블/핀 뷰어, U자/구형/후방방울/곡선/경주형 그립, 6종 꼬리, 4종 팩, 4종 안전 팁을 추가.
- **기존 중복 해소**: `barrel_twin`은 morph와 무관하게 최소 2열, `grip_chunky`는 굵은 범퍼형, `stock_spring/skeleton`은 고리/열린 지지대형, `mag_mini/spring/jelly`는 크기·코일·방울 차별화, `muzzle_ring`은 이중 도넛형으로 분리.
- **통합 배선**: 범용 카탈로그 경로로 공방 선택·색칠·세이브·시작 해금 자동 편입. 완전 랜덤 배열에서 누락됐던 `magazine`을 추가해 신규 팩도 발견 가능. ID 추가만이라 `SAVE_VERSION=1` 유지.
- **안전 게이트 강화**: 이번 요청에서 유입 가능성이 확인된 현실 모델 토큰을 한글/영문 금칙어 정본과 코드 사전에 추가. 신규 이름은 가상 토이 어휘만 사용하고 모든 끝 장식에 주황 안전 포인트 유지.
- **회귀 테스트**: 신규 몸통 7종 고유 바운딩 시그니처·길이/두께 비율, 신규 파츠 29종 전용 최소 메시, 트윈 기본 2열, 신규 풀세트 세이브 roundtrip을 추가. 16개 전 몸통에서 넓어진 측면 장식까지 반영해 어깨끈 체결점도 외곽으로 자동 보정.
- **문서 정합화**: 00/02/03/07/08 정본에 76종 로스터·7계열 시각 레시피·현재 파츠당 14메시/완전 장착 56 draw call 보수적 상한·금칙어를 동기화.
- **배포 표식**: index.html 버전 뱃지 8→9.
- **최종 검증**: `npm run verify` 73/73 통과(typecheck 포함) + `npm run build` 성공. 인앱 브라우저에서 버전 9·코멧/터빈 풀세트·76종 목록 노출·완전 랜덤의 신규 포켓 팩 선택·새로고침 후 자동저장 복원을 확인. JS 오류 0(그래픽 드라이버 정밀도 warning 1건만, 렌더 정상).

## 2026-07-22 — OOP·확장성 구조 개편 완료

사용자 요청에 따라 OOP/SOLID·유지보수 관점 감사에서 제안한 순서를 동작 보존형으로 끝까지 적용했다.

- **배포·구조 게이트**: Pages CI를 `npm run verify → build` 순서로 변경. `check-architecture.mjs`(leaf 역참조+main 850줄)와 `check-hotpaths.mjs`(tick/update/animate의 Three 할당)를 실제 verify 체인에 연결.
- **단일 레지스트리**: `definitions.ts`에 8슬롯·4스테이션·3발사체의 라벨/모드/부착/morph/색칠/랜덤/물리/시각 정책을 통합. `budgets.ts`에 풀64·파츠14·완전장착56·씬300을 정본화.
- **상태 캡슐화**: `EditorSession`이 파츠·morph 제스처·undo·랜덤·색칠을, `RangeSession`이 조준·탄약·재장전·반동·명중·별을 소유. `main.ts` 1,075→771줄.
- **비주얼 Strategy 분리**: 1,590줄 `partVisuals.ts`를 typed registry 파사드와 슬롯별 `visuals/*Visuals.ts` 8개로 분리. 카탈로그 ID와 독립 시각 레시피 ID의 집합 일치를 테스트로 강제해 조용한 기본 외형 위장을 차단.
- **도메인 타입·capability**: `PartDef`를 body/barrel/magazine/accessory discriminated union으로 강화. 특수 마운트·뷰모델 처리를 문자열 ID 비교 대신 capability 메타데이터로 이동.
- **발사체 도달성**: `barrel_wide=gel`, `barrel_hook=paint`를 연결하고 종류별 중력·반경·속도 상한·색·메시·명중 이펙트를 레지스트리화. 전 종류가 실제 카탈로그에서 도달 가능한지 자동 검증.
- **저장 경계**: `saveModel`·`SaveCodec`·`SaveRepository`·facade로 분리. storage/clock/id 생성기 주입, persist/import의 입력 객체 mutation 제거, 미등록 슬롯 차단. 저장 데이터 모양은 그대로라 `SAVE_VERSION=1` 유지.
- **UI DIP 개선**: paintPanel의 assembly/Three 직접 의존을 제거하고 main이 기존 BuiltPart에서 색칠 존 view model을 전달.
- **테스트 73→86개**: 슬롯·스테이션·발사체·ID 중복·카탈로그↔시각 완전성·동일-prefix 미등록 폴백·세션·저장소 불변성·풀 예산 테스트 추가.
- **실패 기록**: 최초 세션/저장소 클래스에 TypeScript parameter property를 사용해 Node strip-only 테스트가 로드 단계에서 실패. 명시적 필드+생성자 대입으로 교체 후 전체 녹색.
- **문서·배포 표식**: AGENTS/README/01/02/03/04/05/06/07/08/09의 4스테이션·3발사체·성능 예산·현재 모듈 구조를 동기화. 버전 배지 9→10.
- **브라우저 QA**: 로컬 Vite에서 버전 10·8슬롯 탭·4스테이션을 확인. 보관함/꾸미기/사격장 전환, 색칠 존 표시, 레드도트 선택(active), 공방 복귀가 정상이고 브라우저 error 로그 0.

## 2026-07-22 — OOP 감사 후속 유지보수 게이트 완료

구조 개편 문서에만 남아 있던 후속 항목을 실제 코드·테스트 계약으로 닫았다.

- **프레임 무할당**: `RangeSession.update`의 매 프레임 결과 객체를 상태+getter로 교체하고, 사격장 명중 이벤트·색종이 팔레트·발사체 풀 탐색의 임시 객체/배열/클로저를 제거했다.
- **AST 핫패스 게이트**: 기존 `new THREE.*` 문자열 탐지만 하던 검사를 TypeScript AST 기반으로 바꿔 `tick`·`animate`·`game update*`의 객체·배열·클로저·`new`·배열 생성 메서드를 차단한다.
- **외형 봉투 실검증**: 76종 확장 로스터에 맞춰 상한을 재기준화하고, 렌더러와 테스트가 공유하는 몸통·배럴 실측 함수를 추가했다. 전 파츠 꼭짓점·결정적 랜덤 50콤보·전 몸통×배럴 최대 전장을 자동 검증한다.
- **디버그 계약 타입화**: 실제 `window.__blasterLab` API를 `src/debug.ts` 인터페이스로 고정하고 main의 `unknown` 캐스트와 설계 문서 드리프트를 제거했다.
- **세이브 문서 정합화**: 존재하지 않는 빈 폐기/개명 매핑을 구현 완료로 주장하지 않도록 수정했다. 현재는 미지 파츠 ID 보존+시각 폴백, 미지 morph 키 제거가 정본이며 최초 실제 개명/폐기 커밋에서 매핑+테스트를 함께 추가한다.

## 2026-07-22 — OOP 후속항목 우선순위별 완료

- **P0 브라우저 시각 게이트**: Playwright가 실제 dist를 띄워 캔버스 비검정·색상 다양성·콘솔 오류 0·공방/사격장 전환을 자동 검증한다. 동일 은색 몸통의 matte/metal 정규 픽셀 차도 강제해 환경맵 no-op을 차단했다. 첫 실행에서 누락 favicon 404를 발견해 inline SVG favicon으로 실제 원인을 제거했다.
- **P1 성능 게이트**: `__blasterLab`으로 공방 10 calls/10 meshes, 사격장 29 calls/29 meshes/평균 6.09ms(예산 300/800/8ms), 몸통 12회 재빌드 후 geometry 11→11을 실측했다. Windows는 설치된 Edge, CI는 Playwright Chromium을 사용한다. 로컬 Chromium 다운로드는 사내 인증서 체인으로 실패해 Edge 채널로 전환했다.
- **P2 bounding box 계약**: t=0.5를 원시 치수 1.0으로 간주하던 충돌 사양을 폐기하고, 실제 몸통 셸·배럴 튜브가 공유 실측 정본과 기본·극단 morph 모두 ±10% 일치하도록 76종을 검증한다. 전체 단위 테스트 91개 통과.
- **P3 번들 ratchet**: 665.9KB 단일 JS를 앱 103.6KB + Three 562.5KB로 분리했다. 앱 120KB·Three 580KB·전체 700KB raw 상한을 빌드에 강제해 일반 경고 대신 프로젝트 맞춤 회귀 게이트로 전환했다.
- **배포 표식**: 버전 뱃지 10→11. CI는 `npm run verify:full` 통과 산출물만 Pages에 배포한다.
