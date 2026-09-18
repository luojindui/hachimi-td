import type { Rarity } from '../types'

/**
 * 全局平衡常量。所有跨模块数值唯一来源，禁止在逻辑代码中硬编码同类数字。
 */

export const CELL_SIZE = 64

/* ---------------- 战斗内经济 ---------------- */

export const UPGRADE_COST_FACTOR_LV2 = 0.8
export const UPGRADE_COST_FACTOR_LV3 = 1.2
export const SELL_REFUND_RATIO = 0.6

/** 战斗内塔等级成长 */
export const TOWER_LEVELS = [
  { level: 1, attackMul: 1.0, rangeBonus: 0, intervalMul: 1.0 },
  { level: 2, attackMul: 1.8, rangeBonus: 0.3, intervalMul: 0.95 },
  { level: 3, attackMul: 2.9, rangeBonus: 0.6, intervalMul: 0.9 },
] as const

/* ---------------- 伤害公式 ---------------- */

export const ARMOR_K = 100

/* ---------------- 养成：星级 ---------------- */

export const STAR_MAX = 5
export const STAR_ATTACK_GROWTH = 0.15

/** 升星到 stars+1 所需的该宠物碎片数量（索引 0 = 升到 2★） */
export const STAR_UP_SHARDS = [2, 2, 3, 3] as const
/** 升星到 stars+1 所需猫薄荷基础量（索引 0 = 升到 2★） */
export const STAR_UP_CATNIP = [40, 100, 250, 500] as const
/** 稀有度对升星猫薄荷消耗的乘数 */
export const STAR_UP_RARITY_MUL: Record<Rarity, number> = {
  N: 1,
  R: 1.2,
  SR: 1.6,
  SSR: 2,
}

/* ---------------- 抽卡 ---------------- */

export const GACHA = {
  SINGLE_COST: 100,
  MULTI_COST: 900,
  MULTI_SIZE: 10,
  RATES: { N: 0.55, R: 0.3, SR: 0.12, SSR: 0.03 },
  /** 累计多少抽未出 SR+ 后必出 SR+ */
  SR_PITY: 20,
  /** 累计多少抽必出 SSR */
  SSR_PITY: 40,
  /** 重复宠物转碎片数量 */
  DUPE_SHARDS: { N: 5, R: 4, SR: 3, SSR: 3 },
} as const

/* ---------------- 经济与奖励 ---------------- */

/** 全关星数里程碑（累计星数 → 猫薄荷），只发一次 */
export const STAR_MILESTONES = [
  { stars: 6, catnip: 300 },
  { stars: 12, catnip: 600 },
  { stars: 18, catnip: 900 },
  { stars: 24, catnip: 1500 },
] as const

/** 开局赠送 */
export const NEW_GAME = {
  starterPetIds: ['tianyuan-cat', 'tianyuan-dog'],
  catnip: 1200,
} as const

/* ---------------- 无尽模式 ---------------- */

export const ENDLESS = {
  /** 每 5 波一个难度跳 */
  RAMP_EVERY: 5,
  /** 每个难度跳的血量乘数 */
  RAMP_HP_MULT: 1.35,
  /** 每个难度跳的速度加成（+3%/跳） */
  RAMP_SPEED_PER_JUMP: 0.03,
  /** 每 5 波一次性猫薄荷里程碑 */
  MILESTONE_WAVE: 5,
  MILESTONE_CATNIP: 100,
} as const

/* ---------------- 编队 ---------------- */

export const LINEUP_SIZE = 6

/* ---------------- 数值锚点（测试用） ---------------- */

/** DPS / 建造成本 的合理区间（伤害型定位），超出说明失衡 */
export const DPS_COST_RANGE = { min: 0.15, max: 0.36 } as const

/* ---------------- 引擎常量 ---------------- */

export const ENGINE = {
  /** 逻辑步长（秒），与渲染解耦 */
  LOGIC_STEP: 1 / 30,
  /** 单次 update 允许积累的最大真实时长（秒），防标签页恢复后螺旋卡死 */
  MAX_FRAME_DT: 0.5,
  /** 波次间隔（上一波清空到下一波自动开始） */
  WAVE_BREAK_SECONDS: 10,
  /** 首波准备时间（秒） */
  FIRST_WAVE_COUNTDOWN: 15,
  /** 提前召唤：预支下一波清空奖励的比例 */
  CALL_NEXT_BONUS_RATIO: 0.5,
  /** 溅射对次要目标的伤害比例 */
  SPLASH_DAMAGE_RATIO: 0.6,
  /** 弹道速度（格/秒） */
  PROJECTILE_SPEED: 9,
  /** 弹道命中判定距离（格） */
  PROJECTILE_HIT_DIST: 0.2,
  /** 鼠王嚎叫 */
  BOSS_HOWL: { interval: 8, speedBonus: 0.2, duration: 3 },
  /** 漂浮文字生存时间（秒） */
  FLOAT_TEXT_LIFE: 0.9,
  /** 漂浮文字数量上限 */
  FLOAT_TEXT_MAX: 40,
} as const
