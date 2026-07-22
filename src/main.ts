// src/main.ts — 지휘자(conductor): 씬 부팅·루프·입력·스테이션 배선만. 신규 로직은 game/·ui/ 로.
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { Blaster, MorphKey, SlotType, ZoneId } from './game/types.ts'
import { CATALOG, computeStats } from './game/parts.ts'
import { boreScaleFromMorph } from './game/morph.ts'
import {
  toShotProfile,
} from './game/ballistics.ts'
import { buildBlaster, paintableZones, type BuiltBlaster } from './game/assembly.ts'
import { installEnvironment } from './game/materials.ts'
import { RangeController } from './game/range.ts'
import { RangeSession } from './game/rangeSession.ts'
import {
  loadSave,
  persistSave,
  createStarterBlaster,
  cloneBlaster,
  exportSaveText,
  importInto,
  type SavedGame,
} from './game/save.ts'
import { resumeAudio, sfx, setAudioEnabled } from './game/audio.ts'
import { STATION_DEFS } from './game/definitions.ts'
import { EditorSession } from './game/editorSession.ts'

import { createStationBar, type StationId } from './ui/stationBar.ts'
import { createWorkshopPanel } from './ui/workshopPanel.ts'
import { createPaintPanel } from './ui/paintPanel.ts'
import { createRangeHud } from './ui/rangeHud.ts'
import type { AimSel } from './ui/rangeHud.ts'
import { createRotateControl } from './ui/rotateControl.ts'
import { createCollectionPanel } from './ui/collectionPanel.ts'
import type { BlasterLabDebugHandle } from './debug.ts'

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
const rangeSession = new RangeSession()
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
const editor = new EditorSession(active)
let station: StationId = 'workshop'
let booted = false
let editBuilt: BuiltBlaster | null = null
let vmBuilt: BuiltBlaster | null = null

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

const _vmBox = new THREE.Box3()
const _vmSize = new THREE.Vector3()
const _vmCenter = new THREE.Vector3()
/**
 * 쏘기 화면 총(뷰모델) 위치를 착용 파츠에 따라 조정 (사용자 요청 — 모든 총을 내리지 않는다).
 * - 미니건 이름 파츠 다 착용(미니건 코어 + 미니건 손잡이): 크게 축소 + 화면 아래로 쭉 내림.
 * - 리볼버 파츠 착용(리볼버 실린더/그립): 조금만 아래로.
 * - 그 외: 기존 위치·크기 그대로.
 */
function fitViewmodel(g: THREE.Object3D): void {
  g.scale.setScalar(1)
  g.position.set(0, 0, 0)
  const bodyId = active.parts.body?.partId
  const gripId = active.parts.grip?.partId
  const magId = active.parts.magazine?.partId
  const isFullMinigun =
    CATALOG.get(bodyId ?? '')?.capabilities?.viewmodelFit === 'oversize' &&
    CATALOG.get(gripId ?? '')?.capabilities?.viewmodelFit === 'oversize'
  const hasRevolver = [gripId, magId].some(
    (id) => CATALOG.get(id ?? '')?.capabilities?.viewmodelFit === 'compact',
  )
  if (isFullMinigun) {
    g.updateMatrixWorld(true)
    _vmBox.setFromObject(g)
    _vmBox.getSize(_vmSize)
    _vmBox.getCenter(_vmCenter)
    // 화면 가리는 가로·세로(x·y) 기준 축소(깊이 z 제외). 총 윗부분이 화면 하단에 오도록 매달기.
    const screenDim = Math.max(_vmSize.x, _vmSize.y)
    const TARGET = 0.34
    const s = screenDim > TARGET ? TARGET / screenDim : 1
    g.scale.setScalar(s)
    g.position.set(-_vmCenter.x * s, -(_vmCenter.y + _vmSize.y / 2) * s, -_vmCenter.z * s)
  } else if (hasRevolver) {
    g.position.y = -0.05 // 조금만 아래로 (아주 살짝 위로 조정)
  }
}

function rebuildViewmodel(): void {
  if (vmBuilt) {
    viewmodel.remove(vmBuilt.group)
    vmBuilt.dispose()
  }
  vmBuilt = buildBlaster(active, 'full')
  viewmodel.add(vmBuilt.group)
  fitViewmodel(vmBuilt.group)
}

function refreshPanels(): void {
  const stats = computeStats(active)
  workshopPanel.setBlaster(active, stats)
  paintPanel?.setBlaster(active, currentPaintZones())
  collectionPanel.setData(save.blasters, active.id)
  stationBar.setName(active.name)
  stationBar.setCanUndo(editor.canUndo)
}

// ─── 스테이션 전환 ─────────────────────────────────────────
function setStation(id: StationId): void {
  // 이미 그 스테이션이면 no-op — 사격 중 '쏘기' 재탭이 라운드를 조용히 리셋하던 버그 수정.
  // (라운드 재시작은 결과 카드의 "한 번 더"로만)
  if (booted && id === station) return
  booted = true
  station = id
  editor.cancelGesture()
  stationBar.setActive(id)
  autosave()

  const stationDef = STATION_DEFS[id]
  const editMode = stationDef.mode === 'edit'
  app.classList.toggle('range-mode', stationDef.mode === 'range')
  editRoot.visible = editMode
  range.group.visible = stationDef.mode === 'range'
  viewmodel.visible = stationDef.mode === 'range'
  controls.enabled = editMode
  applyRotation(editMode)
  editOverlay.style.display = editMode ? '' : 'none'

  panelHost.style.display = editMode ? '' : 'none'
  hudHost.style.display = stationDef.mode === 'range' ? '' : 'none'

  if (editMode) {
    rangeSession.selectAim(null, camera)
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
    wsRoot.style.display = stationDef.panel === 'workshop' ? '' : 'none'
    paintRoot.style.display = stationDef.panel === 'paint' ? '' : 'none'
    collectionRoot.style.display = stationDef.panel === 'collection' ? '' : 'none'
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
    editor.setActive(active)
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
  editor.setActive(active)
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
    save = res.save
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
    editor.setActive(active)
    rebuildEdit('full')
  }
  sfx.click()
  refreshPanels()
  autosave()
}

// ─── 편집 세션 배선 ─────────────────────────────────────────
function finishEditorChange(sound: 'snap' | 'click'): void {
  sfx[sound]()
  rebuildEdit('full')
  refreshPanels()
  autosave()
}

function currentPaintZones(): Partial<Record<SlotType, readonly ZoneId[]>> {
  const result: Partial<Record<SlotType, readonly ZoneId[]>> = {}
  if (!editBuilt) return result
  for (const slot of Object.keys(editBuilt.parts) as SlotType[]) {
    const built = editBuilt.parts[slot]
    if (built) result[slot] = paintableZones(built)
  }
  return result
}

function selectPart(slot: SlotType, partId: string | null): void {
  if (editor.selectPart(slot, partId)) finishEditorChange('snap')
}

function morphInput(slot: SlotType, key: MorphKey, t: number): void {
  const result = editor.morphInput(slot, key, t)
  if (!result.changed) return
  workshopPanel.updateStats(computeStats(active))
  if (result.playSound) sfx.morph(t)
}

function morphCommit(slot: SlotType, key: MorphKey, t: number): void {
  if (editor.morphCommit(slot, key, t)) finishEditorChange('snap')
}

function randomizeSlot(slot: SlotType): void {
  if (editor.randomizeSlot(slot)) finishEditorChange('snap')
}

function randomizeAll(): void {
  if (editor.randomizeAll()) finishEditorChange('snap')
}

function pickColor(
  slot: SlotType,
  zone: 'primary' | 'secondary' | 'accent',
  color: import('./game/palette.ts').PaletteKey,
): void {
  if (!editor.pickColor(slot, zone, color)) return
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active, currentPaintZones())
  autosave()
}

function pickFinish(
  slot: SlotType,
  zone: 'primary' | 'secondary' | 'accent',
  finish: 'matte' | 'gloss' | 'metal',
): void {
  if (!editor.pickFinish(slot, zone, finish)) return
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active, currentPaintZones())
  autosave()
}

function applyPreset(index: number): void {
  if (!editor.applyPreset(index)) return
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active, currentPaintZones())
  autosave()
}

function doUndo(): void {
  if (editor.undo()) finishEditorChange('click')
}

// ─── 사격장 ────────────────────────────────────────────────
const COURSE_ID = 'balloon_yard'

function currentShotProfile() {
  const stats = computeStats(active)
  const bore = boreScaleFromMorph(active.parts.barrel?.morph ?? {})
  return { stats, profile: toShotProfile(stats, bore) }
}

function syncAmmo(progress?: number): void {
  rangeHud.setAmmo(
    rangeSession.ammoCur,
    rangeSession.ammoMax,
    rangeSession.reloading,
    progress,
  )
}

range.onHit = (e) => {
  const hits = rangeSession.registerHit()
  rangeHud.setHits(hits)
  sfx.pop()
  const sp = worldToScreen(e.x, e.y, e.z)
  if (sp) rangeHud.popNumber(e.points, sp.x, sp.y)
}

function enterRange(): void {
  panelHost.style.display = 'none'
  hudHost.style.display = ''
  range.reset()
  rangeHud.setHits(0)
  rangeHud.hideResult()
  camera.position.set(0, 1.5, 0.2)
  const { stats, profile } = currentShotProfile()
  rangeSession.begin(stats, profile, camera)
  rangeHud.setMagSelection(rangeSession.aimMode, rangeSession.zoom)
  rangeHud.setSpread(profile.spreadDeg)
  syncAmmo()
  rebuildViewmodel()
  stationBar.setCanUndo(false)
}

function startReload(): void {
  if (!rangeSession.startReload(performance.now())) return
  syncAmmo(0)
  sfx.reload()
}

function selectMag(sel: AimSel): void {
  rangeSession.selectAim(sel, camera)
  rangeHud.setMagSelection(rangeSession.aimMode, rangeSession.zoom)
  sfx.click()
}

function stepMag(delta: number): void {
  rangeSession.stepAim(delta, camera)
  rangeHud.setMagSelection(rangeSession.aimMode, rangeSession.zoom)
  sfx.click()
}

function fire(): void {
  const { profile } = currentShotProfile()
  const result = rangeSession.fire(profile, camera, range, performance.now())
  if (result.status === 'blocked') return
  if (result.status === 'empty') sfx.empty()
  if (result.startedReload) sfx.reload()
  syncAmmo(result.startedReload ? 0 : undefined)
  if (result.status === 'fired') sfx.shoot()
}

function finishRange(): void {
  const stars = rangeSession.stars
  updateCourseRecord(stars)
  if (rangeSession.shotsFired > 0) {
    if (stars > 0) sfx.star()
    rangeHud.showResult(stars, rangeSession.hits)
  } else {
    setStation('workshop')
  }
}

function retryRange(): void {
  rangeSession.retry()
  range.reset()
  rangeHud.setHits(0)
  syncAmmo()
}

function updateCourseRecord(stars: 0 | 1 | 2 | 3): void {
  const prev = save.courseRecords[COURSE_ID]
  const best = Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3
  save.courseRecords[COURSE_ID] = {
    stars: best,
    bestScore: Math.max(prev?.bestScore ?? 0, rangeSession.hits),
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
  // movementX 미제공 브라우저(일부 터치)를 위해 client 델타 폴백 — 마우스도 동일 결과
  const mx = ev.movementX || ev.clientX - lastX
  const my = ev.movementY || ev.clientY - lastY
  lastX = ev.clientX
  lastY = ev.clientY
  rangeSession.moveAim(mx, my, camera)
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
  selectMag(rangeSession.aimMode === 'none' ? 'reddot' : null)
})
// R 키 = 수동 재장전 (다 쓰기 전에 미리 갈아끼우기)
window.addEventListener('keydown', (ev) => {
  if (station !== 'range') return
  if (ev.key === 'r' || ev.key === 'R') startReload()
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
    rangeSession.update(dt, now, camera, range)
    if (rangeSession.reloadCompleted) {
      syncAmmo()
      sfx.reloadDone()
    } else if (rangeSession.reloadProgress !== null) {
      syncAmmo(rangeSession.reloadProgress)
    }
  } else {
    // 드래그 중 쌓인 morph 변경을 프레임당 1회만 재빌드 (코얼레싱)
    if (editor.consumeMorphDirty()) {
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
const debugHandle: BlasterLabDebugHandle = {
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
    visibleMeshes: countVisibleMeshes(scene),
  }),
  setStation,
  setAim: (yaw: number, pitch: number) => {
    rangeSession.setAim(yaw, pitch, camera)
  },
  hits: () => rangeSession.hits,
  selectMag: (sel: AimSel) => selectMag(sel),
  zoomState: () => ({ aimMode: rangeSession.aimMode, zoom: rangeSession.zoom, fov: Math.round(camera.fov * 100) / 100 }),
  rotateState: () => ({
    mul: rotateSpeedMul,
    autoRotate: controls.autoRotate,
    speed: Math.round(controls.autoRotateSpeed * 100) / 100,
  }),
  /** QA용 수동 스텝 — 백그라운드 탭 rAF 스로틀 우회. dt 고정 60fps. */
  step: (n = 1) => {
    const frames = Math.max(1, Math.floor(n))
    const startedAt = performance.now()
    for (let i = 0; i < frames; i++) {
      if (station === 'range') {
        const now = performance.now()
        rangeSession.update(1 / 60, now, camera, range)
        if (rangeSession.reloadCompleted) syncAmmo()
      }
      renderer.render(scene, camera)
    }
    return {
      calls: renderer.info.render.calls,
      hits: rangeSession.hits,
      averageFrameMs: (performance.now() - startedAt) / frames,
    }
  },
  ammoState: () => ({
    ammoMax: rangeSession.ammoMax,
    ammoCur: rangeSession.ammoCur,
    reloading: rangeSession.reloading,
    reloadDurMs: rangeSession.reloadDurMs,
  }),
  reload: () => startReload(),
  state: () => ({
    station,
    recoilDeg: Math.round(rangeSession.recoilDeg * 1000) / 1000,
    recoilRecoveryDegPerSec: Math.round(rangeSession.recoilRecoveryDegPerSec * 10) / 10,
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
window.__blasterLab = debugHandle

// ─── 유틸 ──────────────────────────────────────────────────
function countVisibleMeshes(root: THREE.Object3D): number {
  let count = 0
  root.traverseVisible((object) => { if (object instanceof THREE.Mesh) count += 1 })
  return count
}

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
