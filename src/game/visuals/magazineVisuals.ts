import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial, glowMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildMagazine(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 14, 8)
  const sz = morphLerp('magSize', resolveMorph(opts.morph, 'magSize'))
  const ln = morphLerp('magLength', resolveMorph(opts.morph, 'magLength'))

  if (partId === 'mag_powerbox') {
    // 넓은 동력 상자 + 한쪽에 빛나는 셀 3개
    const w = 0.095 * sz
    const h = 0.14 * ln
    const d = 0.075 * sz
    const boxGeo = new RoundedBoxGeometry(w, h, d, 3, 0.018)
    geos.push(boxGeo)
    const box = new THREE.Mesh(boxGeo, fixedMaterial(PLACEHOLDER))
    box.position.y = -h * 0.5
    primary.push(box)
    group.add(box)
    const cellGeo = new THREE.CapsuleGeometry(0.011 * sz, h * 0.42, 3, Math.max(6, seg - 2))
    geos.push(cellGeo)
    for (let i = 0; i < 3; i++) {
      const cell = new THREE.Mesh(cellGeo, glowMaterial(0x74f0c5))
      cell.position.set(w * 0.5 + 0.004, -h * 0.5, (i - 1) * d * 0.29)
      group.add(cell)
    }
    const neckGeo = new RoundedBoxGeometry(w * 0.45, 0.03, d * 0.55, 2, 0.008)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.y = -0.01
    secondary.push(neck)
    group.add(neck)
  } else if (partId === 'mag_sidepod') {
    // 오른쪽으로 비켜 달린 둥근 포드 + 연결 목
    const R = 0.055 * sz
    const podGeo = new THREE.SphereGeometry(R, seg, seg)
    geos.push(podGeo)
    const pod = new THREE.Mesh(podGeo, fixedMaterial(PLACEHOLDER))
    pod.scale.set(1.15, 1.25 * ln, 0.9)
    pod.position.set(R * 0.78, -R * 1.05, -0.025)
    primary.push(pod)
    group.add(pod)
    const neckGeo = new THREE.CapsuleGeometry(0.014 * sz, 0.06 * sz, 3, seg)
    neckGeo.rotateZ(Math.PI / 2)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.rotation.z = -0.45
    neck.position.set(R * 0.35, -0.025, -0.025)
    secondary.push(neck)
    group.add(neck)
    const ringGeo = new THREE.TorusGeometry(R * 0.62, R * 0.11, 7, seg)
    ringGeo.rotateY(Math.PI / 2)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.copy(pod.position)
    secondary.push(ring)
    group.add(ring)
  } else if (partId === 'mag_duo') {
    // 작은 알약 팩 두 개와 가운데 연결 다리
    const packGeo = new THREE.CapsuleGeometry(0.025 * sz, 0.085 * ln, 3, seg)
    geos.push(packGeo)
    for (const sx of [-1, 1]) {
      const pack = new THREE.Mesh(packGeo, fixedMaterial(PLACEHOLDER))
      pack.position.set(sx * 0.032 * sz, -0.058 * ln, 0)
      primary.push(pack)
      group.add(pack)
    }
    const bridgeGeo = new RoundedBoxGeometry(0.07 * sz, 0.025, 0.04 * sz, 2, 0.008)
    geos.push(bridgeGeo)
    const bridge = new THREE.Mesh(bridgeGeo, fixedMaterial(PLACEHOLDER))
    bridge.position.y = -0.01
    secondary.push(bridge)
    group.add(bridge)
  } else if (partId === 'mag_pocket') {
    // 아주 짧은 포켓 상자 + 주황 잔량 버튼
    const w = 0.05 * sz
    const h = 0.065 * ln
    const d = 0.055 * sz
    const packGeo = new RoundedBoxGeometry(w, h, d, 3, 0.014)
    geos.push(packGeo)
    const pack = new THREE.Mesh(packGeo, fixedMaterial(PLACEHOLDER))
    pack.position.y = -h * 0.48
    primary.push(pack)
    group.add(pack)
    const buttonGeo = new THREE.SphereGeometry(0.009 * sz, 8, 6)
    geos.push(buttonGeo)
    const button = new THREE.Mesh(buttonGeo, fixedMaterial(0xff8a2b))
    button.position.set(w * 0.5, -h * 0.48, -d * 0.2)
    group.add(button)
  } else if (partId === 'mag_rocket') {
    // 로켓 다트 — 몸통 아래 매달린 커다란 토이 로켓(축=Z, 앞으로 -Z). 둥근 몸체 + 주황 노즈 + 꼬리 지느러미.
    const R = 0.03 * sz * 1.3
    const len = 0.13 * ln
    const cy = -R - 0.02 // 몸통 아래로 매달림
    const cz = -0.03 * sz // 총구 쪽으로 살짝
    // 로켓 몸체 (둥근 캡슐 느낌 실린더)
    const bodyGeo = new THREE.CylinderGeometry(R, R * 0.9, len, seg)
    bodyGeo.rotateX(Math.PI / 2) // 축 = Z
    geos.push(bodyGeo)
    const rocket = new THREE.Mesh(bodyGeo, fixedMaterial(PLACEHOLDER))
    rocket.position.set(0, cy, cz)
    primary.push(rocket)
    group.add(rocket)
    // 노즈 콘 (앞 -Z, 고정 주황 = 토이 시그니처)
    const noseGeo = new THREE.ConeGeometry(R, R * 2.4, seg)
    noseGeo.rotateX(-Math.PI / 2)
    geos.push(noseGeo)
    const nose = new THREE.Mesh(noseGeo, fixedMaterial(0xff8a2b))
    nose.position.set(0, cy, cz - len / 2 - R * 1.2)
    group.add(nose)
    // 꼬리 지느러미 3개 (뒤쪽)
    const finGeo = new THREE.BoxGeometry(0.008, R * 1.6, R * 1.4)
    geos.push(finGeo)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(Math.sin(a) * R, cy + Math.cos(a) * R, cz + len / 2 - R * 0.7)
      fin.rotation.z = a
      secondary.push(fin)
      group.add(fin)
    }
    // 몸통에 잇는 짧은 목
    const neckGeo = new THREE.BoxGeometry(0.02 * sz, 0.03, 0.03 * sz)
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.set(0, cy + R + 0.005, cz)
    secondary.push(neck)
    group.add(neck)
  } else if (partId === 'mag_revolver') {
    // 리볼버 실린더 — 배럴 방향(축=Z)으로 누운 통통한 회전 실린더. 앞면에 다트 6발이 링으로 보인다(토이 시그니처).
    // 통통하고 짧은 실린더(지름>길이) = 리볼버 실루엣. 몸통 밑에 바싹 붙여 매단다.
    const R = 0.058 * sz
    const cylLen = 0.05 * sz * (0.9 + 0.25 * ln)
    const cy = -0.022 // 몸통 밑면에 바싹(부유 방지, 살짝 파묻힘)
    const cz = -0.045 * sz // 총구 쪽으로 전진(리볼버 실린더 위치)
    const cylGeo = new THREE.CylinderGeometry(R, R, cylLen, seg)
    cylGeo.rotateX(Math.PI / 2) // 축 = Z (배럴 방향)
    geos.push(cylGeo)
    const cyl = new THREE.Mesh(cylGeo, fixedMaterial(PLACEHOLDER))
    cyl.position.set(0, cy, cz)
    primary.push(cyl)
    group.add(cyl)
    // 중심 축(요크 핀) — 고정색(비색칠)
    const axleGeo = new THREE.CylinderGeometry(R * 0.16, R * 0.16, cylLen * 1.25, seg)
    axleGeo.rotateX(Math.PI / 2)
    geos.push(axleGeo)
    const axle = new THREE.Mesh(axleGeo, fixedMaterial(0xd9dde3))
    axle.position.set(0, cy, cz)
    group.add(axle)
    // 챔버에 담긴 다트 6발 — 앞면(-Z)에서 뚜렷이 튀어나오는 링(고정 주황, 토이 시그니처)
    const dartLen = cylLen * 1.35
    const dartGeo = new THREE.CylinderGeometry(R * 0.17, R * 0.17, dartLen, Math.max(6, Math.floor(seg / 2)))
    dartGeo.rotateX(Math.PI / 2)
    geos.push(dartGeo)
    const chamberR = R * 0.62
    const dartZ = cz - cylLen * 0.35 // 앞끝이 실린더 앞면 밖으로 확실히 나오게
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2
      const dart = new THREE.Mesh(dartGeo, fixedMaterial(0xff8a2b)) // blasterOrange
      dart.position.set(Math.cos(a) * chamberR, cy + Math.sin(a) * chamberR, dartZ)
      group.add(dart)
    }
    // 톱 스트랩 — 실린더와 몸통을 잇는 얇은 연결(리볼버 프레임 느낌, 부유 방지)
    const strapGeo = new THREE.BoxGeometry(R * 0.5, 0.035, cylLen)
    geos.push(strapGeo)
    const strap = new THREE.Mesh(strapGeo, fixedMaterial(PLACEHOLDER))
    strap.position.set(0, cy + R + 0.004, cz)
    secondary.push(strap)
    group.add(strap)
  } else if (partId === 'mag_drum') {
    // 드럼통 — 옆으로 누운 꽉 찬 원반(축=X). 목으로 몸통에 연결.
    // 드럼은 총구 쪽(앞=-Z)으로 조금 당겨 실제 드럼탄창처럼 배럴 밑에 오게 한다.
    const R = 0.058 * sz * (0.85 + 0.3 * ln)
    const zFwd = -0.085 * sz // 앞으로 이동량 (총구 쪽으로 조금 더)
    const drumGeo = new THREE.CylinderGeometry(R, R, 0.05 * sz, seg)
    drumGeo.rotateZ(Math.PI / 2)
    geos.push(drumGeo)
    const drum = new THREE.Mesh(drumGeo, fixedMaterial(PLACEHOLDER))
    drum.position.set(0, -R - 0.012, zFwd)
    primary.push(drum)
    group.add(drum)
    const hubGeo = new THREE.CylinderGeometry(R * 0.3, R * 0.3, 0.056 * sz, seg)
    hubGeo.rotateZ(Math.PI / 2)
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(0xffd15c)) // 고정색(비색칠)
    hub.position.set(0, -R - 0.012, zFwd)
    group.add(hub)
    // 급탄 목 — 몸통(z≈0)과 앞으로 간 드럼을 잇도록 중앙 배치 + 길이 확장
    const neckGeo = new THREE.BoxGeometry(0.03 * sz, 0.028, 0.05 * sz + Math.abs(zFwd))
    geos.push(neckGeo)
    const neck = new THREE.Mesh(neckGeo, fixedMaterial(PLACEHOLDER))
    neck.position.set(0, -0.012, zFwd * 0.5)
    secondary.push(neck)
    group.add(neck)
  } else {
    // 미니 클립·스프링 팩·젤리 탱크 — 아래로 매달린 상자 (살짝 앞으로 기움)
    const isMini = partId === 'mag_mini'
    const isJelly = partId === 'mag_jelly'
    const isSpring = partId === 'mag_spring'
    const w = (isJelly ? 0.075 : isMini ? 0.042 : 0.05) * sz
    const d = (isJelly ? 0.085 : isMini ? 0.052 : 0.07) * sz
    const h = (isJelly ? 0.115 : isMini ? 0.075 : 0.13) * ln
    const tilt = 0.12
    const caseGeo = new RoundedBoxGeometry(w, h, d, 2, 0.012)
    geos.push(caseGeo)
    const mag = new THREE.Mesh(caseGeo, fixedMaterial(PLACEHOLDER))
    mag.rotation.x = tilt
    mag.position.set(0, -h * 0.5, 0)
    primary.push(mag)
    group.add(mag)
    // 잔량이 보이는 옆창 — secondary
    const winGeo = new THREE.BoxGeometry(0.012, h * 0.7, d * 0.5)
    geos.push(winGeo)
    const win = new THREE.Mesh(winGeo, fixedMaterial(PLACEHOLDER))
    win.rotation.x = tilt
    win.position.set(w * 0.5, -h * 0.5, 0)
    secondary.push(win)
    group.add(win)
    // 창 안에 보이는 다트 캡슐 2개 — 고정색(비색칠)
    const dartGeo = new THREE.CapsuleGeometry(0.01 * sz, 0.02, 3, seg)
    geos.push(dartGeo)
    for (let i = 0; i < 2; i++) {
      const dart = new THREE.Mesh(dartGeo, fixedMaterial(0xff8a5c))
      dart.rotation.x = tilt
      dart.position.set(w * 0.5 + 0.002, -h * (0.3 + i * 0.3), 0)
      group.add(dart)
    }
    if (isSpring) {
      const coilGeo = new THREE.TorusGeometry(w * 0.58, 0.004 * sz, 6, seg)
      coilGeo.rotateY(Math.PI / 2)
      geos.push(coilGeo)
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(coilGeo, fixedMaterial(PLACEHOLDER))
        coil.position.set(0, -h * (0.27 + i * 0.23), 0)
        secondary.push(coil)
        group.add(coil)
      }
    } else if (isJelly) {
      const bubbleGeo = new THREE.SphereGeometry(0.014 * sz, 8, 6)
      geos.push(bubbleGeo)
      for (const z of [-d * 0.24, d * 0.24]) {
        const bubble = new THREE.Mesh(bubbleGeo, glowMaterial(0x74f0c5))
        bubble.position.set(-w * 0.28, -h * 0.58, z)
        group.add(bubble)
      }
    }
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 어깨끈 — 몸통 오른쪽 측면 앞·뒤 고리를 잇고 아래로 늘어짐 ────
