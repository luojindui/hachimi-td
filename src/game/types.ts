/** 游戏核心类型定义（数据层 + 引擎运行时） */

/* ===================== 基础枚举 ===================== */

export type Rarity = 'N' | 'R' | 'SR' | 'SSR'

export type PetRole = 'shooter' | 'cannon' | 'ice' | 'support' | 'antiair'

/** 可攻击目标类型：地面 / 飞行 / 双修 */
export type TargetKind = 'ground' | 'air' | 'both'

export interface Vec2 {
  x: number
  y: number
}

/* ===================== 宠物数据 ===================== */

export interface SlowSpec {
  /** 速度乘数（如 0.55 = 减速 45%） */
  factor: number
  /** 持续秒数 */
  duration: number
}

export interface AuraSpec {
  kind: 'attackSpeed' | 'gold' | 'globalAttack'
  /** 加成比例（0.2 = +20%） */
  value: number
  /** 生效半径（格子）；超大值表示全场 */
  radius: number
}

export interface PassiveSpec {
  kind: 'bountyFlat'
  /** 每次击杀额外小鱼干 */
  value: number
}

export interface PetDef {
  id: string
  name: string
  species: 'cat' | 'dog'
  rarity: Rarity
  role: PetRole
  targets: TargetKind
  /** 建造费用（小鱼干） */
  cost: number
  /** Lv1 攻击力 */
  attack: number
  /** 攻击间隔（秒） */
  attackInterval: number
  /** 射程（格子） */
  range: number
  /** 溅射半径（格子），炮手/轰击专用 */
  splash?: number
  slow?: SlowSpec
  aura?: AuraSpec
  passive?: PassiveSpec
  desc: string

  /* --- 渲染占位字段（由 render/registry 消费，可整体替换） --- */
  emoji: string
  /** 主体识别色 */
  tint: string
  /** 弹道 emoji */
  projectile: string
}

/* ===================== 敌人数据 ===================== */

export type EnemyKind = 'normal' | 'fast' | 'armored' | 'air' | 'boss'

export interface EnemyDef {
  id: string
  name: string
  kind: EnemyKind
  /** 基础血量（关卡 hpMul 会再乘算） */
  hp: number
  /** 移速（格/秒） */
  speed: number
  armor: number
  /** 击杀赏金（小鱼干） */
  bounty: number
  /** 到达粮仓扣除的血量 */
  leakDamage: number
  flying: boolean
  boss: boolean

  /* --- 渲染占位字段 --- */
  emoji: string
  tint: string
}

/* ===================== 关卡数据 ===================== */

export type LevelTheme =
  | 'yard'
  | 'hall'
  | 'garden'
  | 'park'
  | 'night'
  | 'rooftop'
  | 'granaryOut'
  | 'granary'
  | 'endless'

export interface WaveEntry {
  enemyId: string
  count: number
  /** 生成间隔（秒） */
  interval: number
  /** 本组在波开始后延迟多少秒出现 */
  delay?: number
}

export interface WaveDef {
  entries: WaveEntry[]
  /** 清空波次奖励（小鱼干） */
  reward: number
  /** 本波额外血量乘数（无尽模式爬坡用） */
  hpMul?: number
  /** 本波额外速度乘数（无尽模式爬坡用） */
  speedMul?: number
}

export interface LevelDef {
  /** '1'..'8' 或 'endless' */
  id: string
  name: string
  theme: LevelTheme
  endless?: boolean
  grid: { cols: number; rows: number }
  /** 路点序列（格子坐标，可含 -1 / cols 等界外进出点），轴对齐线段 */
  path: readonly Vec2[]
  /** 建造格（格子坐标） */
  buildSlots: readonly Vec2[]
  /** 粮仓血量 */
  baseHp: number
  /** 开局小鱼干 */
  startGold: number
  /** 本关敌人血量总乘数 */
  hpMul: number
  /** 本关敌人速度总乘数 */
  speedMul: number
  /** 普通关卡的波次；无尽关卡为空，由 getEndlessWave 生成 */
  waves: readonly WaveDef[]
  firstClearCatnip: number
  repeatClearCatnip: number
}

/* ===================== 战斗运行时（引擎产出，渲染消费） ===================== */

export type TowerId = string

export interface TowerView {
  id: TowerId
  petId: string
  slotIndex: number
  x: number
  y: number
  level: 1 | 2 | 3
  cooldownRatio: number
  /** 放置时刻（逻辑秒），渲染层用于放置弹跳 */
  spawnAt: number
}

export interface EnemyView {
  id: number
  enemyId: string
  x: number
  y: number
  hp: number
  maxHp: number
  flying: boolean
  boss: boolean
  /** 被减速时的视觉标记 */
  slowed: boolean
  /** 被鼠王嚎叫加速中的视觉标记 */
  howled: boolean
  /** 受击闪白（短暂） */
  flash: boolean
  /** 移动朝向（弧度，0 = 向右） */
  facing: number
}

export type EffectKind = 'poof' | 'hit' | 'coin' | 'howl'

/** 地图互动宝箱 */
export interface CrateView {
  id: number
  x: number
  y: number
  opened: boolean
}

/** 肉鸽三选一的候选项（波次清空后出现） */
export interface DraftOption {
  id: string
  name: string
  desc: string
}

export interface EffectView {
  id: number
  x: number
  y: number
  kind: EffectKind
  /** 0~1 生命进度（0 刚诞生，1 即将消失） */
  progress: number
}

export interface ProjectileView {
  id: number
  /** 发射宠物的 id（渲染端经素材注册表解析视觉） */
  petId: string
  x: number
  y: number
  angle: number
}

export interface FloatTextView {
  id: number
  text: string
  x: number
  y: number
  /** 生存剩余秒数 */
  life: number
  kind: 'gold' | 'leak'
}

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat'

/** 引擎对外的只读快照（渲染层每帧读取） */
export interface BattleSnapshot {
  outcome: BattleOutcome
  baseHp: number
  baseMaxHp: number
  gold: number
  waveIndex: number
  waveTotal: number
  waveInProgress: boolean
  /** 距下一波自动开始的秒数；waveInProgress 时无意义 */
  nextWaveCountdown: number
  /** 当前游戏速度倍率 */
  speed: 1 | 2
  /** 引擎逻辑时钟（秒），驱动渲染层循环动画 */
  time: number
  enemies: readonly EnemyView[]
  towers: readonly TowerView[]
  projectiles: readonly ProjectileView[]
  floatTexts: readonly FloatTextView[]
  /** 粒子特效（死亡爆散/命中/金币/嚎叫冲击波） */
  effects: readonly EffectView[]
  /** 待选择的三选一强化（非 null 时战斗暂停） */
  draft: readonly DraftOption[] | null
  /** 地图宝箱（未开的可点击） */
  crates: readonly CrateView[]
  kills: number
}
