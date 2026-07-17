// 바탕화면 아이콘(.ico) 생성기 — 픽셀아트 토이 블래스터 (외부 의존성 없음)
// 사용: node scripts/gen-icon.mjs  → assets/blaster.ico
import { writeFileSync, mkdirSync } from 'node:fs'

const GRID = [
  '................',
  '....DDDDD.......',
  '....DYYYD.......',
  '....DYYYD.......',
  '.DDDDDDDDDDDD...',
  '.DOOOOOOOOOODDD.',
  '.DOOWWOOOOOOOBBD',
  '.DOOOOOOOOOODDD.',
  '.DDDDDDDDDDDD...',
  '...DOOD.........',
  '...DOOD.........',
  '..DOOD..........',
  '..DOOD..........',
  '.DDDDD..........',
  '................',
  '................',
]

// 토이 팔레트: 주황 몸통 + 파랑 팁 + 노랑 스코프 + 남색 외곽선
const COLORS = {
  D: [0x2b, 0x3a, 0x67, 255], // outline navy
  O: [0xff, 0x8a, 0x3d, 255], // body orange
  B: [0x4f, 0xc3, 0xf7, 255], // tip blue
  Y: [0xff, 0xd5, 0x4f, 255], // scope yellow
  W: [0xff, 0xff, 0xff, 255], // shine
  '.': [0, 0, 0, 0],
}

const SCALE = 4
const SIZE = 16 * SCALE // 64

function buildDib() {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(SIZE, 4)
  header.writeInt32LE(SIZE * 2, 8) // XOR + AND
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)

  const xor = Buffer.alloc(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gy = Math.floor(y / SCALE)
      const gx = Math.floor(x / SCALE)
      const ch = GRID[gy][gx]
      const [r, g, b, a] = COLORS[ch] ?? COLORS['.']
      // bottom-up
      const off = ((SIZE - 1 - y) * SIZE + x) * 4
      xor[off] = b
      xor[off + 1] = g
      xor[off + 2] = r
      xor[off + 3] = a
    }
  }
  const andMask = Buffer.alloc((SIZE / 8) * SIZE) // 전부 0 (알파 사용)
  return Buffer.concat([header, xor, andMask])
}

const dib = buildDib()
const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0)
iconDir.writeUInt16LE(1, 2) // type icon
iconDir.writeUInt16LE(1, 4) // count
const entry = Buffer.alloc(16)
entry.writeUInt8(SIZE, 0)
entry.writeUInt8(SIZE, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(dib.length, 8)
entry.writeUInt32LE(6 + 16, 12)

mkdirSync('assets', { recursive: true })
writeFileSync('assets/blaster.ico', Buffer.concat([iconDir, entry, dib]))
console.log('assets/blaster.ico written:', dib.length + 22, 'bytes')
