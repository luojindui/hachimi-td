import { getEnemy } from '@/game/data/enemies'
import { getPet } from '@/game/data/pets'
import type { LevelTheme, Rarity } from '@/game/types'

import type { AssetProvider, EnemyVisual, PetVisual, ThemeTiles, UiIconName } from '../types'

const RARITY_COLOR: Record<Rarity, string> = {
  N: '#9aa3ad',
  R: '#4a90e2',
  SR: '#9b59d0',
  SSR: '#e6a817',
}

const RARITY_SCALE: Record<Rarity, number> = {
  N: 0.92,
  R: 0.96,
  SR: 1,
  SSR: 1.1,
}

const THEME_TILES: Record<LevelTheme, ThemeTiles> = {
  yard: { bg: '#b7d89b', path: '#d9bd93', slotFill: 'rgba(255,251,240,0.55)', slotStroke: '#8fae74' },
  hall: { bg: '#d8c8b0', path: '#b09a7e', slotFill: 'rgba(255,251,240,0.6)', slotStroke: '#a08a6a' },
  garden: { bg: '#9cc98f', path: '#d4b489', slotFill: 'rgba(255,251,240,0.55)', slotStroke: '#7aa86d' },
  park: { bg: '#a3cf96', path: '#d9bd93', slotFill: 'rgba(255,251,240,0.55)', slotStroke: '#7fa86f' },
  night: { bg: '#4c4c62', path: '#6e6a80', slotFill: 'rgba(240,240,255,0.14)', slotStroke: '#8a88a8' },
  rooftop: { bg: '#8fa8c8', path: '#c4b49a', slotFill: 'rgba(255,251,240,0.55)', slotStroke: '#6f88a8' },
  granaryOut: { bg: '#c9b489', path: '#a88f66', slotFill: 'rgba(255,251,240,0.6)', slotStroke: '#96805c' },
  granary: { bg: '#d9c49a', path: '#b09468', slotFill: 'rgba(255,251,240,0.6)', slotStroke: '#a08455' },
  endless: { bg: '#3a3a5e', path: '#8080a8', slotFill: 'rgba(220,220,255,0.14)', slotStroke: '#9a9ac8' },
}

const ICONS: Record<UiIconName, string> = {
  fish: '🐟',
  catnip: '🌿',
  star: '⭐',
  life: '❤️',
  paw: '🐾',
  spawn: '🕳️',
  home: '🏠',
  speed: '💨',
}

/**
 * v1 占位素材：emoji 主体 + 识别色圆底 + 稀有度描边。
 * 视觉升级时替换本文件或注册新 provider 即可。
 */
export function createEmojiProvider(): AssetProvider {
  return {
    id: 'emoji-v1',

    petVisual(petId: string): PetVisual {
      const pet = getPet(petId)
      return {
        emoji: pet.emoji,
        tint: pet.tint,
        scale: RARITY_SCALE[pet.rarity],
        rarity: pet.rarity,
      }
    },

    enemyVisual(enemyId: string): EnemyVisual {
      const enemy = getEnemy(enemyId)
      return {
        emoji: enemy.emoji,
        tint: enemy.tint,
        scale: enemy.boss ? 1.5 : 1,
      }
    },

    projectileOf(petId: string): string {
      return getPet(petId).projectile
    },

    rarityColor(rarity: Rarity): string {
      return RARITY_COLOR[rarity]
    },

    icon(name: UiIconName): string {
      return ICONS[name]
    },

    tiles(theme: LevelTheme): ThemeTiles {
      return THEME_TILES[theme]
    },
  }
}
