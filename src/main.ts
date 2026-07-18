// src/main.ts — 지휘자(conductor): 씬 부팅·루프·입력·스테이션 배선만. 신규 로직은 game/·ui/ 로.
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { Blaster, MorphKey, MorphState, PartPaint, SlotType } from './game/types.ts'
import { computeStats, partsForSlot } from './game/parts.ts'
import { boreScaleFromMorph, archetypeForSlot, barrelCountFromMorph } from './game/morph.ts'
import { ALL_PALETTE_KEYS, isBright } from './game/palette.ts'
import {
  toShotProfile,
  PROJECTILE_GRAVITY,
  recoveryDegPerSec,
  RECOIL_MAX_DEG,
} from './game/ballistics.ts'
import { buildBlaster, type BuiltBlaster } from './game/assembly.ts'
import { installEnvironment } from './game/materials.ts'
import { RangeController } from './game/range.ts'
import {
  loadSave,
  persistSave,
  makeInstance,
  createStarterBlaster,
  cloneBlaster,
  exportSaveText,
  importInto,
  type SavedGame,
} from './game/save.ts'
import { resumeAudio, sfx, setAudioEnabled } from './game/audio.ts'
import { MORPH_PARAMS } from './game/morph.ts'
import { PRESETS, PRESET_ZONE_ORDER } from './game/presets.ts'

import { createStationBar, type StationId } from './ui/stationBar.ts'
import { createWorkshopPanel } from './ui/workshopPanel.ts'
import { createPaintPanel } from './ui/paintPanel.ts'
import { createRangeHud, MAG_OPTIONS } from './ui/rangeHud.ts'
import type { AimMode, AimSel } from './ui/rangeHud.ts'
import { createRotateControl } from './ui/rotateControl.ts'
import { createCollectionPanel } from './ui/collectionPanel.ts'

// ─── DOM ────────────────────────────────────────────────────
const app = document.getElementById('app')!
const canvasHost = el('div', 'canvas-host')
const barHost = el('div', 'bar-host')
const panelHost = el('div', 'panel-host')
const hudHost = el('div', 'hud-host')
app.append(canvasHost, barHost, panelHost, hudHost)

// 공방 3D 뷰 위 회전 속도 컨트롤 오버레이
const editOverlay = el('div', 'edit-overlay')
canvasHost.appendChild(editOverlay)

// 공방·꾸미기·보관함 패널은 각자 전용 루트에 렌더 — 전환 시 display 토글
const wsRoot = el('div', 'panel-root')
const paintRoot = el('div', 'panel-root')
const collectionRoot = el('div', 'panel-root')
panelHost.append(wsRoot, paintRoot, collectionRoot)

// ─── 렌더러·씬·카메라 ───────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.02
canvasHost.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xdff1ff)
installEnvironment(renderer, scene)

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200)

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b7a63, 0.9)
scene.add(hemi)
const key = new THREE.DirectionalLight(0xffffff, 1.1)
key.position.set(2, 4, 2)
scene.add(key)
const fill = new THREE.DirectionalLight(0xfff0e0, 0.4)
fill.position.set(-2, 1, 1)
scene.add(fill)

// 편집(공방·꾸미기) 턴테이블 루트
const editRoot = new THREE.Group()
scene.add(editRoot)

// 사격장
const range = new RangeController()
range.group.visible = false
scene.add(range.group)

// 사격장 뷰모델 (카메라에 부착 — 내가 만든 총 상시 노출, 04 §8)
const viewmodel = new THREE.Group()
viewmodel.position.set(0.14, -0.16, -0.42)
// 블래스터 로컬 -Z(총구) = 카메라 전방(-Z) 이므로 회전 불필요 (y=π 면 총구가 뷰어를 향함)
camera.add(viewmodel)
scene.add(camera)

// OrbitControls (편집 턴테이블 — 결정문 24)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.enablePan = false
controls.minDistance = 0.5
controls.maxDistance = 2.5
const BASE_AUTOROTATE = 1.6 // 1x 기준 속도
let rotateSpeedMul = 1
controls.autoRotateSpeed = BASE_AUTOROTATE

/** 회전판 자동회전 적용 — 편집 모드 + 속도 배율 > 0 일 때만 돈다. */
function applyRotation(editMode: boolean): void {
  controls.autoRotate = editMode && rotateSpeedMul > 0
  controls.autoRotateSpeed = BASE_AUTOROTATE * rotateSpeedMul
}

// ─── 상태 ───────────────────────────────────────────────────
let save: SavedGame = loadSave(Date.now())
let active: Blaster = pickActive(save)
let station: StationId = 'workshop'
let booted = false
let editBuilt: BuiltBlaster | null = null
let vmBuilt: BuiltBlaster | null = null
const undoStack: PartsSnapshot[] = []
// paint 포함 — 파츠 제거 후 되돌리기 시 색칠이 기본색으로 리셋되던 버그(QA) 방지.
// (기존 파츠가 살아있는 분기는 현재 paint 를 유지 = "색칠은 undo 대상 아님" 규칙 그대로)
type PartsSnapshot = Partial<
  Record<SlotType, { partId: string; morph: MorphState; paint: PartPaint }>
>

function clonePaint(p: PartPaint): PartPaint {
  const out: PartPaint = {}
  for (const zone of ['primary', 'secondary', 'accent'] as const) {
    const zp = p[zone]
    if (zp) out[zone] = { color: zp.color, finish: zp.finish }
  }
  return out
}

function pickActive(s: SavedGame): Blaster {
  return s.blasters.find((b) => b.id === s.activeBlasterId) ?? s.blasters[0]!
}

// ─── UI 배선 ────────────────────────────────────────────────
const stationBar = createStationBar(barHost, {
  onStation: (id) => setStation(id),
  onUndo: () => doUndo(),
})

const workshopPanel = createWorkshopPanel(wsRoot, {
  onSelectPart: (slot, partId) => selectPart(slot, partId),
  onMorphInput: (slot, k, t) => morphInput(slot, k, t),
  onMorphCommit: (slot, k, t) => morphCommit(slot, k, t),
  onRandomize: (slot) => randomizeSlot(slot),
  onRandomizeAll: () => randomizeAll(),
  onGoRange: () => setStation('range'),
})

let paintPanel: ReturnType<typeof createPaintPanel> | null = null
const rangeHud = createRangeHud(hudHost, {
  onBack: () => finishRange(),
  onRetry: () => retryRange(),
  onExit: () => setStation('workshop'),
  onSelectMag: (mag) => selectMag(mag),
})

const rotateControl = createRotateControl(editOverlay, {
  onSelect: (mul) => {
    rotateSpeedMul = mul
    applyRotation(station !== 'range')
    rotateControl.setActive(mul)
  },
})
rotateControl.setActive(1)

const collectionPanel = createCollectionPanel(collectionRoot, {
  onNew: () => newBlaster(),
  onOpen: (id) => openBlaster(id, 'workshop'),
  onDuplicate: (id) => duplicateBlaster(id),
  onRename: (id, name) => renameBlaster(id, name),
  onDelete: (id) => deleteBlaster(id),
  onExport: () => exportBackup(),
  onImportFile: (file) => importBackup(file),
})

// ─── 편집 뷰 재빌드 ─────────────────────────────────────────
function rebuildEdit(lod?: 'drag' | 'full'): void {
  if (editBuilt) {
    editRoot.remove(editBuilt.group)
    editBuilt.dispose()
  }
  editBuilt = buildBlaster(active, lod)
  editRoot.add(editBuilt.group)
}

function rebuildViewmodel(): void {
  if (vmBuilt) {
    viewmodel.remove(vmBuilt.group)
    vmBuilt.dispose()
  }
  vmBuilt = buildBlaster(active, 'full')
  viewmodel.add(vmBuilt.group)
}

function refreshPanels(): void {
  const stats = computeStats(active)
  workshopPanel.setBlaster(active, stats)
  paintPanel?.setBlaster(active)
  collectionPanel.setData(save.blasters, active.id)
  stationBar.setName(active.name)
  stationBar.setCanUndo(undoStack.length > 0)
}

// ─── 스테이션 전환 ─────────────────────────────────────────
function setStation(id: StationId): void {
  // 이미 그 스테이션이면 no-op — 사격 중 '쏘기' 재탭이 라운드를 조용히 리셋하던 버그 수정.
  // (라운드 재시작은 결과 카드의 "한 번 더"로만)
  if (booted && id === station) return
  booted = true
  station = id
  morphGesture = null // 스테이션 전환 — 진행 중 제스처 스냅샷 폐기
  stationBar.setActive(id)
  autosave()

  const editMode = id === 'workshop' || id === 'paint' || id === 'collection'
  app.classList.toggle('range-mode', id === 'range')
  editRoot.visible = editMode
  range.group.visible = id === 'range'
  viewmodel.visible = id === 'range'
  controls.enabled = editMode
  applyRotation(editMode)
  editOverlay.style.display = editMode ? '' : 'none'

  panelHost.style.display = editMode ? '' : 'none'
  hudHost.style.display = id === 'range' ? '' : 'none'

  if (editMode) {
    aimMode = 'none'
    camera.fov = BASE_FOV
    camera.updateProjectionMatrix()
    camera.position.set(0.55, 0.34, 0.9)
    controls.target.set(0, 0.02, -0.05)
    controls.update()
    if (id === 'paint' && !paintPanel) {
      paintPanel = createPaintPanel(paintRoot, {
        onSelectPaintPart: () => {},
        onPickColor: (slot, zone, color) => pickColor(slot, zone, color),
        onPickFinish: (slot, zone, finish) => pickFinish(slot, zone, finish),
        onApplyPreset: (i) => applyPreset(i),
      })
    }
    wsRoot.style.display = id === 'workshop' ? '' : 'none'
    paintRoot.style.display = id === 'paint' ? '' : 'none'
    collectionRoot.style.display = id === 'collection' ? '' : 'none'
    rebuildEdit('full')
    refreshPanels()
  } else {
    enterRange()
  }
}

// ─── 보관함 (저장/불러오기) ─────────────────────────────────
function nextBlasterName(): string {
  let max = 0
  for (const b of save.blasters) {
    const m = b.name.match(/블래스터 (\d+)/)
    if (m && m[1]) max = Math.max(max, parseInt(m[1], 10))
  }
  return `블래스터 ${max + 1}`
}

function newBlaster(): void {
  const b = createStarterBlaster(Date.now(), nextBlasterName())
  save.blasters.push(b)
  openBlaster(b.id, 'workshop')
}

function openBlaster(id: string, goto?: StationId): void {
  const b = save.blasters.find((x) => x.id === id)
  if (!b) return
  // 같은 블래스터를 다시 여는 건(활성 카드의 "만들기") 전환이 아니다 —
  // undo 스택을 소거하지 않는다(스테이션 탭으로 가는 경로와 동작 일치)
  if (b.id !== active.id) {
    active = b
    save.activeBlasterId = id
    undoStack.length = 0
    morphGesture = null // 블래스터 전환 — 이전 gesture 스냅샷 폐기
  }
  sfx.click()
  autosave()
  if (goto) {
    setStation(goto)
  } else {
    rebuildEdit('full')
    refreshPanels()
  }
}

function duplicateBlaster(id: string): void {
  const src = save.blasters.find((x) => x.id === id)
  if (!src) return
  const copy = cloneBlaster(src, Date.now())
  save.blasters.push(copy)
  active = copy
  save.activeBlasterId = copy.id
  undoStack.length = 0
  morphGesture = null
  sfx.snap()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

function renameBlaster(id: string, name: string): void {
  const b = save.blasters.find((x) => x.id === id)
  if (!b) return
  b.name = name
  if (b.id === active.id) stationBar.setName(name)
  // refreshPanels() 호출 안 함 — rename 은 이름 커밋(blur) 중 발생하므로 목록을 통째로
  // 재생성하면 뒤이은 click 대상 노드가 사라져 첫 클릭이 삼켜진다(QA 확정). 이름은 이미
  // input 에 반영돼 있고 카드 스탯·스와치는 이름과 무관하다.
  autosave()
}

function exportBackup(): void {
  const text = exportSaveText(save)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `블래스터_공방_백업_${save.blasters.length}개.json`
  a.click()
  URL.revokeObjectURL(url)
  sfx.star()
  showToast(`백업 파일을 저장했어요 (블래스터 ${save.blasters.length}개)`)
}

function importBackup(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    const text = typeof reader.result === 'string' ? reader.result : ''
    const res = importInto(save, text, Date.now())
    if (!res) {
      showToast('백업 파일을 읽지 못했어요')
      return
    }
    persistSave(save)
    refreshPanels()
    sfx.star()
    showToast(res.added > 0 ? `블래스터 ${res.added}개를 불러왔어요!` : '이미 다 있는 블래스터예요')
  }
  reader.onerror = () => showToast('파일을 여는 데 실패했어요')
  reader.readAsText(file)
}

function deleteBlaster(id: string): void {
  if (save.blasters.length <= 1) return
  const idx = save.blasters.findIndex((x) => x.id === id)
  if (idx < 0) return
  const wasActive = active.id === id
  save.blasters.splice(idx, 1)
  if (wasActive) {
    active = save.blasters[0]!
    save.activeBlasterId = active.id
    undoStack.length = 0
    morphGesture = null
    rebuildEdit('full')
  }
  sfx.click()
  refreshPanels()
  autosave()
}

// ─── 파츠 선택 ─────────────────────────────────────────────
function selectPart(slot: SlotType, partId: string | null): void {
  const prev = active.parts[slot]
  // 변화 없으면 무시 — 같은 파츠 재선택으로 morph 를 지우거나 빈 undo 를 쌓지 않는다
  if (partId === null && !prev) return
  if (partId !== null && prev?.partId === partId) return
  morphGesture = null // 중단된 슬라이더 제스처가 이 변경까지 묶어 되감지 않게
  pushUndo()
  if (partId === null) {
    if (slot !== 'body') delete active.parts[slot]
  } else {
    const inst = makeInstance(partId)
    if (prev) inst.paint = prev.paint // 페인트 보존
    active.parts[slot] = inst
  }
  sfx.snap()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

// ─── 자유 변형 ─────────────────────────────────────────────
let morphGesture: PartsSnapshot | null = null
let lastMorphSfx = 0
let morphDirty = false // 드래그 중 재빌드를 프레임당 1회로 코얼레싱

function morphInput(slot: SlotType, key: MorphKey, t: number): void {
  const inst = active.parts[slot]
  if (!inst) return
  if (!morphGesture) morphGesture = captureSnapshot()
  inst.morph = { ...inst.morph, [key]: t }
  // 재빌드는 프레임당 1회로 코얼레싱 — input 이벤트마다 전체 지오메트리를
  // 재생성하면(초당 수십 회 × 12~20 BufferGeometry) 저사양에서 GC 스터터.
  morphDirty = true
  workshopPanel.updateStats(computeStats(active))
  const now = performance.now()
  if (now - lastMorphSfx > 80) {
    sfx.morph(t)
    lastMorphSfx = now
  }
}

function morphCommit(slot: SlotType, key: MorphKey, t: number): void {
  const inst = active.parts[slot]
  if (!inst) return
  inst.morph = { ...inst.morph, [key]: t }
  morphDirty = false // 아래 full 재빌드가 대신한다
  if (morphGesture) {
    undoStack.push(morphGesture)
    trimUndo()
    morphGesture = null
  }
  sfx.snap()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

function randomMorphFor(arche: string): MorphState {
  const m: MorphState = {}
  for (const p of MORPH_PARAMS) {
    if (p.archetype !== arche) continue
    // 장식은 절반 확률로만 켠다 — 늘 만땅이면 다양성이 오히려 죽는다
    if (p.group === 'deco' && Math.random() < 0.5) continue
    m[p.key] = 0.1 + Math.random() * 0.8
  }
  return m
}

function randomizeSlot(slot: SlotType): void {
  const inst = active.parts[slot]
  if (!inst) return
  const arche = archetypeForSlot(slot)
  if (!arche) return // 가드를 pushUndo 앞으로 — 빈 undo 엔트리 방지
  morphGesture = null
  pushUndo()
  inst.morph = randomMorphFor(arche)
  sfx.snap()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/** 완전 랜덤 — 파츠·모양·장식·색까지 전부 새로 뽑는다. */
function randomizeAll(): void {
  morphGesture = null
  pushUndo()
  const brightKeys = ALL_PALETTE_KEYS.filter(isBright)
  const randomPaint = (): PartPaint => ({
    primary: { color: pick(brightKeys), finish: pick(FINISHES) },
    secondary: { color: pick(ALL_PALETTE_KEYS), finish: pick(FINISHES) },
    accent: { color: pick(ALL_PALETTE_KEYS), finish: pick(FINISHES) },
  })
  const next: Blaster['parts'] = {}
  // 몸통은 필수, 나머지는 확률적으로 (없는 것도 하나의 변형)
  const bodyId = pick(partsForSlot('body')).id
  next.body = { partId: bodyId, paint: randomPaint(), morph: randomMorphFor('body') }
  for (const slot of ['barrel', 'sight', 'grip', 'stock', 'muzzle'] as SlotType[]) {
    const opts = partsForSlot(slot)
    if (opts.length === 0) continue
    if (Math.random() < 0.22) continue // 가끔은 비워 둔다
    next[slot] = {
      partId: pick(opts).id,
      paint: randomPaint(),
      morph: randomMorphFor(archetypeForSlot(slot) ?? 'body'),
    }
  }
  active.parts = next
  sfx.snap()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

// ─── 색칠 ──────────────────────────────────────────────────
function pickColor(slot: SlotType, zone: 'primary' | 'secondary' | 'accent', color: import('./game/palette.ts').PaletteKey): void {
  const inst = active.parts[slot]
  if (!inst) return
  const finish = inst.paint[zone]?.finish ?? 'gloss'
  inst.paint[zone] = { color, finish }
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active)
  autosave()
}

function pickFinish(slot: SlotType, zone: 'primary' | 'secondary' | 'accent', finish: 'matte' | 'gloss' | 'metal'): void {
  const inst = active.parts[slot]
  if (!inst) return
  const color = inst.paint[zone]?.color ?? 'blasterBlue'
  inst.paint[zone] = { color, finish }
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active)
  autosave()
}

function applyPreset(index: number): void {
  const preset = PRESETS[index]
  if (!preset) return
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    const inst = active.parts[slot]
    if (!inst) continue
    PRESET_ZONE_ORDER.forEach((zone, ki) => {
      const cur = inst.paint[zone]
      if (cur) inst.paint[zone] = { color: preset.keys[ki]!, finish: cur.finish }
    })
  }
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active)
  autosave()
}

// ─── Undo (조립+변형 통합 — 결정문 15) ───────────────────────
function captureSnapshot(): PartsSnapshot {
  const snap: PartsSnapshot = {}
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    const inst = active.parts[slot]
    if (inst) {
      snap[slot] = {
        partId: inst.partId,
        morph: { ...inst.morph },
        paint: clonePaint(inst.paint), // 제거→undo 시 색 복원용
      }
    }
  }
  return snap
}

function pushUndo(): void {
  undoStack.push(captureSnapshot())
  trimUndo()
}

function trimUndo(): void {
  while (undoStack.length > 30) undoStack.shift()
}

function doUndo(): void {
  const snap = undoStack.pop()
  if (!snap) return
  morphGesture = null // 진행 중 제스처 스냅샷 폐기(오염 방지)
  const nextSlots = new Set(Object.keys(snap) as SlotType[])
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    if (!nextSlots.has(slot) && slot !== 'body') delete active.parts[slot]
  }
  for (const slot of nextSlots) {
    const s = snap[slot]!
    const cur = active.parts[slot]
    if (cur) {
      // 살아있는 파츠: paint 는 현재값 보존 (결정문 15 — 색칠은 undo 대상 아님)
      cur.partId = s.partId
      cur.morph = { ...s.morph }
    } else {
      // 제거됐던 파츠 복원: 스냅샷의 paint 를 되살린다 (기본색 리셋 버그 수정)
      const inst = makeInstance(s.partId, s.morph)
      inst.paint = clonePaint(s.paint)
      active.parts[slot] = inst
    }
  }
  sfx.click()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

// ─── 사격장 ────────────────────────────────────────────────
let aimYaw = 0
let aimPitch = 0
let recoilPitch = 0
let totalHits = 0 // 풍선 + 과녁 (과녁 명중이 0 반영되던 버그 수정)
let shotsFired = 0
let guideSpeed = 30
let guideGravity = 4
let recoilRecovery = (8 * Math.PI) / 180 // rad/s — enterRange 에서 총별로 캐시
const RECOIL_MAX_RAD = (RECOIL_MAX_DEG * Math.PI) / 180
const _gDir = new THREE.Vector3()
const _gOrigin = new THREE.Vector3()
const FINISHES: readonly ('matte' | 'gloss' | 'metal')[] = ['matte', 'gloss', 'metal']
const COURSE_ID = 'balloon_yard'
// 00_DECISIONS: ★1=완주(1발+), ★2=명중 6+, ★3=명중 9 (아이 친화 — 결과는 항상 플러스)
const STAR_CUTS: [number, number, number] = [1, 6, 9]

// ─── 조준 모드: 일반 · 레드도트(저배율) · 망원 스코프(4~15배) ──
const BASE_FOV = 45
const ZOOM_MIN = 4
const ZOOM_MAX = 15
const REDDOT_MAG = 1.5 // 레드도트 저배율 — "배율은 높지 않지만" 빨간 점 조준
let aimMode: AimMode = 'none'
let zoom = ZOOM_MIN

/** 배율 z 에 대한 광학적 FOV(도). z=1 이면 BASE_FOV. */
function fovForZoom(z: number): number {
  const half = (BASE_FOV / 2) * (Math.PI / 180)
  return (2 * Math.atan(Math.tan(half) / z) * 180) / Math.PI
}

function currentMag(): number {
  return aimMode === 'scope' ? zoom : aimMode === 'reddot' ? REDDOT_MAG : 1
}

function applyView(): void {
  camera.fov = fovForZoom(currentMag())
  camera.updateProjectionMatrix()
}

/** 조준 선택 — null=일반 · 'reddot'=레드도트 · 4~15=망원 스코프. */
function selectMag(sel: AimSel): void {
  if (sel === null) {
    aimMode = 'none'
  } else if (sel === 'reddot') {
    aimMode = 'reddot'
  } else {
    aimMode = 'scope'
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(sel)))
  }
  applyView()
  rangeHud.setMagSelection(aimMode, zoom)
  sfx.click()
}

// 휠 편의 — 선택지(일반→레드도트→4…15배)를 한 칸씩 이동
const AIM_ORDER: AimSel[] = [null, 'reddot', ...MAG_OPTIONS]
function stepMag(delta: number): void {
  const cur: AimSel = aimMode === 'none' ? null : aimMode === 'reddot' ? 'reddot' : zoom
  let i = AIM_ORDER.findIndex((s) => s === cur)
  if (i < 0) i = 0
  i = Math.max(0, Math.min(AIM_ORDER.length - 1, i + delta))
  selectMag(AIM_ORDER[i] ?? null)
}

range.onHit = (e) => {
  // 풍선·과녁 모두 명중으로 센다 (과녁만 맞히면 "맞힌 개수 0" 이던 버그 수정)
  totalHits += 1
  rangeHud.setHits(totalHits)
  sfx.pop()
  const sp = worldToScreen(e.x, e.y, e.z)
  if (sp) rangeHud.popNumber(e.points, sp.x, sp.y)
}

function enterRange(): void {
  panelHost.style.display = 'none'
  hudHost.style.display = ''
  totalHits = 0
  shotsFired = 0
  range.reset()
  rangeHud.setHits(0)
  rangeHud.hideResult()
  aimYaw = 0
  aimPitch = 0
  recoilPitch = 0
  aimMode = 'none'
  zoom = ZOOM_MIN
  applyView()
  rangeHud.setMagSelection('none', zoom)
  camera.position.set(0, 1.5, 0.2)
  composeAim()
  rebuildViewmodel()
  stationBar.setCanUndo(false) // 사격 중 되돌리기 잠금 — 뷰모델·스프레드 미갱신 불일치 방지
  const stats = computeStats(active)
  const bore = boreScaleFromMorph(active.parts.barrel?.morph ?? {})
  const profile = toShotProfile(stats, bore)
  rangeHud.setSpread(profile.spreadDeg)
  guideSpeed = profile.muzzleVelocity
  guideGravity = PROJECTILE_GRAVITY[profile.kind]
  // 설계 복귀율(8~14°/s)을 실제로 배선 — 하드코딩 126°/s 라 반동이 안 보이던 버그 수정
  recoilRecovery = (recoveryDegPerSec(profile) * Math.PI) / 180
}

const _aimEuler = new THREE.Euler(0, 0, 0, 'YXZ')
function composeAim(): void {
  _aimEuler.set(aimPitch + recoilPitch, aimYaw, 0, 'YXZ')
  camera.quaternion.setFromEuler(_aimEuler)
}

const _fireRight = new THREE.Vector3()
const _fireUp = new THREE.Vector3()
const _fireDir = new THREE.Vector3()
function fire(): void {
  const stats = computeStats(active)
  const bore = boreScaleFromMorph(active.parts.barrel?.morph ?? {})
  const profile = toShotProfile(stats, bore)
  const count = barrelCountFromMorph(active.parts.barrel?.morph ?? {})
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  const origin = camera.position.clone().addScaledVector(dir, 0.5)
  // 총열 수만큼 발사 — 더블배럴 2발·미니건 6발. 좌우로 살짝 퍼뜨려 여러 개가 보이게
  _fireRight.crossVectors(dir, camera.up).normalize()
  _fireUp.crossVectors(_fireRight, dir).normalize()
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 // -1..1
    const fan = 0.03 // 퍼짐 반경(rad)
    _fireDir
      .copy(dir)
      .addScaledVector(_fireRight, off * fan)
      .addScaledVector(_fireUp, (count > 2 ? Math.sin(i) * 0.4 : 0) * fan)
      .normalize()
    range.fireOne(profile, origin, _fireDir)
  }
  shotsFired += 1
  // 누적 상한 클램프 (설계 RECOIL_MAX_DEG) — 느린 복귀와 짝. 다발이면 반동 약간↑(상한 내)
  recoilPitch = Math.min(
    recoilPitch + (profile.recoilKickDeg * Math.PI * (1 + (count - 1) * 0.15)) / 180,
    RECOIL_MAX_RAD,
  )
  sfx.shoot()
}

function finishRange(): void {
  const stars = starsFor(totalHits)
  updateCourseRecord(stars)
  // 한 발이라도 쐈으면 항상 결과 카드 — 0명중이어도 격려("다시 해볼까요?").
  // 아예 안 쏘고 나가면 모달 없이 바로 공방(불필요한 마찰 제거).
  if (shotsFired > 0) {
    if (stars > 0) sfx.star()
    rangeHud.showResult(stars, totalHits)
  } else {
    setStation('workshop')
  }
}

function retryRange(): void {
  totalHits = 0
  shotsFired = 0
  range.reset()
  rangeHud.setHits(0)
}

function starsFor(hits: number): 0 | 1 | 2 | 3 {
  if (hits >= STAR_CUTS[2]) return 3
  if (hits >= STAR_CUTS[1]) return 2
  if (hits >= STAR_CUTS[0]) return 1
  return 0
}

function updateCourseRecord(stars: 0 | 1 | 2 | 3): void {
  const prev = save.courseRecords[COURSE_ID]
  const best = Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3
  save.courseRecords[COURSE_ID] = {
    stars: best,
    bestScore: Math.max(prev?.bestScore ?? 0, totalHits),
    bestBlasterId: active.id,
  }
  autosave()
}

// ─── 사격장 포인터 (드래그=조준, 탭=발사; 8px 판별 — 결정문 24) ─
let pointerDown = false
let downX = 0
let downY = 0
let lastX = 0
let lastY = 0
let moved = 0
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (station !== 'range') return
  if (ev.button !== 0) return // 우클릭(조준경 토글)·중클릭이 발사로 새지 않게
  pointerDown = true
  downX = ev.clientX
  downY = ev.clientY
  lastX = ev.clientX
  lastY = ev.clientY
  moved = 0
})
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (station !== 'range' || !pointerDown) return
  const dx = ev.clientX - downX
  const dy = ev.clientY - downY
  moved = Math.max(moved, Math.hypot(dx, dy))
  // 조준 배율만큼 감도를 낮춰 정밀 조준 (fov 비례 — 일반 1.0, 레드도트 약간, 스코프 크게)
  const sens = 0.0032 * (fovForZoom(currentMag()) / BASE_FOV)
  // movementX 미제공 브라우저(일부 터치)를 위해 client 델타 폴백 — 마우스도 동일 결과
  const mx = ev.movementX || ev.clientX - lastX
  const my = ev.movementY || ev.clientY - lastY
  lastX = ev.clientX
  lastY = ev.clientY
  aimYaw -= mx * sens
  aimPitch -= my * sens
  aimPitch = Math.max(-0.5, Math.min(0.45, aimPitch))
  composeAim()
})
window.addEventListener('pointerup', () => {
  if (station !== 'range' || !pointerDown) return
  pointerDown = false
  if (moved < 8) fire()
})
// 휠 = 조준 선택지 한 칸씩 이동, 우클릭 = 레드도트 빠른 조준 켜기/끄기
renderer.domElement.addEventListener(
  'wheel',
  (ev) => {
    if (station !== 'range') return
    ev.preventDefault()
    stepMag(ev.deltaY < 0 ? 1 : -1)
  },
  { passive: false },
)
renderer.domElement.addEventListener('contextmenu', (ev) => {
  if (station !== 'range') return
  ev.preventDefault()
  selectMag(aimMode === 'none' ? 'reddot' : null)
})

// ─── 루프 ──────────────────────────────────────────────────
let lastT = performance.now()
let frameCount = 0
function tick(): void {
  frameCount += 1
  const now = performance.now()
  const dt = Math.min(0.05, (now - lastT) / 1000)
  lastT = now
  if (station === 'range') {
    if (recoilPitch > 0) {
      // 설계 복귀율(8~14°/s) — 하드코딩 2.2rad/s(=126°/s)는 킥을 렌더 전에 지워버렸다
      recoilPitch = Math.max(0, recoilPitch - dt * recoilRecovery)
      composeAim()
    }
    // 조준 궤적 가이드 갱신 (현재 조준 방향)
    camera.getWorldDirection(_gDir)
    _gOrigin.copy(camera.position).addScaledVector(_gDir, 0.5)
    range.updateGuide(_gOrigin, _gDir, guideSpeed, guideGravity)
    range.update(dt, performance.now())
  } else {
    // 드래그 중 쌓인 morph 변경을 프레임당 1회만 재빌드 (코얼레싱)
    if (morphDirty) {
      morphDirty = false
      rebuildEdit('drag')
    }
    controls.update()
  }
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

// ─── 부팅 ──────────────────────────────────────────────────
function resize(): void {
  const w = canvasHost.clientWidth || window.innerWidth
  const h = canvasHost.clientHeight || window.innerHeight
  if (w < 1 || h < 1) return // 레이아웃 미확정 — ResizeObserver 가 재호출
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
// ResizeObserver 로 레이아웃 확정 시점·이후 변경을 모두 포착 (grid 1fr 행 높이 0 부팅 버그 방지)
new ResizeObserver(() => resize()).observe(canvasHost)
window.addEventListener('resize', resize)

function autosave(): void {
  save.activeBlasterId = active.id
  persistSave(save)
}

window.addEventListener('pagehide', autosave)
window.addEventListener('pointerdown', () => resumeAudio(), { once: true })

// 설정 토글 2종 (결정문 26) — 최소 구현: 사운드 on/off (URL ?mute)
if (new URLSearchParams(location.search).has('mute')) setAudioEnabled(false)

// 첫 렌더
setStation('workshop')
resize()
tick()

// 디버그 핸들 (QA 하네스용)
;(window as unknown as { __blasterLab: unknown }).__blasterLab = {
  get save() {
    return save
  },
  get active() {
    return active
  },
  computeStats: () => computeStats(active),
  rendererInfo: () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
  }),
  setStation,
  setAim: (yaw: number, pitch: number) => {
    aimYaw = yaw
    aimPitch = pitch
    composeAim()
  },
  hits: () => totalHits,
  selectMag: (sel: AimSel) => selectMag(sel),
  zoomState: () => ({ aimMode, zoom, fov: Math.round(camera.fov * 100) / 100 }),
  rotateState: () => ({
    mul: rotateSpeedMul,
    autoRotate: controls.autoRotate,
    speed: Math.round(controls.autoRotateSpeed * 100) / 100,
  }),
  /** QA용 수동 스텝 — 백그라운드 탭 rAF 스로틀 우회. dt 고정 60fps. */
  step: (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (station === 'range') range.update(1 / 60, performance.now())
      renderer.render(scene, camera)
    }
    return { calls: renderer.info.render.calls, hits: totalHits }
  },
  state: () => ({
    station,
    recoilDeg: Math.round(((recoilPitch * 180) / Math.PI) * 1000) / 1000,
    recoilRecoveryDegPerSec: Math.round(((recoilRecovery * 180) / Math.PI) * 10) / 10,
    frameCount,
    editVisible: editRoot.visible,
    rangeVisible: range.group.visible,
    vmVisible: viewmodel.visible,
    geo: renderer.info.memory.geometries,
    calls: renderer.info.render.calls,
  }),
  setMorph: (slot: SlotType, key: MorphKey, t: number) => {
    const inst = active.parts[slot]
    if (inst) {
      inst.morph = { ...inst.morph, [key]: t }
      rebuildEdit('full')
      refreshPanels()
    }
  },
  fire,
}

// ─── 유틸 ──────────────────────────────────────────────────
function worldToScreen(x: number, y: number, z: number): { x: number; y: number } | null {
  const v = new THREE.Vector3(x, y, z).project(camera)
  if (v.z > 1) return null
  const w = canvasHost.clientWidth
  const h = canvasHost.clientHeight
  return { x: ((v.x + 1) / 2) * w, y: ((-v.y + 1) / 2) * h }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

let toastTimer = 0
function showToast(msg: string): void {
  let t = document.querySelector('.toast') as HTMLElement | null
  if (!t) {
    t = el('div', 'toast')
    app.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => t?.classList.remove('show'), 2600)
}
