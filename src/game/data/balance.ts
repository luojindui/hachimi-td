import type { Rarity } from '../types'

/**
 * 全局平衡常量。所有跨模块数值唯一来源，禁止在逻辑代码中硬编码同类数字。
 */

export const CELL_SIZE = 64

/* ---------------- 战斗内经济 ---------------- */

export const UPGRADE_COST_FACTOR_LV2 = 0.8
export const UPGRADE_COST_FACTOR_LV3 = 1.2
export const SELL_REFUND_RATIO = 0.6

/** 升级分支（Lv2 二选一专精，Lv3 深化同一路径） */
export type TowerPath = 'quick' | 'heavy'

interface BranchLevel {
  level: 1 | 2 | 3
  attackMul: number
  rangeBonus: number
  intervalMul: number
  /** 护甲穿透：敌人有效护甲 × 此系数（1 = 无穿透） */
  armorMul: number
}

export const TOWER_PATHS: readonly TowerPath[] = ['quick', 'heavy']

export const TOWER_BRANCHES: Record<
  TowerPath,
  { name: string; desc: string; levels: readonly BranchLevel[] }
> = {
  quick: {
    name: '速攻',
    desc: '攻速流：攻速成长快，射程小幅扩大',
    levels: [
      { level: 1, attackMul: 1.0, rangeBonus: 0, intervalMul: 1.0, armorMul: 1 },
      { level: 2, attackMul: 1.6, rangeBonus: 0.2, intervalMul: 0.8, armorMul: 1 },
      { level: 3, attackMul: 2.4, rangeBonus: 0.4, intervalMul: 0.65, armorMul: 1 },
    ],
  },
  heavy: {
    name: '重击',
    desc: '爆破流：单发伤害高，无视 50% 护甲（盾甲鼠克星）',
    levels: [
      { level: 1, attackMul: 1.0, rangeBonus: 0, intervalMul: 1.0, armorMul: 0.5 },
      { level: 2, attackMul: 2.2, rangeBonus: 0.1, intervalMul: 1.1, armorMul: 0.5 },
      { level: 3, attackMul: 3.4, rangeBonus: 0.2, intervalMul: 1.2, armorMul: 0.5 },
    ],
  },
}

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

/** 建造格地形元数据（UI 展示用） */
export const SLOT_KIND_META: Record<
  string,
  { name: string; desc: string; color: string }
> = {
  normal: { name: '平地', desc: '普通建造格', color: '#8a8f98' },
  high: { name: '高台', desc: '射程 +0.5', color: '#6ea8dc' },
  mine: { name: '金矿', desc: '每波清空 +40 小鱼干', color: '#f6b352' },
  thicket: { name: '草丛', desc: '攻速 +10%', color: '#58b368' },
}

/* ---------------- 肉鸽三选一 ---------------- */

export type DraftKind =
  | 'attack'
  | 'interval'
  | 'range'
  | 'gold'
  | 'splash'
  | 'crit'
  | 'fortify'
  | 'instantGold'
  /** 金色机制：处决低血量敌人 */
  | 'execute'
  /** 金色机制：命中后连锁闪电 */
  | 'chain'

export type DraftRarity = 'common' | 'rare' | 'epic'

/** 各稀有度抽取权重（common 55% / rare 36% / epic 9%） */
export const DRAFT_RARITY_WEIGHTS: Record<DraftRarity, number> = {
  common: 3,
  rare: 2,
  epic: 1,
}

export interface DraftDef {
  id: string
  name: string
  desc: string
  kind: DraftKind
  value: number
  rarity: DraftRarity
}

/** 波次开始时的三选一强化池（随机抽 3 个不重复，按权重分层） */
export const DRAFT_POOL: readonly DraftDef[] = [
  { id: 'attackPlus', name: '猫爪磨亮', desc: '全体攻击 +20%', kind: 'attack', value: 0.2, rarity: 'common' },
  { id: 'rapidFire', name: '闪电反射', desc: '全体攻速 +18%', kind: 'interval', value: 0.8475, rarity: 'rare' },
  { id: 'longRange', name: '千里眼', desc: '全体射程 +15%', kind: 'range', value: 0.15, rarity: 'common' },
  { id: 'bountyHunter', name: '赏金猎人', desc: '击杀赏金 +25%', kind: 'gold', value: 0.25, rarity: 'rare' },
  { id: 'bigSplash', name: '范围扩张', desc: '溅射宠物的溅射半径 +0.6 格', kind: 'splash', value: 0.6, rarity: 'rare' },
  { id: 'critEdge', name: '会心一击', desc: '12% 概率造成 2 倍伤害', kind: 'crit', value: 0.12, rarity: 'rare' },
  { id: 'fortify', name: '粮仓加固', desc: '粮仓上限 +5 并立即修复 5', kind: 'fortify', value: 5, rarity: 'common' },
  { id: 'economy', name: '战前集资', desc: '立即获得 150 小鱼干', kind: 'instantGold', value: 150, rarity: 'common' },
  { id: 'executeEdge', name: '处决者', desc: '敌人生命低于 15% 时直接处决', kind: 'execute', value: 0.15, rarity: 'epic' },
  { id: 'chainLightning', name: '连锁闪电', desc: '命中后向最近的另一个敌人弹出 50% 伤害', kind: 'chain', value: 0.5, rarity: 'epic' },
]

/** 每次三选一给出的选项数 */
export const DRAFT_COUNT = 3

/** 会心一击（三选一强化）参数 */
export const CRIT = {
  /** 伤害倍率 */
  DAMAGE: 2,
  /** 概率上限（可叠加抽取，不超过此值） */
  CHANCE_CAP: 0.5,
} as const

/* ---------------- 天赋树 ---------------- */

export type TalentBranch = 'attack' | 'economy' | 'survival'

export interface TalentNode {
  id: string
  name: string
  desc: string
  branch: TalentBranch
  tier: 1 | 2 | 3
  /** 解锁所需累计星数（不消耗星星） */
  starReq: number
  /** 购买消耗（猫薄荷） */
  cost: number
  effect: {
    kind:
      | 'attack'
      | 'gold'
      | 'baseHp'
      | 'eliteDamage'
      | 'critDamage'
      | 'waveGold'
      | 'instantGold'
    value: number
  }
}

/** 永久天赋：三系各三级，按累计星数解锁、猫薄荷购买 */
export const TALENTS: readonly TalentNode[] = [
  { id: 'atk1', name: '猫爪训练 I', desc: '全体攻击 +3%', branch: 'attack', tier: 1, starReq: 3, cost: 200, effect: { kind: 'attack', value: 0.03 } },
  { id: 'atk2', name: '猫爪训练 II', desc: '全体攻击 +6%', branch: 'attack', tier: 2, starReq: 9, cost: 500, effect: { kind: 'attack', value: 0.06 } },
  { id: 'atk3a', name: '破甲训练', desc: '对精英伤害 +30%', branch: 'attack', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'eliteDamage', value: 0.3 } },
  { id: 'atk3b', name: '会心强化', desc: '暴击伤害 +50%', branch: 'attack', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'critDamage', value: 0.5 } },
  { id: 'eco1', name: '理财猫 I', desc: '击杀赏金 +5%', branch: 'economy', tier: 1, starReq: 3, cost: 200, effect: { kind: 'gold', value: 0.05 } },
  { id: 'eco2', name: '理财猫 II', desc: '击杀赏金 +10%', branch: 'economy', tier: 2, starReq: 9, cost: 500, effect: { kind: 'gold', value: 0.1 } },
  { id: 'eco3a', name: '理财猫 III', desc: '击杀赏金 +15%', branch: 'economy', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'gold', value: 0.15 } },
  { id: 'eco3b', name: '丰收猫', desc: '波次清空奖励 +25%', branch: 'economy', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'waveGold', value: 0.25 } },
  { id: 'hp1', name: '粮仓守卫 I', desc: '粮仓上限 +2', branch: 'survival', tier: 1, starReq: 3, cost: 200, effect: { kind: 'baseHp', value: 2 } },
  { id: 'hp2', name: '粮仓守卫 II', desc: '粮仓上限 +4', branch: 'survival', tier: 2, starReq: 9, cost: 500, effect: { kind: 'baseHp', value: 4 } },
  { id: 'hp3a', name: '粮仓守卫 III', desc: '粮仓上限 +6', branch: 'survival', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'baseHp', value: 6 } },
  { id: 'hp3b', name: '战备存款', desc: '每场战斗开局 +200 小鱼干', branch: 'survival', tier: 3, starReq: 18, cost: 1000, effect: { kind: 'instantGold', value: 200 } },
]

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
  /** Boss 嚎叫 */
  BOSS_HOWL: { interval: 8, speedBonus: 0.2, duration: 3 },
  /** 攻击间隔下限（秒），防三选一叠加后失控 */
  MIN_ATTACK_INTERVAL: 0.1,
  /** 精英敌人加成 */
  ELITE: { HP_MUL: 2.2, SPEED_MUL: 0.9, BOUNTY_MUL: 3 },
  /** 漂浮文字生存时间（秒） */
  FLOAT_TEXT_LIFE: 0.9,
  /** 漂浮文字数量上限 */
  FLOAT_TEXT_MAX: 40,
} as const
