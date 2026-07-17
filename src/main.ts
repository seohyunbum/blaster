// src/main.ts — 지휘자(conductor): 씬 부팅·루프·입력·스테이션 배선만. 신규 로직은 game/·ui/ 로.
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import type { Blaster, MorphKey, MorphState, SlotType } from './game/types.ts'
import { computeStats } from './game/parts.ts'
import { boreScaleFromMorph } from './game/morph.ts'
import { toShotProfile, PROJECTILE_GRAVITY } from './game/ballistics.ts'
import { buildBlaster, type BuiltBlaster } from './game/assembly.ts'
import { installEnvironment } from './game/materials.ts'
import { RangeController } from './game/range.ts'
import {
  loadSave,
  persistSave,
  makeInstance,
  type SavedGame,
} from './game/save.ts'
import { resumeAudio, sfx, setAudioEnabled } from './game/audio.ts'
import { MORPH_PARAMS } from './game/morph.ts'

import { createStationBar, type StationId } from './ui/stationBar.ts'
import { createWorkshopPanel } from './ui/workshopPanel.ts'
import { createPaintPanel } from './ui/paintPanel.ts'
import { createRangeHud, MAG_OPTIONS } from './ui/rangeHud.ts'
import type { AimMode, AimSel } from './ui/rangeHud.ts'

// ─── DOM ────────────────────────────────────────────────────
const app = document.getElementById('app')!
const canvasHost = el('div', 'canvas-host')
const barHost = el('div', 'bar-host')
const panelHost = el('div', 'panel-host')
const hudHost = el('div', 'hud-host')
app.append(canvasHost, barHost, panelHost, hudHost)

// 공방·꾸미기 패널은 각자 전용 루트에 렌더 — 전환 시 display 토글
const wsRoot = el('div', 'panel-root')
const paintRoot = el('div', 'panel-root')
panelHost.append(wsRoot, paintRoot)

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
controls.autoRotateSpeed = 1.6

// ─── 상태 ───────────────────────────────────────────────────
let save: SavedGame = loadSave(Date.now())
let active: Blaster = pickActive(save)
let station: StationId = 'workshop'
let booted = false
let editBuilt: BuiltBlaster | null = null
let vmBuilt: BuiltBlaster | null = null
const undoStack: PartsSnapshot[] = []
type PartsSnapshot = Partial<Record<SlotType, { partId: string; morph: MorphState }>>

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
  onGoRange: () => setStation('range'),
})

let paintPanel: ReturnType<typeof createPaintPanel> | null = null
const rangeHud = createRangeHud(hudHost, {
  onBack: () => finishRange(),
  onRetry: () => retryRange(),
  onExit: () => setStation('workshop'),
  onSelectMag: (mag) => selectMag(mag),
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
  stationBar.setName(active.name)
  stationBar.setCanUndo(undoStack.length > 0)
}

// ─── 스테이션 전환 ─────────────────────────────────────────
function setStation(id: StationId): void {
  if (booted && id === station && id !== 'range') return
  booted = true
  station = id
  stationBar.setActive(id)
  autosave()

  const editMode = id === 'workshop' || id === 'paint'
  app.classList.toggle('range-mode', id === 'range')
  editRoot.visible = editMode
  range.group.visible = id === 'range'
  viewmodel.visible = id === 'range'
  controls.enabled = editMode
  controls.autoRotate = id === 'workshop'

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
    rebuildEdit('full')
    refreshPanels()
  } else {
    enterRange()
  }
}

// ─── 파츠 선택 ─────────────────────────────────────────────
function selectPart(slot: SlotType, partId: string | null): void {
  const prev = active.parts[slot]
  // 변화 없으면 무시 — 같은 파츠 재선택으로 morph 를 지우거나 빈 undo 를 쌓지 않는다
  if (partId === null && !prev) return
  if (partId !== null && prev?.partId === partId) return
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

function morphInput(slot: SlotType, key: MorphKey, t: number): void {
  const inst = active.parts[slot]
  if (!inst) return
  if (!morphGesture) morphGesture = captureSnapshot()
  inst.morph = { ...inst.morph, [key]: t }
  rebuildEdit('drag')
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

function randomizeSlot(slot: SlotType): void {
  const inst = active.parts[slot]
  if (!inst) return
  pushUndo()
  const arche = slot === 'body' ? 'body' : slot === 'barrel' ? 'barrel' : null
  if (!arche) return
  const m: MorphState = {}
  for (const p of MORPH_PARAMS) {
    if (p.archetype === arche) m[p.key] = 0.1 + Math.random() * 0.8
  }
  inst.morph = m
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

const PRESET_KEYS: Array<['primary' | 'secondary' | 'accent', number]> = [
  ['primary', 0],
  ['secondary', 1],
  ['accent', 2],
]
const PRESETS: import('./game/palette.ts').PaletteKey[][] = [
  ['pastelSky', 'pastelCream', 'pastelPink'],
  ['blasterGreen', 'toyBlack', 'blasterYellow'],
  ['blasterRed', 'toyGrayLight', 'toyBlack'],
  ['pastelSky', 'toyGrayDark', 'blasterYellow'],
]

function applyPreset(index: number): void {
  const keys = PRESETS[index]
  if (!keys) return
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    const inst = active.parts[slot]
    if (!inst) continue
    for (const [zone, ki] of PRESET_KEYS) {
      if (inst.paint[zone]) {
        inst.paint[zone] = { color: keys[ki]!, finish: inst.paint[zone]!.finish }
      }
    }
  }
  sfx.click()
  rebuildEdit('full')
  paintPanel?.setBlaster(active)
  autosave()
}

// ─── Undo (조립+변형 통합, paint 미캡처 — 결정문 15) ──────────
function captureSnapshot(): PartsSnapshot {
  const snap: PartsSnapshot = {}
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    const inst = active.parts[slot]
    if (inst) snap[slot] = { partId: inst.partId, morph: { ...inst.morph } }
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
  // 복원: paint 는 현재값 보존 merge (결정문 15)
  const nextSlots = new Set(Object.keys(snap) as SlotType[])
  for (const slot of Object.keys(active.parts) as SlotType[]) {
    if (!nextSlots.has(slot) && slot !== 'body') delete active.parts[slot]
  }
  for (const slot of nextSlots) {
    const s = snap[slot]!
    const cur = active.parts[slot]
    if (cur) {
      cur.partId = s.partId
      cur.morph = { ...s.morph }
    } else {
      const inst = makeInstance(s.partId, s.morph)
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
let balloonHits = 0
let guideSpeed = 30
let guideGravity = 4
const _gDir = new THREE.Vector3()
const _gOrigin = new THREE.Vector3()
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
  if (e.kind === 'balloon') {
    balloonHits += 1
    rangeHud.setHits(balloonHits)
    sfx.pop()
  }
  const sp = worldToScreen(e.x, e.y, e.z)
  if (sp) rangeHud.popNumber(e.points, sp.x, sp.y)
}

function enterRange(): void {
  panelHost.style.display = 'none'
  hudHost.style.display = ''
  balloonHits = 0
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
  const stats = computeStats(active)
  const bore = boreScaleFromMorph(active.parts.barrel?.morph ?? {})
  const profile = toShotProfile(stats, bore)
  rangeHud.setSpread(profile.spreadDeg)
  guideSpeed = profile.muzzleVelocity
  guideGravity = PROJECTILE_GRAVITY[profile.kind]
}

const _aimEuler = new THREE.Euler(0, 0, 0, 'YXZ')
function composeAim(): void {
  _aimEuler.set(aimPitch + recoilPitch, aimYaw, 0, 'YXZ')
  camera.quaternion.setFromEuler(_aimEuler)
}

function fire(): void {
  const stats = computeStats(active)
  const bore = boreScaleFromMorph(active.parts.barrel?.morph ?? {})
  const profile = toShotProfile(stats, bore)
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  const origin = camera.position.clone().addScaledVector(dir, 0.5)
  range.fireOne(profile, origin, dir)
  recoilPitch += (profile.recoilKickDeg * Math.PI) / 180
  sfx.shoot()
}

function finishRange(): void {
  const stars = starsFor(balloonHits)
  updateCourseRecord(stars)
  if (balloonHits > 0) {
    if (stars > 0) sfx.star()
    rangeHud.showResult(stars, balloonHits)
  } else {
    setStation('workshop')
  }
}

function retryRange(): void {
  balloonHits = 0
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
    bestScore: Math.max(prev?.bestScore ?? 0, balloonHits),
    bestBlasterId: active.id,
  }
  autosave()
}

// 결과 오버레이의 "공방으로" 는 rangeHud 콜백이 setStation 호출 안 하므로 여기서 처리
// (rangeHud.onBack 은 finishRange 이므로, 결과카드의 back 은 아래 wiring 으로 station 전환)

// ─── 사격장 포인터 (드래그=조준, 탭=발사; 8px 판별 — 결정문 24) ─
let pointerDown = false
let downX = 0
let downY = 0
let moved = 0
renderer.domElement.addEventListener('pointerdown', (ev) => {
  if (station !== 'range') return
  pointerDown = true
  downX = ev.clientX
  downY = ev.clientY
  moved = 0
})
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (station !== 'range' || !pointerDown) return
  const dx = ev.clientX - downX
  const dy = ev.clientY - downY
  moved = Math.max(moved, Math.hypot(dx, dy))
  // 조준 배율만큼 감도를 낮춰 정밀 조준 (fov 비례 — 일반 1.0, 레드도트 약간, 스코프 크게)
  const sens = 0.0032 * (fovForZoom(currentMag()) / BASE_FOV)
  aimYaw -= (ev.movementX || 0) * sens
  aimPitch -= (ev.movementY || 0) * sens
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
      recoilPitch = Math.max(0, recoilPitch - dt * 2.2)
      composeAim()
    }
    // 조준 궤적 가이드 갱신 (현재 조준 방향)
    camera.getWorldDirection(_gDir)
    _gOrigin.copy(camera.position).addScaledVector(_gDir, 0.5)
    range.updateGuide(_gOrigin, _gDir, guideSpeed, guideGravity)
    range.update(dt, performance.now())
  } else {
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
  hits: () => balloonHits,
  selectMag: (sel: AimSel) => selectMag(sel),
  zoomState: () => ({ aimMode, zoom, fov: Math.round(camera.fov * 100) / 100 }),
  /** QA용 수동 스텝 — 백그라운드 탭 rAF 스로틀 우회. dt 고정 60fps. */
  step: (n = 1) => {
    for (let i = 0; i < n; i++) {
      if (station === 'range') range.update(1 / 60, performance.now())
      renderer.render(scene, camera)
    }
    return { calls: renderer.info.render.calls, hits: balloonHits }
  },
  state: () => ({
    station,
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
