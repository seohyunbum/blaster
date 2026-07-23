// src/game/pvpLoadouts.ts — PVP용 가상 토이 드론 로드아웃.
// 플레이어 세이브와 참조를 공유하지 않는 고정 Blaster 프리셋만 제공한다.
import { makeInstance } from './saveModel.ts'
import type { PaletteKey } from './palette.ts'
import type { Blaster, MorphState, PartInstance } from './types.ts'

export interface PvpLoadout {
  id: string
  nameKo: string
  blaster: Blaster
}

function paintedInstance(
  partId: string,
  primary: PaletteKey,
  secondary: PaletteKey,
  accent: PaletteKey,
  morph: MorphState = {},
): PartInstance {
  const instance = makeInstance(partId, morph)
  instance.paint = {
    primary: { color: primary, finish: 'gloss' },
    secondary: { color: secondary, finish: 'matte' },
    accent: { color: accent, finish: 'metal' },
  }
  return instance
}

export const PVP_LOADOUTS: readonly PvpLoadout[] = [
  {
    id: 'spark_spinner',
    nameKo: '별빛 팽이 드론',
    blaster: {
      id: 'pvp_spark_spinner',
      name: '별빛 팽이 블래스터',
      createdAt: 0,
      parts: {
        body: paintedInstance(
          'body_buzz',
          'blasterMagenta',
          'pastelCream',
          'toyGold',
          { bodyRound: 0.9, bodyFin: 0.72 },
        ),
        barrel: paintedInstance(
          'barrel_buzz',
          'blasterMagenta',
          'pastelCream',
          'toyGold',
          { barrelLength: 0.28, barrelFlare: 0.82 },
        ),
        magazine: paintedInstance('mag_pocket', 'pastelPink', 'pastelCream', 'toyGold'),
        sight: paintedInstance('sight_dot', 'pastelPink', 'pastelCream', 'toyGold'),
        grip: paintedInstance('grip_buzz', 'blasterMagenta', 'pastelCream', 'toyGold'),
        stock: paintedInstance('stock_buzz', 'pastelPink', 'pastelCream', 'toyGold'),
        muzzle: paintedInstance('muzzle_ring', 'blasterOrange', 'pastelCream', 'toyGold'),
        strap: paintedInstance('strap_comfy', 'pastelPink', 'pastelCream', 'toyGold'),
      },
    },
  },
  {
    id: 'mint_ring',
    nameKo: '민트 링링 드론',
    blaster: {
      id: 'pvp_mint_ring',
      name: '민트 링링 블래스터',
      createdAt: 0,
      parts: {
        body: paintedInstance(
          'body_turbine',
          'blasterTeal',
          'pastelMint',
          'blasterYellow',
          { bodyChub: 0.68, bodyCrest: 0.74 },
        ),
        barrel: paintedInstance(
          'barrel_turbine',
          'blasterTeal',
          'pastelMint',
          'blasterYellow',
          { barrelRib: 0.86, barrelTaper: 0.62 },
        ),
        magazine: paintedInstance('mag_sidepod', 'pastelMint', 'pastelSky', 'blasterYellow'),
        sight: paintedInstance('sight_bridge', 'blasterTeal', 'pastelMint', 'blasterYellow'),
        grip: paintedInstance('grip_turbine', 'blasterTeal', 'pastelMint', 'blasterYellow'),
        stock: paintedInstance('stock_turbine', 'pastelMint', 'pastelSky', 'blasterYellow'),
        muzzle: paintedInstance('muzzle_turbine', 'blasterOrange', 'pastelMint', 'blasterYellow'),
        strap: paintedInstance('strap_comfy', 'pastelMint', 'pastelSky', 'blasterYellow'),
      },
    },
  },
  {
    id: 'coral_comet',
    nameKo: '코랄 혜성 드론',
    blaster: {
      id: 'pvp_coral_comet',
      name: '코랄 혜성 블래스터',
      createdAt: 0,
      parts: {
        body: paintedInstance(
          'body_comet',
          'blasterPurple',
          'pastelLavender',
          'blasterCoral',
          { bodyLength: 0.72, bodyTail: 0.8 },
        ),
        barrel: paintedInstance(
          'barrel_comet',
          'blasterPurple',
          'pastelLavender',
          'blasterCoral',
          { barrelLength: 0.7, barrelBore: 0.58 },
        ),
        magazine: paintedInstance('mag_powerbox', 'pastelLavender', 'pastelSky', 'blasterCoral'),
        sight: paintedInstance('sight_fin', 'blasterPurple', 'pastelLavender', 'blasterCoral'),
        grip: paintedInstance('grip_racer', 'blasterPurple', 'pastelLavender', 'blasterCoral'),
        stock: paintedInstance('stock_comet', 'pastelLavender', 'pastelSky', 'blasterCoral'),
        muzzle: paintedInstance('muzzle_star', 'blasterOrange', 'pastelLavender', 'blasterCoral'),
        strap: paintedInstance('strap_comfy', 'pastelLavender', 'pastelSky', 'blasterCoral'),
      },
    },
  },
]
