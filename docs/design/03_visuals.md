# 3D 표현 · 색칠 시스템

> **정본 관계** (결정문 반영): 파츠 로스터·스탯 델타·한글 표시명 = **02 §3** (결정문 7·21) / 성능 예산 단일표 = **07** (결정문 23) / 금칙어 리스트 = **08 §3.1** (결정문 25) / PaletteKey·색 저장 = **08** (결정문 11) / 자동저장 UX = **06** (결정문 14) / 세이브 루트 = **05** (결정문 13) / **자유 변형(파라메트릭 조형) = 09** (결정문 27). 이 문서는 지오메트리 빌더·존 색칠·머티리얼 캐시·조립 연출의 소유자로서 각 정본과의 계약만 기술한다.

## 0. 전작 계승 근거 (요약)

| 계승 항목 | 전작 근거 (C:/ai-game-lab) | 이번 게임 적용 |
|---|---|---|
| 순수 메시 팩토리 | `src/game/weaponVisuals.ts` 헤더 주석: "데이터 → THREE.Object3D 순수 팩토리 … 부수효과·커널 접근 금지" | `src/game/partVisuals.ts` 로 동일 패턴 |
| 전방 = -Z 규약 | 같은 파일: "총기는 총신이 -Z(전방)를 향하도록 만든다. 호출자가 시점에 맞는 회전을 더한다" | 모든 파츠·소켓의 전방축 = -Z 고정 |
| toon 룩 머티리얼 | `src/visuals.ts` — `gameMaterial`(roughness 0.74, metalness 0.03, envMapIntensity 0.35) + `makeToonMaterial`/`makeMetalMaterial`/`makeGlowMaterial` 파생 | 팩토리 4종 이식, 파라미터만 토이 플라스틱용 재조정 (§2) |
| vertex color | `src/visuals.ts:130` `makeGroundMaterial`(vertexColors: true), `environmentSpawns.ts` 나무 | 줄무늬 패턴 구현 경로 (§3.4) |
| 톤매핑 | `src/main.ts:1147` ACESFilmic + exposure 1.02 | 그대로. bloom 컴포저는 전작에서 화이트아웃으로 비활성한 전례 → 포스트프로세싱 없이 룩 완성 |
| ★HDRI 미배선 no-op 함정 | 전작 메모리: HDRI 금속반사가 부팅 미배선으로 no-op | 이번엔 환경맵 배선을 **M1 부팅 태스크로 명문화** (§2.1) — 주석 한 줄이 아니라 범위 항목 |

## 1. 절차 메시 파츠 모델링

### 1.1 좌표·단위·지오메트리 규약

- 단위 = 미터. **기본형(전 morph t=0.5) 완성 전장 0.55~0.95m** (전작 pistol slide 0.46m 과 동일 스케일 감각). morph 극단 포함 **합성 전장 상한 = 1.10m** — 09 §7 의 정적 예산 분할 요청(0.98→1.10 재보정)을 수용한다. 몸통 max + 배럴 max ≤ 1.10 은 09 봉투 검산 교차표가 보장.
- 파츠 로컬 원점 = **그 파츠의 부착점**. 배럴이면 뒤끝, 스톡이면 앞끝, 사이트면 밑면 중심.
- **부착 규약**: 파츠는 소켓 앵커의 자식으로 두고 로컬 원점에 고정한다 — `anchor.add(partGroup); partGroup.position.set(0,0,0)`. **`Object3D.attach()` 금지** — morph 로 앵커가 전진할 때 자식이 따라와야 한다(정본 = 09 §3.3).
- 전방 -Z / 위 +Y / 오른쪽 +X. 회전 보정은 호출자(1인칭 뷰·턴테이블) 책임 — 전작 규약 그대로.
- **길이축 = Z 굽기 규약**: Cylinder·Capsule 등 길쭉한 base geometry 는 생성 직후 `geo.rotateX(Math.PI / 2)` 로 **길이축을 로컬 Z 에 정렬해 지오메트리에 굽는다**. 메시 `rotation` 으로 눕히는 방식 금지 — CylinderGeometry 의 길이축은 Y 이고 메시 회전은 attribute 를 바꾸지 않으므로, 줄무늬 vertex color(§3.4)와 boundingBox 테스트가 geometry 좌표를 읽는 이상 지오메트리 단계에서 축을 통일해야 한다. 이 규약 덕에 `CylinderGeometry(r, r, L, 12, 8)` 의 heightSegments 8 도 회전 후 Z축 격자가 되어 밴딩 세그먼트로 유효하다.
- **원점 센터 규약**: 개별 지오메트리는 자기 중심이 원점이 되게 만들고(`translate()` 로 오프셋을 굽지 않는다), 파츠 내 배치는 `mesh.position`/`mesh.rotation` 으로 한다. 호버 셸 오버레이(§6)의 per-mesh scale 확대가 실루엣 셸로 성립하는 전제.
- 위 규약 전부는 **morph 재생성 빌드에도 그대로 적용**된다 (09 §3.1) — 슬라이더가 지오메트리를 다시 만들어도 축·원점·부착 계약은 불변.

### 1.2 파츠 카테고리별 실루엣 레시피 + 존 배정

핵심 원칙: **카테고리는 100m 실루엣으로, 같은 카테고리 내 개별 파츠는 비율·디테일 1~2개로 구분**한다. 프리미티브는 Box·Cylinder·Capsule·Cone·Torus·RoundedBox(three 내장 addon, 외부 에셋 아님)만 사용. 표의 수치는 **morph t=0.5 기본형의 기준 치수**다 — min/max 변형 범위의 정본 = 09 §2.

| 카테고리 | M | 실루엣 키 | 프리미티브 레시피 예 (수치는 팝콘 바디 기준) | 존 배정 (primary / secondary / accent) |
|---|---|---|---|---|
| body (몸통) | M1 | 게임의 중심 덩어리. 뚱뚱한 알약형 | RoundedBox 0.14×0.16×0.44 (radius 0.04) + 상단 캐리핸들 Torus 반쪽 + 방아쇠울 Torus(반경 0.045, tube 0.012) + 측면 파팅라인 띠 | 셸 = primary / 캐리핸들 = secondary / 방아쇠울 + 파팅라인 띠 = accent |
| barrel (배럴) | M1 | 앞으로 길게 뻗는 원기둥 계열 | 숏 스냅: Cylinder r0.035 L0.18 / 롱 레일: **r0.038 L0.40** (09 §7.1 봉투 검산 요청 수용 — 기존 0.035/0.42 재보정) + 끝 머즐링 Torus | 튜브 본체 = primary / 머즐링 = accent |
| sight (조준기) | M1 | 위로 솟는 유일한 파츠 | 도트: Box 0.05³ + 발광 dot(toyGlow) + 마운트 Box | 박스 본체 = primary / 마운트 = secondary / **발광 dot = 고정(비색칠)** |
| grip (그립) | M2 | 아래로 기운 손잡이 | Capsule r0.028 L0.09 를 **X축 +15° 회전(하단이 +Z 후방으로 기울게)** + 손가락 굴곡 Torus 2개 | 캡슐 본체 = primary / 손가락 굴곡 = accent |
| stock (개머리) | M2 | 뒤로 뻗는 두 번째 덩어리 | Box 0.05×0.10×0.22 + 엉덩이판 RoundedBox | 본체 = primary / 엉덩이판 = secondary |
| mag (다트 팩) | M2 | 아래로 매달린 상자 | RoundedBox 0.05×0.16×0.08 5° 전방 기울임(X축) + 투명창 Box(opacity 0.5) 안에 다트색 Capsule 3개 | 케이스 = primary / **투명창·다트 캡슐 = 고정(비색칠, 다트색은 탄 종류 표시)** |
| muzzle (총구 액세서리) | M2 | 앞끝 포인트 장식 | 나팔 Cone(첨단 Sphere 캡) / 스펀지 안전팁 Sphere r0.045 | 나팔 = primary / **주황 안전팁 = 고정(비색칠, #ff7a1a)** |

- 파츠당 메시 수 **≤6 (수치 정본 = 07 성능 예산 표, 결정문 23)** — verify 게이트 단위테스트로 강제: `countMeshes(buildPart(id, opts).group) <= 6` (§8). **morph 극단값에서도 재검사**한다 — morph 는 메시 수를 바꾸지 않는다 (09 §3.5).
- 개별 파츠 차별화 예 — M1 배럴 2종(숏 스냅·롱 레일)은 길이·반경과 끝 장식만 다르고 코드 대부분 재사용 → 실루엣이 다르면서 구현 저렴. 여기에 **morph(09)가 겹쳐져 같은 배럴도 연속체로 변형**되므로, 프리셋 파츠 수가 적어도 조형 공간은 넓다.
- 고정(비색칠) 메시는 존에 소속되지 않으며 `zones` 반환값(§3.1)에 넣지 않고, **morph 스케일에서도 제외**된다(안전팁·발광 dot 크기 불변 — 09 §7).
- **축 실수 기계 검출**: 파츠별 boundingBox 스모크 테스트(**기본형 t=0.5 에서** 예상 치수 ±10%)를 verify 에 포함. 극단 morph(t=0/1)의 치수 검산은 09 의 봉투 교차표·속성 테스트가 소유.

### 1.3 소켓 앵커 규약

바디가 소켓의 소유자다(파츠에 파츠를 다는 체인은 M1 금지 — 유일한 예외는 M2 총구 액세서리의 **배럴 끝 앵커 승계 부착**, 정본 = 09 §3.3).

```ts
// SocketId 문자열 = 슬롯명과 동일 (결정문 2): barrel 마운트 소켓 = "barrel"
type SocketId = "barrel" | "sight" | "grip" | "stock" | "mag";
type PartCategory = "body" | "barrel" | "sight" | "grip" | "stock" | "mag" | "muzzle";

interface SocketDef {
  id: SocketId;
  position: [number, number, number]; // 바디 로컬 좌표(m), t=0.5 기본형 기준. 방향은 전 소켓 -Z 전방 고정
  accepts: PartCategory;              // M1은 1소켓 1카테고리 (단순화)
}

// 팝콘 바디(body_popcorn)의 실제 값 예시
const BODY_POPCORN_SOCKETS: SocketDef[] = [
  { id: "barrel", position: [0,  0.02, -0.26], accepts: "barrel" },
  { id: "sight",  position: [0,  0.10, -0.05], accepts: "sight" },
  { id: "grip",   position: [0, -0.06,  0.10], accepts: "grip" },   // 파츠는 M2, 소켓은 지금 정의
  { id: "stock",  position: [0,  0.01,  0.22], accepts: "stock" },
  { id: "mag",    position: [0, -0.08, -0.04], accepts: "mag" },
];
```

- **소켓 차등 = 몸통 개성** (결정문 17, 정본 02): 바디마다 소켓 집합이 다를 수 있다 — 모든 바디가 같은 집합을 갖는다는 구 문구는 폐기.
- **"빈 소켓 = 없는 소켓" 표현 규칙** (결정문 17, 03 소유): 빈 소켓에 상시 마커·구멍·스터브를 그리지 않는다 — 파츠가 없으면 그 자리는 매끈한 몸통이다. 부착 인터랙션 중의 고스트 구 펄스(§6)는 조립 UI 컨텍스트 한정(상세 UX = 06).
- **필수 슬롯 = body 만** (결정문 16): 맨몸(몸통 단독)이 완성 실루엣으로 성립해야 한다 — 캐리핸들·방아쇠울이 몸통 소속인 이유.
- **총구 액세서리(muzzle, M2)는 바디 소켓이 아니다** — 배럴 빌더가 반환하는 총구 끝 앵커에 부착되어, `barrelLength` morph 로 배럴이 늘면 같이 전진한다 (정본 = 09 §3.3).
- **소켓 앵커는 morph 를 따라간다**: 몸통 빌더가 morph 반영 좌표의 앵커(`anchors`)를 반환한다 — `bodyLength` t=1 이면 barrel 소켓 z 전진, grip·mag 앵커는 비례 위치 유지 (정본 = 09 §3.3, 계약 = §3.1 BuiltPart).

### 1.4 파츠 id 규약 · 표시명 정책

- **id 규약 (03 소유, 결정문 7)**: `{category}_{name}` 소문자 스네이크 — `body_popcorn`, `body_bulldog`, `barrel_snap`, `barrel_rail`, `sight_dot`.
- **로스터·스탯 델타·한글 표시명 정본 = 02 §3** (결정문 7). M1 로스터 = 몸통 2(팝콘·불도그) + 배럴 2(숏 스냅·롱 레일) + 사이트 1(도트) = **5종 + 맨몸** (결정문 21, 탄창은 M2 — 한글 표시 "다트 팩", 결정문 2). 표시명은 아들 네이밍 세션에서 교체 가능(명기) — 표시명 테이블 교체만으로 비용 0.
- **금칙어 리스트 단일 정본 = 08 §3.1** (결정문 25 — 03 의 구 자체 목록은 08 로 병합됨). **verify 게이트**: 모든 partId·displayName·UI 문자열·**morph 슬라이더 라벨**(09)을 08 §3.1 리스트로 스캔해 하나라도 걸리면 빌드 실패. 이름을 짓는 순간이 아니라 빌드 시점에 기계가 막는다.
- 가드레일 "가상의 장난감 이름만"은 설계 라벨 단계부터 적용 — 내부 설계명은 partId·UI 표시명으로 흘러가는 게 기본 경로이므로 전 층위에서 실총 유형 단어를 배제한다.

## 2. Toon 룩 통일 — 통통한 토이 형태 언어

### 2.1 머티리얼 팩토리 4종 + 환경맵 부팅 배선 (M1)

전작 `visuals.ts` 이식, 토이 플라스틱용 파라미터:

| 팩토리 | roughness | metalness | 용도 | 비고 |
|---|---|---|---|---|
| `toyMatte` | 0.75 | 0.02 | 기본 플라스틱 (전작 gameMaterial 값 근접) | 색칠 기본 finish |
| `toyGloss` | 0.28 | 0.05 | 광택 플라스틱 — "새 장난감" 하이라이트 | envMapIntensity 0.7 |
| `toyMetal` | 0.38 | 0.34 | 크롬 튜닝 (전작 makeMetalMaterial 값 그대로) | 환경맵 필수 — 아래 부팅 태스크 |
| `toyGlow` | 0.28 | 0.04 | 에너지셀·도트사이트 (emissiveIntensity 0.55) | bloom 없이 emissive 만으로 |

**환경맵 부팅 태스크 (M1 범위 명문 항목)** — 전작의 "HDRI 미배선 → 금속반사 no-op" 사고 재발 방지. `scene.environment` 없이는 toyMetal 이 어두운 플라스틱 덩어리가 되고 toyGloss 의 envMapIntensity 0.7 도 no-op — 아이가 "크롬" 버튼을 누르면 오히려 칙칙해지는 "고장난 버튼" 경험이 된다.

```ts
// 부팅 시 1회. three 내장 addon(RoomEnvironment), 외부 에셋 0, ~20줄
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
pmrem.dispose();
```

- **자동 검증**: playwright 스크린샷 QA(전작 하네스 계승)에 "같은 파츠를 toyMetal vs toyMatte 로 렌더한 두 샷의 픽셀 분산 차이 > 임계값" 체크 1개 추가. 배선이 끊기면 두 샷이 비슷해져 테스트가 잡는다.
- **이월 조건**: 이 배선이 M1 에 못 들어가면 metal finish 를 M2 로 이월하고 M1 finish 는 matte·gloss 2종으로 출시한다. 고장난 버튼을 내보내는 선택지는 없다.

### 2.2 통통함 형태 규칙 5개 (전 파츠 공통, 코드 리뷰 기준)

1. 노출 모서리는 RoundedBox radius = 최소변의 **25~35%**. 순수 BoxGeometry 는 내부 은면에만. **morph 재생성 시 라운드 반경은 재계산**한다 — 스케일로 뭉개지 않는다 (09 §7).
2. 두께 과장 — 실물 비율 대비 단면적 **1.3~1.5배** (전작 몬스터 비주얼의 통통 비율 감각). morph 극단에서도 토이 프로포션이 유지되는 근거는 09 §7 봉투(최소 단면 반경 ≥0.028m 등)의 설계 시점 사전 보정.
3. 예각 금지 — Cone 첨단은 항상 작은 Sphere 로 캡(r ≥ 0.02 — `bodyNose` morph 극단에서도 유지, 09 §7). "찌르는 형태" 자체를 조형에서 배제 (연령 가드레일의 조형 버전).
4. 파팅 라인 — 실제 토이처럼 몸통 측면에 얇은 accent 띠(Box 두께 0.004) 1개 → accent 존 소속(§1.2). 단 이 띠는 accent 존의 유일 멤버가 아니다 — 방아쇠울 등 덩어리 메시와 함께 묶여, 존 선택 피드백(§3.3 펄스)이 눈에 보인다.
5. 안전팁 주황 — muzzle 액세서리 기본형은 주황(#ff7a1a) 고정 존. 토이 블래스터 기호를 게임 아이덴티티로.

윤곽선(OutlinePass)·bloom 은 **채택하지 않는다** — 전작에서 bloom 컴포저가 화이트아웃으로 비활성된 전례가 있고, MeshStandard + ACESFilmic 만으로 toon 룩이 검증됐다. 라이팅은 조립 화면 전용 3점(key 1.1 / fill 0.4 / rim 0.6, HemisphereLight sky #bfe3ff)으로 고정.

## 3. 색칠 시스템

### 3.1 색 존(Zone) 모델 + 존→메시 매핑 계약

파츠마다 **최대 3개 존** — 메시들이 존에 소속되고, 색칠은 존 단위로 한다. 메시별 색칠은 자유도 대비 UI 복잡도가 초등학생에게 과함.

```ts
type ZoneId = "primary" | "secondary" | "accent";
type Finish = "matte" | "gloss" | "metal";
type PaletteKey = string;            // "racing_3" 형식 — 키 체계·hex 해석의 정본 = 08 (결정문 11)

interface ZonePaint {
  color: PaletteKey;                 // 팔레트 키 문자열로 저장. 자유 RGB/hex 직저장 금지 (결정문 11)
  finish: Finish;
  pattern?: StripePattern;           // M2. 없으면 단색
}
interface StripePattern { type: "stripe"; color2: PaletteKey; bands: 3 | 5 | 7; }

type PartPaint = Partial<Record<ZoneId, ZonePaint>>;
```

- **폴백 키 규칙** (결정문 11): 로드 시 존재하지 않는(삭제·개명된) PaletteKey 는 08 이 정의한 폴백 키로 무소음 대체한다 — 팔레트 개편에도 세이브가 죽지 않는다.

**존→메시 매핑은 팩토리 반환 계약으로 확정한다** — 이 매핑 없이는 색칠 시스템 전체가 미구현이므로 스펙의 1급 시민이다. 시그니처는 09 의 morph 확장을 수용한 형태가 정본이다 (09 §3.1):

```ts
interface BuildOpts { morph: MorphState; lod?: "drag" | "full"; }   // 정본 = 09 §3.1
interface BuiltPart {
  group: THREE.Group;
  zones: Partial<Record<ZoneId, THREE.Mesh[]>>;             // 03 소유 — 고정(비색칠) 메시는 제외
  anchors: Partial<Record<SocketId, THREE.Object3D>>;       // morph 반영 소켓 앵커 (09 §3.3)
  dispose(): void;  // 인스턴스 지오메트리만 정리. 머티리얼은 캐시 소유 — 절대 dispose 금지 (§5)
}
export function buildPart(partId: string, opts: BuildOpts): BuiltPart;
```

- 존 배정의 정본 = §1.2 레시피 표의 "존 배정" 열. 팩토리 구현이 표와 어긋나면 표를 고치든 코드를 고치든 한쪽으로 수렴시킨다.
- **존 매핑은 morph 재빌드를 관통해 안정**해야 한다 — 재생성된 메시도 같은 존에 재소속되고, 페인트 재적용은 `recomposeBlaster` 순서 계약(09 §3.3~3.4)의 마지막 단계.
- **verify 단위테스트**: 모든 파츠에 대해 `zones.primary` 존재 + 메시 ≥1. secondary·accent 는 파츠에 따라 없을 수 있다.
- **투톤은 M1에서 공짜다** — primary/accent 존이 이미 분리돼 있어 존 2개에 다른 색을 넣는 것만으로 투톤 완성. 별도 패턴 시스템 불필요.

### 3.2 팔레트 프리셋

팔레트는 **UI 편의**(색 6개 원터치 버튼)이자 **PaletteKey 의 유일한 색 공급원**이다(키 체계 정본 = 08). 6프리셋 × 6색 = 36색.

| 프리셋 | 색 6종 (hex — 렌더 해석용, 저장은 키) |
|---|---|
| 파스텔 | #ffd6e0 #ffe8b8 #d0f4de #a9def9 #e4c1f9 #fcf6bd |
| 네온 | #39ff14 #ff2079 #00e5ff #ffe700 #ff6b1a #b026ff |
| 숲속 소풍 | #7ed957 #ffde59 #a8e6cf #ffb347 #87ceeb #f7a072 |
| 레이싱 | #e10600 #ffffff #1e1e24 #ffcc00 #005eb8 #c0c0c8 |
| 사탕가게 | #ff85a1 #7ae582 #9d4edd #ffd23f #4cc9f0 #ff9770 |
| 우주 | #1b1b3a #6c5ce7 #a29bfe #dfe6e9 #00cec9 #ffeaa7 |

- 구 "정글 위장" 프리셋은 **비군사 테마 "숲속 소풍"으로 교체** (결정문 25) — 위장 무늬 연상 올리브·카키 계열 배제, 밝은 자연색만.
- **primary(본체) 존 밝은 색 강제 — 08 슬롯 차등 매핑** (결정문 25): 어두운 색 키(예: 레이싱 #1e1e24, 우주 #1b1b3a)는 primary 존 선택 시 색 버튼에서 필터(비노출)되어 secondary·accent 존 전용이다. 밝음 판정 기준치는 08 소유.
- "프리셋 전체 적용" 버튼: **존 역할로만 매핑한다** — 1번색 → 전 파츠 primary, 3번색 → secondary, 5번색 → accent (primary 매핑 색은 밝은 색 규칙을 만족하도록 프리셋 설계 시 배열). 파츠 카테고리별 특칙 없음. 한 번 누르면 총 전체가 통일된 룩으로 변신하는 순간이 M1 재미 포인트.

### 3.3 M1 색칠 인터랙션 — 화면 고정 존 버튼 (paint 스테이션)

색칠은 **paint 스테이션**(StationId 정본 = 06, 결정문 8)에서 한다. 3D 화면에서 존을 직접 클릭하는 방식은 **M2 로 강등** — 자동회전 중 클릭은 움직이는 과녁 맞추기이고, accent 존의 일부 메시(두께 0.004 파팅 띠)는 마우스로도 못 맞춘다. M1 은:

- **화면 고정 버튼 3개**: [본체색(primary)] [보조색(secondary)] [포인트색(accent)] — 각 44px 이상(데스크톱 우선이나 클릭 타겟 기준 유지 — 결정문 22, 터치 대응은 M2+), 아이콘은 **절차 SVG, 이모지 금지** (결정문 25). 현재 선택 파츠에 없는 존 버튼은 비활성.
- **존 위치 피드백**: 존 버튼 선택 시 해당 존 메시들이 0.5s 스케일 펄스(1.0→1.06→1.0, 2회) — "여기가 칠해질 곳"을 3D 가 직접 알려준다.
- **자동회전 정지**: 색칠 모드 진입 시 턴테이블 자동회전 정지(드래그 회전은 유지), 모드 종료 시 재개.
- 색 버튼(팔레트 6개) 탭 → 선택 존에 즉시 적용 + 색칠 펀치(§6). 파츠 선택은 우측 패널 카테고리 탭 리스트(가로 레이아웃 — 결정문 22) — 3D 피킹이 M1 에 하나도 필요 없다. 상세 UX 는 06.

### 3.4 패턴 — 텍스처 없는 줄무늬 (vertex color, M2)

전작 지면·나무와 같은 경로: `vertexColors: true` 흰색 머티리얼 + geometry `color` attribute 에 직접 칠한다(색은 PaletteKey→hex 해석 후 사용). 텍스처 파일·UV 작업 제로. §1.1 의 **길이축=Z 굽기 규약** 덕에 아래 코드의 `pos.getZ()` 밴딩이 의도대로 링(가락지) 방향 줄무늬가 된다.

```ts
// 배럴 base geometry: CylinderGeometry(r, r, L, 12, 8) 생성 직후 rotateX(Math.PI/2) 로 길이축=Z (§1.1)
function paintStripes(geo: THREE.BufferGeometry, a: THREE.Color, b: THREE.Color, bands: number) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox!;         // stripe 축 = 로컬 z (전방축)
  const bandLen = (max.z - min.z) / bands;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const band = Math.min(bands - 1, Math.floor((pos.getZ(i) - min.z) / bandLen));
    (band % 2 === 0 ? a : b).toArray(colors, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}
```

- 단색 존 = 캐시 머티리얼(§5) / 줄무늬 존만 vertex color. 밴드 경계가 세그먼트 격자를 따라 살짝 어긋나는 것은 수용 — 오히려 손으로 칠한 toon 느낌.
- **줄무늬는 boundingBox 기반이므로 morph 재빌드 때마다 재도색**한다 — `recomposeBlaster` 마지막 단계에 고정 (정본 = 09 §3.4).
- vertex color 머티리얼은 finish 별 **딱 3개**만 존재(색은 attribute 가 담당) → 패턴이 늘어도 머티리얼 수 불변.

## 4. 스티커/데칼 — **M2로 미룬다** (판단)

구현 자체는 텍스처 없이 가능하다: `THREE.Shape`(별·번개·하트·번호) → `ShapeGeometry` 를 얇은 평면으로 만들어 파츠 표면의 사전 정의 스티커 슬롯(위치+법선)에 부착, z-fighting 은 `polygonOffset: true, polygonOffsetFactor: -2` 로 해결. 색은 PaletteKey. 미루는 근거:

1. M1 가치사슬(조립→변형→색칠→사격)에 필수가 아니고, 슬롯 좌표를 파츠별 2~3면에 정의하는 작업량이 파츠 1카테고리 추가와 맞먹는다.
2. 곡면(실린더 배럴) 위 평면 스티커는 휘어 붙이는 보정 + **morph 재빌드 시 슬롯 좌표 추종**까지 필요 — M1 시간 예산 초과.
3. 세이브는 미지 필드 무시 로더(§7)이므로 M2 에 `PartInstance` 선택 필드로 추가해도 마이그레이션 불필요.

## 5. 공유 머티리얼 · 성능

**머티리얼 폭발 방지 = 캐시 상한 보장** (색|finish 캐시 방식이 색칠 구현의 정본 — 결정문 10):

```ts
const paintMatCache = new Map<string, THREE.MeshStandardMaterial>();
export function paintMaterial(color: PaletteKey, finish: Finish): THREE.MeshStandardMaterial {
  const key = `${color}|${finish}`;              // PaletteKey 기반 키 — 36키 고정이라 상한 보장
  let mat = paintMatCache.get(key);
  if (!mat) { mat = FINISH_FACTORY[finish](resolveHex(color)); paintMatCache.set(key, mat); }
  return mat;                                    // 절대 dispose 하지 않는다 — 상한이 있으므로
}
```

| 항목 | 수치 |
|---|---|
| 머티리얼 이론 상한 (03 소유) | 36키 × 3 finish = 108 + vertex color 3 + 고정(발광·투명창·안전팁 등) ~10 + 오버레이 1 ≈ **122** |
| 실제 동시 사용 (총 1자루, M1) | 파츠 ≤3(몸통+배럴+사이트) × 존 ≤3 → **≤9** (같은 색끼리 캐시 공유로 실제 더 적음) |
| draw call·메시·씬 예산 | **정본 = 07 단일표** (결정문 23): 블래스터 draw call ≤12 · 파츠당 메시 ≤6 · 씬 총 300. morph 는 메시 수·머티리얼 수·draw call 을 바꾸지 않으므로(지오메트리 attribute 만 교체 — 09 §3.5) 예산표에 morph 항목이 따로 없다 |
| geometry | **공유 규칙 개정 (09 §3.1)**: morph 대상 파츠(body·barrel)의 지오메트리는 **인스턴스 소유** — 재생성 시 이전 것을 즉시 dispose(`BuiltPart.dispose`). 비대상 파츠(sight 도트 등)만 종전대로 모듈 레벨 base geometry 공유. 줄무늬 존 clone 도 파츠 제거 시 dispose |

**호버 하이라이트의 공유 머티리얼 오염 함정** — `mesh.material.emissive` 직접 수정은 금지. 캐시된 머티리얼이라 같은 색을 쓴 **다른 파츠까지 같이 빛난다**. 해결: 오버레이 클론 그룹 방식(§6, M2). 색 변경도 `material.color.set()` 이 아니라 **캐시에서 새 머티리얼을 받아 교체**한다 (같은 이유). morph 재빌드 후 페인트 재적용도 같은 경로(캐시 조회 후 할당)라 추가 비용 0.

자유 RGB/색상환은 **금지 유지** (결정문 11) — 팔레트 키 36개 고정이 캐시 상한의 전제이므로, 구 "M2 자유 색상환" 확장 계획은 삭제한다.

## 6. 조립 화면 연출

| 연출 | 마일스톤 | 수치 사양 |
|---|---|---|
| 턴테이블 | M1 | **three/addons OrbitControls 정본** (결정문 24): autoRotate(유휴 자동회전, autoRotateSpeed 는 0.35 rad/s 상당) + enableDamping. **탭/드래그 판별(이동 8px 미만 = 탭)은 pointer 이벤트 레이어에서 병행 구현**. 색칠 모드·변형 슬라이더 드래그 중엔 autoRotate 정지 (§3.3, 09 §5) |
| 파츠 스냅 | M1 | 소켓 법선 바깥 0.25m 에서 시작 → 0.18s cubic ease-out 으로 소켓 도달 → 도착 프레임에 스케일 펀치 1.0→1.12→1.0 (0.12s) + "딸깍" SFX(절차 SFX — 사운드 섹션) |
| 탈착 | M1 | 역방향 0.12s + 살짝 위로 포물선. 빈 소켓 고스트 구(opacity 0.15↔0.45, 1.2s 주기 펄스)는 **부착 인터랙션 중에만** 표시 — 평시는 "빈 소켓 = 없는 소켓" (§1.3) |
| 존 펄스 | M1 | 존 버튼 선택 시 해당 존 메시들 스케일 펄스 1.0→1.06→1.0 ×2회, 0.5s (§3.3). **09 §5 가 변형 중인 파츠 표시에 동일 펄스를 재사용** |
| 색칠 적용 | M1 | 존에 새 머티리얼 교체와 동시에 해당 존 메시들만 스케일 펀치 1.0→1.06→1.0 (0.1s) — "칠해졌다"는 촉감 |
| 변형 슬라이더 연출 | M1 | **정본 = 09** (30Hz 재빌드·중앙 자석 스냅·펄스) — 03 은 존 펄스·카메라 연출 부품만 공급 |
| 카메라 | M1 | 파츠 카테고리 선택 시 해당 소켓 방향으로 카메라 타겟 15% lerp + 거리 0.9× 줌 (0.25s) — 09 §5 슬라이더 진입도 동일 연출 재사용 |
| 호버 셸 하이라이트 | **M2** | 대상 파츠의 메시들을 **clone 한 오버레이 Group** + 공유 `MeshBasicMaterial({ color: 0xffe066, transparent, opacity: 0.35, side: BackSide, depthWrite: false })` 1개. 각 clone 메시의 위치·회전 유지 + **개별 scale ×1.06** (지오메트리 원점 센터 규약 §1.1 이 전제). 호버 대상 변경 시 그룹 rebuild — 조립 화면 전용이라 핫패스 아님. 머티리얼 추가 비용 1개 고정 유지 |

턴테이블·스냅은 조립 화면 전용 루프라 핫패스가 아니다 — 프레임당 할당 금지 규칙은 사격 시뮬레이션 루프에 적용(상세는 시뮬레이션 섹션). morph 재빌드도 pointer 이벤트 경로에서만 발생한다 (09 §3.2).

## 7. 저장되는 시각 데이터 직렬화 (M1 필수)

조립 데이터는 **단일 타입 `Blaster` 로 확정** (결정문 12) — 구조 정본 = 02, **시각 필드(paint)** = 03(이 절), **morph** = 09 §6, **세이브 루트·프로필 키 구조** = 05 SavedGame (결정문 13, localStorage 접두사 `blaster_lab_` — 결정문 1). 원칙: **시각 상태는 전부 순수 데이터, 렌더 객체 참조 제로. `buildBlaster(blaster)` 하나로 언제나 재구성 가능** (조립 화면·1인칭 견착·미리보기 썸네일이 같은 팩토리 공유 — 전작에서 1인칭/거울 아바타가 weaponVisuals 를 공유한 패턴이고, "공방에서 늘인 총이 사격장에서 원래대로" 배신을 구조적으로 차단하는 09 §3.1 원칙과 동일).

```ts
interface Blaster {
  id: string; name: string; createdAt: number;
  parts: Partial<Record<SlotType, PartInstance>>;  // body 만 필수 (결정문 16). SlotType 정본 = 02
}
interface PartInstance {
  partId: string;
  paint: PartPaint;      // 03 소유 — 3존 PaletteKey (§3.1)
  morph: MorphState;     // 09 소유 — 0..1 정규값, 기본값(0.5) 키는 저장 생략
}
```

저장 JSON 예시 (M1 슬롯 구성):

```json
{ "id": "b1", "name": "번개팝콘", "createdAt": 1789000000000,
  "parts": {
    "body":   { "partId": "body_popcorn", "morph": { "bodyLength": 0.8, "bodyChub": 0.3 },
                "paint": { "primary": { "color": "pastel_4", "finish": "gloss" },
                           "accent":  { "color": "neon_2",   "finish": "matte" } } },
    "barrel": { "partId": "barrel_rail", "morph": { "barrelLength": 1 },
                "paint": { "primary": { "color": "racing_3", "finish": "matte" } } },
    "sight":  { "partId": "sight_dot", "morph": {},
                "paint": { "primary": { "color": "neon_3", "finish": "gloss" } } } } }
```

**M1 저장 사양** (첫 플레이어블에서 새로고침 = 작품 증발은 초등학생에게 최악의 첫인상):

- `SAVE_VERSION: 1` 부터 **morph 포함** (결정문 13) + localStorage — 키 구조·백업 키 복원은 05 정본.
- **자동저장 = 06 정본** (결정문 14): 저장 버튼 소거, 06 의 4트리거(파츠 변경·색칠·변형 pointerup·스테이션 이탈)가 flush. 별도 저장 버튼 없이도 작품이 절대 사라지지 않는다.
- 미장착 슬롯은 Record 에 없음(빈 슬롯 = 기본 상태). 알 수 없는 `partId` 를 만나면 해당 파츠만 조용히 스킵하고 나머지 렌더 — 파츠 삭제·개명에도 세이브 전체가 죽지 않는다.
- 로드 폴백 3종: `paint` 누락 존 → 파츠 기본색 / 존재하지 않는 PaletteKey → 08 폴백 키 (§3.1) / morph 이상값·미지 키 → 09 §6 표 (전부 무소음 복구).

## 8. 마일스톤 범위 확정 + verify 게이트

**M1**:
- 파츠 5종 + 맨몸 (결정문 21): 바디 2(`body_popcorn`·`body_bulldog`) + 배럴 2(`barrel_snap`·`barrel_rail`) + 사이트 1(`sight_dot`) — 로스터 정본 = 02 §3. 소켓 규약(§1.3 — grip·stock·mag 소켓은 정의만 하고 비움)
- **morph 지원 빌더** — `buildPart(partId, opts)` 확장 시그니처·anchors 반환·인스턴스 지오메트리 소유(§3.1·§5). 파라미터·재생성 스로틀·슬라이더 UX 의 정본 = 09
- 머티리얼 팩토리 4종(§2.1) + **RoomEnvironment 환경맵 부팅 배선** (배선 실패 시 metal finish 만 M2 이월)
- 존 색칠(§3.1) + 팔레트 6프리셋 + primary 밝은 색 필터(§3.2) + **화면 고정 존 버튼 인터랙션(§3.3, paint 스테이션)**
- 머티리얼 캐시(§5), OrbitControls 턴테이블·스냅·존 펄스·색칠 펀치(§6)
- **직렬화 시각 필드 + 로드 폴백(§7)** — 세이브 루트·자동저장 배선은 05·06 정본

**M2**: 줄무늬(§3.4), 스티커(§4), 총구 액세서리(배럴 끝 앵커 승계 — 09 §3.3), grip·stock·mag("다트 팩") 파츠, 3D 존 직접 클릭, 호버 셸 하이라이트(§6), 터치 대응. (구 "자유 색상환" 항목은 결정문 11 로 삭제 — 팔레트 키 고정 유지.)

**verify 게이트 테스트 5종** (typecheck·크기 ratchet 에 추가):

| # | 테스트 | 잡는 실수 |
|---|---|---|
| 1 | `countMeshes(buildPart(id, opts).group) <= 6` — 전 파츠, **극단 morph(t=0/1) 포함** (09 §3.5) | 메시 폭발 |
| 2 | `zones.primary` 존재 + 메시 ≥1 (전 파츠, 재빌드 후 재검사) | 존 매핑 누락 → 색칠 불능 파츠 |
| 3 | partId·displayName·UI 문자열·morph 라벨 금칙어 스캔 — **리스트 정본 = 08 §3.1** | 실총 용어 유입 |
| 4 | 파츠별 boundingBox — **기본형(t=0.5) 예상 치수 ±10%** (극단 치수는 09 봉투 교차표·속성 테스트 소유) | 회전축·스케일 실수 |
| 5 | playwright: toyMetal vs toyMatte 렌더 픽셀 분산 차 > 임계값 | 환경맵 배선 유실(no-op 재발) |

## 9. 09 발신 개정 요청 처리 (수용 내역)

| 요청 (09 §7) | 처리 |
|---|---|
| 롱 레일 기준 치수 0.42/0.035 → **0.40/0.038** | §1.2 표 반영 완료 |
| 합성 전장 쿼터 0.98m → **1.10m** | §1.1 반영 완료 (기본형 0.55~0.95m + morph 극단 상한 1.10m) |

## 열린 질문

1. **"숲속 소풍" 프리셋 색 확정** — 구 "정글 위장" 대체안의 6색은 예시안. 비군사·밝음 조건만 지키면 아들 취향 반영 교체 가능(팔레트 키 유지 시 세이브 영향 0, 키 교체 시 08 폴백 규칙 적용).
2. ~~표시명 확정 방식~~ → 결정문 7 로 해소(02 한글명 유지 + 아들 네이밍 세션 교체 가능 명기). ~~저장 버튼 병행 여부~~ → 결정문 14 로 해소(06 자동저장 정본, 버튼 소거).
