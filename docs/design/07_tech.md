# 기술 아키텍처 · 마일스톤

> 신규 게임(표시명 가칭 **"블래스터 공방"** — 아들과 최종 결정, 결정문 1)은 `C:/ai-game-lab`(YUNU_GAME)에서 **검증된 규칙과 스크립트를 이식**하되, 전작이 겪은 "main.ts 12,000줄 비대화"를 **0일차부터 기계적 게이트로 차단**한다. 신규 repo = `C:/blaster-lab`(슬러그 `blaster-lab`, Pages base `/blaster-lab/`, localStorage 접두사 `blaster_lab_` — 결정문 1 확정).
>
> 본 개정판의 최우선 원칙: **M1 첫 플레이어블에서 이미 "바꾸면 달라지고, 맞으면 반응한다"가 성립**해야 한다. 여기에 결정문 27 이 한 축을 추가한다 — **자유 변형(파라메트릭 조형)이 M1 핵심 기둥**이다. 상세 사양(파라미터·봉투·UX)의 정본은 09 이며, 본 섹션은 그것이 올라탈 **모듈 구조·게이트·verify 편입·마일스톤 반영**만 소유한다.

## 1. 전작 아키텍처 규칙 계승 선언

전작 `AGENTS.md`(정본 작업지침)의 핵심 규칙을 신규 repo 의 `AGENTS.md` 에 **처음부터** 명문화한다. 전작은 사후 리팩터로 이 체계를 만들었지만(9,486줄까지 줄이는 데 수개월), 신규 repo 는 **초기 예산을 작게 걸고 시작**한다.

| 계승 규칙 | 전작 근거 | 신규 repo 적용 |
| --- | --- | --- |
| **main.ts = 지휘자** — 루프·입력·배선만, 신규 로직 금지 | AGENTS.md §1 "제1원칙" | 동일. 단 초기 예산 `MAX_MAIN_LINES = 400` 부터 시작(전작은 9,486) |
| **leaf 규칙** — `game/`·`ui/` 는 main.ts import 금지 | AGENTS.md §2 의존 방향 | `scripts/check-architecture.mjs` **무수정 복사** (실물 확인: 경로 하드코딩 없음, 그대로 동작) |
| **크기 ratchet** — 줄 수 + 메서드 수, 내려가기만 | AGENTS.md §7 | `check-main-size.mjs`·`check-method-count.mjs` 복사 후 상수만 교체 (`MAX_MAIN_LINES=400`, `MAX_METHODS=25`), 이력 주석 비움 |
| **핫패스 할당 금지** — update*/animate*/tick* 내 `new THREE.*`·`.clone()`·`innerHTML=` 차단 | AGENTS.md §10 | `check-hotpath-allocations.mjs` 무수정 복사. morph 재빌드는 pointer 이벤트 경로에서만 발생(09 §3.2)하므로 게이트와 충돌 없음 — 빌더 이름은 `rebuild*`, `update*` 금지 |
| **verify 파이프라인** | package.json `verify` 스크립트 체인 | 아래 신규 체인으로 개작 |
| **SAVE_VERSION 마이그레이션 + roundtrip 테스트** | AGENTS.md §6, `save-migration-test.mjs` | 테스트 러너 골격 복사, 케이스는 신규 작성 |
| **work-history 실패 기록** | AGENTS.md §11 | `docs/work-history.md` 빈 파일로 시작 |
| **멀티에이전트 규약** — 공유 파일 1에이전트, 리프 우선, 인계 전 커밋 | AGENTS.md §12 | 전문 그대로 이식 (Codex 병행 작업 전제) |

### 1.1 이식 스크립트 분류 정정 — "복사 5종 + 신작 2종"

전작 스크립트 실물 대조 결과, **`performance-smoke.mjs` 와 `visual-check.mjs` 는 "복사 후 상수 교체"가 불가능**하다. 둘 다 `window.__wildernessGame` 디버그 핸들에 강결합되어 있고, 전작 `PERF_BUDGET` 은 draw call 을 측정하지 않는다. 따라서:

**M0 에서 무수정(또는 상수만 교체) 복사 — 5종:**

```
check-architecture.mjs         # 무수정
check-main-size.mjs            # MAX_MAIN_LINES=400 교체
check-method-count.mjs         # MAX_METHODS=25 교체
check-hotpath-allocations.mjs  # 무수정
check-server.mjs               # 무수정
```

**신작 예약 — 2종** (전작에서 재사용하는 건 Chrome/Edge 실행파일 자동 탐색 보일러플레이트뿐):

- `visual-check.mjs` — **M1 신작** (~80줄): 페이지 로드 → `canvas` 대기 → 비검정 픽셀 검사 → 콘솔 에러 0.
- `performance-smoke.mjs` — **M2 신작** (~100줄): 게임이 먼저 디버그 핸들을 노출한 뒤 작성한다.

```typescript
// main.ts 부팅 시 1회 노출 — QA 하네스 전용 (전작 __wildernessGame 패턴 계승)
declare global {
  interface Window { __blasterLab?: BlasterLabDebugHandle }
}
export interface BlasterLabDebugHandle {
  profile(): { visibleMeshes: number; drawCalls: number; frameMs: number };
  // drawCalls = renderer.info.render.calls — 신작 스크립트가 실측하는 지표
  getBlaster(): Blaster;
  equipPart(slot: SlotType, partId: string): void;   // 테스트 자동화용
  setMorph(slot: SlotType, key: string, t: number): void; // 09 봉투·앵커 테스트 자동화용
  fire(): void;
  setMode(mode: GameMode): void;
}
```

### 1.2 성능 예산 단일표 (본 섹션 단독 소유 — 결정문 23)

02·03·04·08 은 개별 수치를 갖지 않고 **이 표를 참조**한다.

| 항목 | 예산 | 비고 |
| --- | --- | --- |
| 블래스터 draw call | ≤ 56 | 8슬롯 완전 장착 + 슬롯별 자유 장식 극단의 보수적 합산 상한. 자동 테스트로 재계산하며 후속 병합 최적화 시 하향 ratchet |
| 파츠당 메시 | ≤ 14 | 전 카탈로그×기본/극단 morph로 `countMeshes` 자동 재검사. 몸통 최악 = 기본5+고유2+자유장식7 |
| 투사체 풀 | 64 | 전작 §10-5 "spawn = 제거 경로 + 상한" 그대로 |
| 씬 총 예산 (draw call) | ≤ 300 | perf-smoke 실측 대조 |
| 가시 메시 (perf-smoke 실측) | ≤ 800 | 정적 공방·사격장 씬 — 전작(~6,160) 대비 낮게 시작해 ratchet |
| 평균 프레임 (데스크톱) | ≤ 8ms | 결정문 22 — PC 데스크톱 우선 |

### 1.3 verify 체인

```json
"verify": "npm run typecheck && npm run check:size && npm run check:methods && npm run check:architecture && npm run check:hotpath && npm run test:assembly && npm run test:morph && npm run test:ballistics && npm run test:save-roundtrip",
"verify:full": "npm run verify && node scripts/check-server.mjs && npm run visual-check && npm run perf-check"
```

- `test:morph`(봉투 교차표 전수 + 속성 50콤보 + statDelta 3점 — 내용 정본 09 §7)와 `test:ballistics`(탄도가 M1 로 당겨짐 — 결정문 19)는 **M1 부터** 체인에 합류한다. `test:save-migration` 은 SAVE_VERSION 2 가 생기는 M3 에 합류(러너가 없는 단계에서 빈 스크립트로 채우지 않는다).
- 의존성은 전작에서 **three + @types/three + typescript + vite + playwright-core 만** 가져온다. firebase·peerjs·classic-level 은 제외(싱글플레이 시작 — 온라인 기능이 필요해지면 전작 `progressSync.ts` 패턴 재사용, 상세는 확장 로드맵 섹션).

### 1.4 AGENTS.md 신규(본 게임 특화) 규약 — 처음부터 명문화

1. **`PartDef.id` 는 영구 불변.** 개명은 `nameKo` 만 바꾼다. 파츠를 없앨 땐 id 를 `RETIRED_PART_FALLBACKS` 테이블(구 id → 대체 id)에 등록한다. morph 키도 같은 계열 — `MORPH_KEY_RENAMES`(09 §6 정본). 아이의 저장 작품이 개편 한 번에 깨지는 사고를 원천 차단한다.
2. **카메라 컨트롤 자작 금지.** 공방 궤도 카메라는 `three/addons/controls/OrbitControls.js` + `minDistance`/`maxDistance`/`maxPolarAngle` 제한 설정으로 끝낸다(결정문 24). 단 **탭/드래그 판별(8px)은 pointer 이벤트 레이어에서 병행 구현**해 OrbitControls 와 발사·UI 탭이 간섭하지 않게 한다.
3. **체감 없는 스탯 금지.** 모든 스탯 축은 §3 매핑표에 "눈 또는 손으로 느껴지는 효과" 1개 이상이 배선되어야 추가할 수 있다. capacity·reload 가 M2(재장전 도입)까지 노출되지 않는 이유다(결정문 21).
4. **끼운 뒤 거부하는 UX 금지.** 유효성 검사는 사전 차단(UI 에서 애초에 선택 불가)이어야 한다. 몸통별 소켓 차등(결정문 17)은 "빈 소켓 = 없는 소켓" 표현(03)으로 UI 가 사전에 흡수하므로 사후 거부 경로가 없다.
5. **UI 아이콘은 절차 SVG — 이모지 금지** (결정문 25). 스탯 UI 에 숫자 노출 금지 — 별 5개 표기(결정문 3, 예외는 결과 화면 기록값 한정 — 08 §6).

## 2. 신규 repo 폴더 구조

```
blaster-lab/
├── AGENTS.md                  # 작업지침 정본 (전작 이식 + §1.4 특화 규약)
├── CLAUDE.md                  # → AGENTS.md 참조 1줄
├── docs/work-history.md       # 실패 포함 작업 일지
├── index.html
├── package.json / tsconfig.json / vite.config.ts
├── scripts/                   # §1.1 의 5개 복사 + 신작 2개 + 테스트 러너
│   ├── assembly-test.mjs      # 스탯 합성 단위테스트 (M1 전 — 의존되기 전에 테스트부터)
│   ├── morph-test.mjs         # 봉투 교차표·속성 콤보·statDelta — M1 (내용 정본 09 §7)
│   ├── ballistics-test.mjs    # M1 (결정문 19 — 포물선 탄도가 M1 정본)
│   ├── save-roundtrip-test.mjs
│   └── save-migration-test.mjs # M3 (버전 2 탄생 시점)
└── src/
    ├── main.ts                # 지휘자: 루프·입력·스테이션 전환 배선만 (예산 400줄)
    ├── style.css
    ├── game/                  # 순수 로직·데이터 (main.ts import 금지)
    │   ├── types.ts           # PartDef·PartInstance·Blaster 등 — 정본: 슬롯·로스터=02, morph=09, 세이브 컨테이너=05
    │   ├── constants.ts       # 물리 상수·슬롯 규칙·팔레트(PaletteKey — 08 정본)·§1.2 예산 상수
    │   ├── parts.ts           # 파츠 카탈로그 — 로스터·스탯 델타 정본 = 02 §3 (몸통·배럴·개머리판·다트 팩·조준기·총구)
    │   ├── assembly.ts        # 슬롯 규칙 검증(body 만 필수 — 결정문 16) + computeStats(02 정본·morph 인지형·맨몸 기본 발사값 포함)
    │   ├── morph.ts           # 자유 변형 파라미터·resolveMorph·statDelta·봉투 상수 — 정본 09
    │   ├── ballistics.ts      # 포물선(오일러) 탄도 — M1. 04 ShotProfile 계약 소비 (결정문 4·19)
    │   ├── targets.ts         # 타겟 정의 데이터 (과녁·풍선·캔·블록·드론)
    │   ├── scoring.ts         # 명중 판정 + 간이 별점(M1) → 정식 점수판·콤보(M2) — 코스 테이블은 04·05 병합 단일표(결정문 9)
    │   ├── paint.ts           # 3존 PaletteKey → 색|finish 머티리얼 캐시 적용 — 구현 정본 03 (결정문 10) — M3
    │   ├── patternTextures.ts # 패턴 3종: 파츠별 CanvasTexture 에디트 시점 생성·캐시 — M4
    │   ├── editHistory.ts     # undo 스택 (제네릭, 순수, redo 없음 — 결정문 15) — 배선 M1
    │   ├── saveMigration.ts   # SAVE_VERSION + migrate() (전작 패턴)
    │   ├── saveManager.ts     # 직렬화 + 미지 partId/MorphKey 폴백 + 백업 키 복원 (§5)
    │   ├── partVisuals.ts     # buildPart(partId, {morph, lod}) — 시그니처·재생성 전략 정본 09 §3
    │   ├── blasterVisuals.ts  # recomposeBlaster — 앵커 diff·재부착·페인트 재적용 순서 계약 (09 §3.3)
    │   ├── targetVisuals.ts   # 타겟 메시 팩토리 (넘어짐 트윈·풍선 pop 포함)
    │   ├── projectileVisuals.ts # 발사체 메시 — kind = gel·foam·paint (04 정본, 결정문 6), 공유 지오메트리·머티리얼
    │   └── sfxKit.ts          # 경쾌한 절차 효과음 — "뿅"(발사)·"팡"(명중), M1 부터
    └── ui/                    # DOM 표현 (main.ts import 금지, 게임 객체 접근 금지)
        ├── setupUi.ts         # 가로 레이아웃 뼈대: 좌 3D 뷰 + 우 패널 (결정문 22 — 세로 고정 아키텍처 폐기)
        ├── workshopPanel.ts   # 공방: 파츠 선택 목록·슬롯 UI (뷰모델 입력)
        ├── morphSliders.ts    # 자유 변형 슬라이더 — 사양 정본 09 §5 (56px·중앙 스냅·SVG 라벨) — M1
        ├── paintPanel.ts      # 팔레트 스와치·패턴 UI — 자유 RGB/색상환 금지 (결정문 11) — M3~
        ├── statCard.ts        # 스탯 카드 — 별 5개 표기·연속 채움·숫자 금지 (결정문 3) — M1
        ├── rangeHud.ts        # 사격장: 간이 별점·조준원(퍼짐 시각화) HUD — 다트 수 표기는 M2 (변경감지 캐시)
        ├── garagePanel.ts     # "진열장" — 저장 블래스터 목록·이름 짓기 (결정문 25) — M3
        └── touchControls.ts   # 터치 (전작 leaf 패턴 개작) — M2 (결정문 22; 모바일 세로 반응형은 M3+)
```

핵심 설계 원칙 — **전작 §12 "데이터/리프 우선"을 본 게임의 본질로 삼는다**: 파츠 추가 = `parts.ts` 에 데이터 1건 + `partVisuals.ts` 에 케이스 1개, morph 파라미터 추가 = `morph.ts` 에 정의 1건. **main.ts 변경 0**. 이것이 아들의 "이런 파츠 만들어줘" 요청을 30분 안에 반영하는 구조다.

핵심 타입 스케치 (`game/types.ts`) — **정본은 02(슬롯·로스터 구조)·09(morph)·05(세이브 컨테이너), 아래는 배선용 스케치다** (결정문 12):

```typescript
export interface PartDef {
  readonly id: string;            // "body_bulldog" — id 규약 정본 03. §1.4-1: 영구 불변
  readonly slot: SlotType;        // 02 SlotType 정본. SocketId 문자열 = 슬롯명 동일 (결정문 2)
  readonly nameKo: string;        // "불독 몸통" — 개명은 이 필드만. 아들 네이밍 세션에서 교체 가능
  readonly stats: PartStats;      // 6스탯(1~10) 델타 — 수치 정본 02 §3
  // compatible 필드 없음 — 파츠 간 호환 제한 없음. 몸통별 소켓 차등(결정문 17)만 존재하며 UI 가 사전 흡수(§1.4-4)
}

export interface PartInstance {   // 결정문 12 — 파츠 인스턴스별 paint·morph
  partId: string;
  paint: PartPaint;               // 3존(primary/secondary/accent) PaletteKey — 계약 정본 03/08 (결정문 11·12)
  morph: MorphState;              // 0..1 정규 Record, 기본값(0.5) 키 생략 — 정본 09
}

export interface Blaster {        // 단일 타입 확정 (결정문 12)
  id: string; name: string; createdAt: number;
  parts: Partial<Record<SlotType, PartInstance>>;  // body 만 필수 (결정문 16)
}
```

스탯 합성 결과는 별도 타입을 두지 않는다 — `computeStats`(02 정본)가 **6스탯(1~10) + 파생 1** 을 반환하고, morph 델타를 인스턴스별로 합산하는 **morph 인지형 확장**(09 §4)과 **맨몸(body 만) 기본 발사값**(결정문 16)을 포함한다. 발사 변환은 04 ShotProfile 이 유일 경로다(§3).

## 3. 스탯 → 체감 매핑 (아키텍처가 요구하는 인터페이스)

스탯 집합·수치 정본은 02(6스탯 1~10 + 파생 1, mobility 는 handling 으로 통일 — 결정문 3), 발사 변환 정본은 04 ShotProfile(탄속 20~60m/s·퍼짐 0.3~4.0°·연사 간격 150~600ms·반동 파생 — 결정문 4)이다. 본 섹션은 **"모든 스탯은 초등학생이 눈·손으로 느끼는 효과에 배선된다"는 계약**을 인터페이스로 강제한다. 지각 불가능한 사실주의는 금지 — 과장 계수는 04 소관.

| 스탯 (정본 02) | 체감 배선 (필수) | 배선 시점 |
| --- | --- | --- |
| `power` | 탄속(04 클램프 20~60m/s) + 발사체 **크기** + 타겟 반응 과장(넉백·풍선 pop) | **M1** (탄속·크기) → M2 (타겟 반응 스케일) |
| `fireRate` | 발사 간격 150~600ms (누르고 있으면 연사) | **M1** |
| `accuracy` | 퍼짐 0.3~4.0° — 조준원 시각화 + 탄착이 원 안에 분산 | **M1** (드래그 조준이 M1 이므로 — 결정문 18; 조준원 연출 보강은 M2) |
| `handling` | 조준 관성 — 무거울수록 십자선이 드래그를 굼뜨게 따라옴 | M2 |
| `capacity` / `reload` | "다트 수"(결정문 25) · 재장전 시간 | **M2** — 재장전 도입과 동시 노출 (결정문 21 "체감 없는 스탯 금지") |

- morph 스탯 델타는 파츠 교체 델타보다 한 급 작다 — 결합식·체감 채널(연속 별 채움·퍼짐 원 프리뷰·사격장 바로가기)의 정본은 09 §4. 본 섹션은 `computeStats` 단일 경로(프리뷰와 실발사가 같은 함수를 봄 → 거짓 프리뷰 구조적 불가)만 강제한다.
- 초안의 `weight` 삭제·`handling` 대체, 호환성 제한(`compatible`) 제거 결론은 유지하되(§1.4-4), 최종 스탯 명세는 02 를 따른다.

## 4. 씬/상태 전환 — 스테이션 3종 (06 정본)

**단일 씬 + 그룹 토글**. 전작이 오버월드/동굴/요새를 단일 씬 오브젝트 스왑으로 처리해 검증된 방식이고, 본 게임은 전환 시 **블래스터 메시를 그대로 들고 가야** 하므로 씬을 나누면 오히려 메시 이전 비용이 생긴다.

```typescript
// main.ts 가 소유하는 스테이션 상태 — 정본 = 06 StationId 3종 (결정문 8, 초안 GameMode 2종 재정의)
type GameMode = "workshop" | "paint" | "range";   // paint 스테이션은 M3 합류
```

```
scene
├── workshopGroup   // 회전 받침대·작업대·배경 — 조립+자유 변형(09)의 무대
├── rangeGroup      // "사격장" 풍선 마당: 고정 과녁 3 + 풍선 6 — M1 (결정문 20)
├── paintGroup      // 색칠 스테이션 — M3 (공방 무대 재사용 여부는 06 소관)
├── blasterAnchor   // 조립된 블래스터 메시 — 전 스테이션 공용, 부모만 유지
└── lights          // 공용 (스테이션별 강도만 트윈)
```

- **M1 부터 공방↔사격장 전환이 존재한다** (초안의 "M1 은 모드 전환 없음·공방 내 고정 발사" 폐기 — 결정문 18·20). 전환 = `visible` 토글 + 카메라 리그 이동 + 배경색·조명 트윈 0.5초. 09 의 "쏴보러 가기" 버튼도 이 전환을 재사용한다.
- **M1 사격 = 1인칭 사대 고정 + 드래그 조준 + 탭/클릭 발사** (결정문 18). Pointer Lock 미사용 — 드래그 조준. 누르고 있으면 `fireRate` 간격 연사. 탭/드래그 판별(8px)은 §1.4-2 pointer 레이어와 공유.
- **탄도 = 포물선(오일러) 이 M1 정본** (결정문 19, 04 소관). `ballistics.ts` 는 04 ShotProfile 을 소비하는 순수 계산 리프.
- 카메라: 공방 = OrbitControls(§1.4-2), 사격장 = 1인칭 고정(전작 1인칭 카메라 코드 재사용).
- 두 그룹 모두 **부팅 시 1회 생성** 후 유지 — 전환 시 지오메트리/머티리얼 생성 없음(전작 §10 규칙). 타겟 리셋은 위치·상태 초기화만. 예외는 morph 재빌드뿐이며 pointer 경로 한정(09 §3.2).
- 발사체는 **풀 64 상한** (§1.2 단일표).
- 스테이션 전환 로직 자체는 `main.ts` 배선 10줄 이내. 카메라 트윈 계산은 `game/` 리프로.

## 5. 상태 관리 — 편집 상태 · undo · 자동저장 · 세이브 무결성

- **편집 상태의 단일 소유자는 main.ts**(전작 §3 공유 커널): `currentBlaster: Blaster` 1개. `ui/workshopPanel`·`ui/morphSliders` 는 뷰모델을 받아 렌더하고 콜백(`onSelectPart`, `onMorphChange`)만 노출 — 전작 A형(순수/뷰모델) 패턴.
- **undo = 06 스펙 정본** (결정문 15): **kind 분리 스택 — 조립+변형 통합 1개(공방), 색칠 1개(paint 스테이션, M3)**. 깊이 30, **redo 없음**. **배선은 M1** — 화면의 되돌리기 버튼 1개가 1차 수단(초등학생은 단축키를 안 쓴다), Ctrl+Z 는 보조 바인딩. 1 슬라이더 제스처 = 1 undo 엔트리·paint 미캡처 merge 복원 규칙의 정본은 09 §5. 스냅샷은 `{slot: {partId, morph}}` 수백 바이트라 30깊이 무부담.

```typescript
export interface EditHistory<T> { undo(): T | null; push(state: T): void; }  // redo 없음 (결정문 15)
export function createEditHistory<T>(limit = 30): EditHistory<T>;
```

- **저장 = 06 자동저장 4트리거가 정본** (결정문 14) — **명시 저장 버튼 없음** (초안의 "차고에 저장" 버튼 삭제). 09 의 슬라이더 pointerup·프리셋 버튼은 "변형 직후" 트리거로 flush 한다. 전작에서 겪은 **동시저장 경쟁·중복 슬롯 사고**(디바운스+`saveInProgress` 가드로 해소)를 알고 있으므로 처음부터 가드 포함.
- **세이브 루트 정본 = 05 SavedGame + 프로필 키 구조** (결정문 13) — 본 섹션의 스키마 표기는 스케치다. **morph 포함 SAVE_VERSION 1 부터**. localStorage 키 접두사 = `blaster_lab_` (결정문 1).
- **세이브 무결성 — ID 폴백 3중 방어 (M1 필수)**: `Blaster.parts` 는 문자열 ID 참조라 마이그레이션으로는 ID 소멸이 안 잡힌다. 아이가 아끼는 저장 블래스터가 소리 없이 깨지는 것은 최악의 사고이므로:
  1. `PartDef.id` 영구 불변(§1.4-1) + 삭제 시 `RETIRED_PART_FALLBACKS` 등록. morph 키는 `MORPH_KEY_RENAMES`(09 §6 — 미지 키 무시·NaN clamp 등 로드 규칙 정본).
  2. `saveManager` 로드 시 미지 partId → 폴백 테이블 → 그래도 없으면 슬롯별 기본 파츠 대체 + 콘솔 경고. **원본 세이브를 덮어쓰지 않는다** — 자동저장 트리거가 실제로 발화할 때만 갱신.
  3. `save-roundtrip-test.mjs` 에 "미지 partId 세이브 로드" + "미지 MorphKey 세이브 로드" 케이스 포함.
- **저장 실패 대비** (결정문 26): `saveManager` 는 쓰기 전 직전본을 백업 키(`blaster_lab_backup`)에 복사하고, 쓰기 실패·파손 감지 시 백업 복원 + 안내 화면을 띄운다.
- **부팅 가드 (M1, 결정문 26)**: ① WebAudio 첫 탭 resume 태스크, ② WebGL 컨텍스트 로스트 시 리로드 안내, ③ 설정 최소 토글 2종(사운드/에임 어시스트) — main.ts 부팅 배선. **M2 예약**: 일시정지, 이벤트 버스 계약(발행 정의 = 04).

## 6. 테스트 전략

| 대상 | 러너 | 시점 | 내용 |
| --- | --- | --- | --- |
| 스탯 합성 | `scripts/assembly-test.mjs` | **M1 전** (의존되기 전에 테스트부터 — 전작 §8) | 파츠 조합→스탯 스냅샷 12케이스 + 슬롯 규칙(body 만 필수) + 1~10 클램프 + 맨몸 기본 발사값 |
| morph | `morph-test.mjs` | **M1** | statDelta t=0/0.5/1 스냅샷 + 봉투 교차표 전수(전 partId × 범위 꼭짓점) + 속성 50콤보 + `countMeshes ≤ 6` + 앵커 전진량 — 케이스 정본 09 §7 |
| 직렬화 roundtrip | `save-roundtrip-test.mjs` | M1 | save→load→deepEqual + **미지 partId·미지 MorphKey 폴백 케이스** (전작 러너 골격 복사) |
| 마이그레이션 | `save-migration-test.mjs` | **버전 2가 생기는 순간**(M3) | v1 세이브 → 최신 로드. 전작 규율: SavedGame 형태 변경 = 버전↑ + 마이그레이션 + 테스트 같은 커밋 |
| 탄도 | `ballistics-test.mjs` | **M1** (결정문 19) | 고정 시드에서 포물선 낙차·연사 간격 + ShotProfile 클램프(20~60m/s·0.3~4.0°·150~600ms) 준수 검증 |
| 시각 | `visual-check.mjs` **신작** | M1 | 공방 씬 로드 + 캔버스 비검정 픽셀 + 콘솔 에러 0 |
| 성능 | `performance-smoke.mjs` **신작** | M2 | `window.__blasterLab.profile()` 실측 → §1.2 단일표 대조 |

러너는 전작 방식 그대로 **node 스크립트, tsx·esbuild 없이**: 순수 `game/*.ts` 를 직접 검증하기 위해 전작 `combat-test.mjs` 가 쓰는 로딩 방식을 복사한다.

## 7. 배포

전작 플로우 그대로: **push → GitHub Actions → GitHub Pages**. `vite.config.ts` 는 전작의 7줄짜리를 base 경로만 바꿔 복사:

```typescript
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/blaster-lab/" : "/",  // 결정문 1 확정
}));
```

Actions 워크플로 yml 도 전작 것 복사(build → pages artifact 업로드). 전작 메모리의 함정 계승: **테스트 = 배포 Pages + 캐시버스트(`?v=N`)**, 세이브는 출처(localhost/github.io)별 분리이므로 아들 PC 에서는 처음부터 Pages URL 로만 플레이하게 해 세이브 혼선을 차단한다. 플랫폼은 PC 데스크톱 우선(결정문 22 — 바탕화면 실행 아이콘).

## 8. 마일스톤 M0~M5 (+M1.5)

| 마일스톤 | 목표 | 포함 기능 | 완료 기준 (DoD) | 예상 세션 |
| --- | --- | --- | --- | --- |
| **M0 스캐폴드** | 게이트가 도는 빈 판 | repo 생성(`blaster-lab`)·Vite+TS strict·§1.1 복사 스크립트 5개 이식·AGENTS.md(§1.4 포함)·빈 씬+조명·Pages 배포(base 확정 — 결정문 1) | `npm run verify` 녹색, Pages URL 에서 빈 3D 씬 렌더 | 1 |
| **M1 첫 플레이어블** | "바꾸고, 주무르고, 쏘면 반응한다" | 파츠 **5종+맨몸**(몸통 2·배럴 2·사이트 1 — 결정문 21)·`computeStats`(02 정본·맨몸 기본값)·**자유 변형 5 파라미터+슬라이더**(정본 09 — 30Hz 재빌드·소켓 앵커·연속 별·퍼짐 원 프리뷰·봉투 사전 보정)·OrbitControls 공방·**사격장 "풍선 마당"**(과녁 3+풍선 6 — 결정문 20)·**1인칭 사대+드래그 조준+탭 발사**(결정문 18)·**포물선 탄도**(결정문 19)·ShotProfile 직결(결정문 4)·간이 별점·최소 주스(뿅·팡·넘어짐 트윈·풍선 pop)·별 5개 스탯 카드(숫자 금지 — 결정문 3)·**되돌리기 버튼 1개**(조립+변형 통합 — 결정문 15)·자동저장 4트리거(결정문 14)·저장 v1(morph 포함)+ID 폴백·부팅 가드 3종+백업 키(결정문 26)·visual-check 신작 | 아들이 파츠를 바꾸고 슬라이더로 몸통을 늘이면 **형태·연사·탄속·탄 크기가 눈에 띄게 달라지고**, 풍선 마당에서 조준해 맞히면 **소리와 반응이 난다**. assembly·morph·ballistics·roundtrip 테스트 녹색 | 2~3 |
| **M1.5 재미 부스터** (09 §8 신설) | 조형 놀이의 웃음 밀도 | **① 랜덤 섞기 버튼(첫 항목 — 유실 금지)**·② 프리셋 시드 2버튼·③ 변형 사운드("뽀롱" 피치·딸깍)·④ 속성 테스트 200 확장+극단 스크린샷 시트 | 랜덤 1탭으로 "세상에 없는 총"이 즉시 나오고 undo 1탭으로 복귀 | 0.5~1 |
| **M2 조립·사격 루프 확장** | 조합이 "선택"이 되고 루프가 깊어진다 | 파츠 로스터 확장(02 표 전체)·**다트 팩 슬롯+재장전+capacity·reload 노출**(결정문 21)·**스파크 코인 경제 도입**(결정문 5 — M1 은 ★2 직결 해금)·정식 점수판·콤보+**단일 코스 테이블**(모드=유형·코스=인스턴스 — 결정문 9)·`handling`→조준 관성·morph M2 파라미터+scope 원형(09)·**터치 컨트롤**(결정문 22)·일시정지+이벤트 버스 발행(결정문 26, 정의=04)·`__blasterLab` 핸들+perf-smoke 신작 | 무거운 배럴↔가벼운 배럴이 **화면에서 보이는** 낙차·연사·조준감 차이. 코스 재도전·기록 경신 성립, perf 예산 내 | 2~3 |
| **M3 꾸미기** | "내 총"이 되게 | **paint 스테이션 합류**(06 StationId — 결정문 8)·3존 PaletteKey+색\|finish 머티리얼 캐시(구현 정본 03 — 결정문 10·11·12, 자유 RGB/색상환 없음)·**진열장**(멀티 세이브 슬롯+이름 짓기 — 결정문 25)·색칠 undo 스택(paint 소속 — 결정문 15)·SAVE_VERSION 2 시 마이그레이션+테스트·모바일 세로 반응형 착수(M3+ — 결정문 22) | 색이 사격장까지 유지, 블래스터 3정 저장·전환, 색칠 되돌리기 동작, migration 테스트 녹색 | 1~2 |
| **M4 시뮬레이션 심화** | 검증→개선 루프 완성 | 코스 인스턴스 확장(단일 테이블에 행 추가)·개인 베스트·명중 이펙트 강화(색종이 파티클)·드론 타겟·**패턴 3종**(파츠별 CanvasTexture 에디트 시점 생성·캐시, 핫패스 아님) | 같은 코스를 다른 조합으로 재도전해 기록 경신, 패턴이 사격장까지 유지, perf-check 예산 내 | 2~3 |
| **M5 폴리시** | 아들 단독 플레이 가능 | 튜토리얼 코치마크·사운드 폴리시·**스티커**(자유 배치 대신 파츠별 고정 앵커 2~3곳 스프라이트 — 초등학생 UX 로도 이게 낫다)·verify:full 상시화 | 조립→변형→색칠→사격 전 루프 무도움 완주, visual-check·perf-check 포함 verify:full 녹색 | 1~2 |

**꾸미기 구현 난이도 3단계 분리**: ① 3존 PaletteKey = 색|finish 머티리얼 캐시(03 계약 참조 — 결정문 10) → **M3**. ② 패턴 = 파츠별 CanvasTexture 에디트 시점 생성·캐시(`patternTextures.ts`) → **M4** (per-블래스터 머티리얼은 페인트 확정 시점에만 생성 — 공유 머티리얼 핫패스 규칙과 무충돌). ③ 스티커 = 고정 앵커 스프라이트 → **M5**.

**30분 단위 분해 자가 검증**:

- M0: ①repo+Vite 부팅 ②스크립트 5종 이식+verify 녹색 ③빈 씬+Pages — 각 30분 — **통과**
- M1 (07 소유 증분): ①types+parts 데이터 ②assembly+테스트 ③partVisuals 몸통+배럴 ④OrbitControls+탭/드래그 판별(8px) ⑤ballistics 포물선+ShotProfile 배선 ⑥풍선 마당(과녁 3+풍선 6)+명중 판정+간이 별점 ⑦1인칭 사대+드래그 조준 전환 배선 ⑧주스(뿅·팡·트윈·pop) ⑨별 5개 스탯 카드 ⑩저장 v1+폴백+자동저장+백업 키 ⑪부팅 가드 — 각 30~60분, 매 단계 화면 확인 가능. **자유 변형 10 증분은 09 §9 가 소유** — 지오메트리 축(09 1~5)·UX 축(09 6~8)·안전망 축(09 9~10)이 07 증분과 축 간 병행 가능 — **통과**
- M2~M4: 파츠 1종·코스 1행·패턴 1종이 각각 독립 30분 작업(데이터/리프 우선 구조 덕). perf-smoke 신작만 60~90분 — ①핸들 노출 ②측정 스크립트로 분할 — **통과**
- M2 터치만 예외적 60~90분 덩어리 — 전작 touchControls.ts 베이스로 ①조준/시점 ②발사/UI 버튼 분할 — **통과**

**리스크 메모**: M1 밀도가 초안 대비 크게 상승했다(사격장 스테이션+포물선 탄도 편입 — 결정문 18~20, 자유 변형 기둥 — 결정문 27). 완충은 두 겹: ① 09 가 이미 morph 쪽을 M1 5 파라미터로 컷하고 재미 부스터를 M1.5 로 분리했다. ② 07 쪽에서 지연 시 밀 수 있는 것은 부팅 가드 일부(②③)·visual-check 뿐이며, **주스(⑧)·스탯 직결(⑤)·morph 즉물성(09 축)은 어떤 경우에도 M1 에서 밀지 않는다** — 이들이 빠지면 첫 플레이가 "무음으로 다트가 닿고 끝"이 되어 프로젝트 존재 이유(아들의 재미)가 첫 세션에 무너진다. 세이브 스키마 타입과 `PartDef.id` 불변 규약은 어떤 컷에서도 M1 확정.

> 겹치는 주제 위임: 파츠 카탈로그·스탯 수치 = **02**(단 §3 체감 매핑표는 본 섹션이 인터페이스로 강제), 지오메트리 레시피·페인트 구현 = **03**, 발사·탄도 계약 = **04**, 세이브 컨테이너·코스 데이터 = **05**, 스테이션·UX = **06**, **자유 변형 상세 = 09(정본)**, 랭킹 등 온라인 확장 = 확장 로드맵. 본 섹션은 그것들이 올라탈 코드 구조와 게이트만 확정한다.

## 열린 질문

- 초안의 2건(repo 이름·주 플레이 기기)은 결정문 1(blaster-lab 확정)·결정문 22(PC 데스크톱 우선, 터치 M2)로 해소 — 잔여 없음.

## 기각한 비평

- 없음 — 9건 모두 수용. 단 2건은 실물 대조 후 수용 범위를 조정했다: ③은 전작 `performance-smoke.mjs`·`visual-check.mjs` 를 직접 확인해 두 스크립트 모두 `__wildernessGame` 강결합임을 재확인하고 둘 다 "신작"으로 분류했으며, ④의 weight 는 "삭제 vs 조준 흔들림 전환" 중 **조준 관성(`handling`) 전환**을 채택했다(최종 스탯 명세는 02 정본 — 결정문 3).
