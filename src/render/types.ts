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

/** 战斗角色动画参数（矢量绘制用；emoji 后备路径忽略） */
export interface DrawAnim {
  /** 动画时刻（逻辑秒），用于待机弹跳等循环动画 */
  t?: number
  /** 随个体区分的相位（避免整齐划一） */
  phase?: number
  /** 受击闪白 */
  flash?: boolean
  /** 攻击后坐（0~1，刚发射≈1） */
  recoil?: number
  /** 放置弹跳（放置后经过的秒数） */
  sinceSpawn?: number
  /** 面朝方向（弧度） */
  facing?: number
  /** 减速中（冰霜标记） */
  slowed?: boolean
}

/**
 * 素材 Provider：实现本接口即可整套替换美术
 * （v1 = emoji 占位实现；v2 = vector 矢量生成器）。
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
  /**
   * 矢量绘制宠物（可选能力）：在 (cx,cy) 处以 heightPx 为目标高度绘制。
   * 提供此方法的 provider，战场渲染将优先走矢量路径。
   */
  drawPet?: (
    ctx: CanvasRenderingContext2D,
    petId: string,
    cx: number,
    cy: number,
    heightPx: number,
    anim?: DrawAnim,
  ) => void
  /** 矢量绘制敌人（可选能力） */
  drawEnemy?: (
    ctx: CanvasRenderingContext2D,
    enemyId: string,
    cx: number,
    cy: number,
    heightPx: number,
    anim?: DrawAnim,
  ) => void
}
