import type { LevelTheme, Rarity } from '@/game/types'

/** 宠物静态视觉描述 */
export interface PetVisual {
  emoji: string
  /** 主体识别色 */
  tint: string
  /** 相对缩放 */
  scale: number
  /** 稀有度（渲染描边/角标用） */
  rarity: Rarity
}

/** 敌人静态视觉描述 */
export interface EnemyVisual {
  emoji: string
  tint: string
  scale: number
}

/** 地块配色（按关卡主题） */
export interface ThemeTiles {
  /** 场地底色 */
  bg: string
  /** 路径色 */
  path: string
  /** 建造格填充 */
  slotFill: string
  /** 建造格描边 */
  slotStroke: string
}

export type UiIconName =
  | 'fish'
  | 'catnip'
  | 'star'
  | 'life'
  | 'paw'
  | 'spawn'
  | 'home'
  | 'speed'

/**
 * 素材 Provider：实现本接口即可整套替换美术
 * （v1 = emoji 占位实现；未来可为矢量生成器或图片图集）。
 */
export interface AssetProvider {
  /** provider 标识（调试与切换日志用） */
  readonly id: string
  petVisual(petId: string): PetVisual
  enemyVisual(enemyId: string): EnemyVisual
  /** 宠物弹道视觉（emoji 字符） */
  projectileOf(petId: string): string
  /** 稀有度主题色 */
  rarityColor(rarity: Rarity): string
  /** UI 图标字符 */
  icon(name: UiIconName): string
  tiles(theme: LevelTheme): ThemeTiles
}
