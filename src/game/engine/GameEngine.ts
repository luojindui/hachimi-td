import {
  ARMOR_K,
  CRIT,
  DRAFT_COUNT,
  TOWER_BRANCHES,
  DRAFT_POOL,
  DRAFT_RARITY_WEIGHTS,
  ENGINE,
  LINEUP_SIZE,
  SELL_REFUND_RATIO,
  STAR_ATTACK_GROWTH,
  STAR_MAX,
  UPGRADE_COST_FACTOR_LV2,
  UPGRADE_COST_FACTOR_LV3,

  ROLE_STAR_PERKS,
} from '../data/balance'
import { getAffix } from '../data/affixes'
import type { DraftDef, TowerPath } from '../data/balance'
import type { TowerKind } from '../types'
import { getEnemy } from '../data/enemies'
import { findPet } from '../data/pets'
import { getEndlessWave } from '../data/levels'
import { cellKey, expandPathCells, pointAtDistance, totalPathLength } from '../path'
import type {
  BattleOutcome,
  BattleSnapshot,
  CrateView,
  DraftOption,
  EffectView,
  EnemyDef,
  EnemyView,
  FloatTextView,
  LevelDef,
  PetDef,
  ProjectileView,
  SlowSpec,
  TargetKind,
  TowerView,
  WaveDef,
} from '../types'

/* ===================== 内部实体 ===================== */

interface EngineEnemy {
  uid: number
  def: EnemyDef
  hp: number
  maxHp: number
  /** 本局实际移速（格/秒）= 基础速度 × 关卡速度乘数 × 波次速度乘数 */
  speed: number
  /** 精英标记（赏金 ×3） */
  elite: boolean
  /** 赏金乘数 */
  bountyMul: number
  /** 词缀 id */
  affixes: string[]
  /** 每秒回复最大生命比例（词缀） */
  regenPct: number
  /** 减速抗性（词缀） */
  frostResist: boolean
  /** 词缀护甲加值 */
  armorBonus: number
  /** 沿路径弧长（格） */
  dist: number
  x: number
  y: number
  /** 移动朝向（弧度），渲染翻转用 */
  facing: number
  /** 受击闪白截止时刻 */
  flashUntil: number
  /** 当前减速乘数（1 = 未减速，取最强减速） */
  slowFactor: number
  slowTimer: number
  /** 第二层减速（较弱者，50% 效果） */
  slow2Factor: number
  slow2Timer: number
  /** 被嚎叫加速的截止时刻（逻辑秒） */
  howlUntil: number
  /** 自身嚎叫冷却（仅 Boss） */
  howlTimer: number
}

interface EngineTower {
  slotIndex: number
  def: PetDef
  level: 1 | 2 | 3
  /** Lv2 起锁定的专精分支 */
  path: TowerPath | null
  /** 建造格地形类型 */
  kind: TowerKind
  /** 当前瞄准角（弧度，0=向右） */
  aimAngle: number
  x: number
  y: number
  cooldown: number
  /** 本轮攻击间隔（用于冷却进度渲染） */
  lastInterval: number
  /** 建造 + 升级累计投入 */
  invested: number
  /** 放置时刻（逻辑秒），渲染层放置弹跳用 */
  spawnAt: number
}

type EffectKind = 'poof' | 'hit' | 'coin' | 'howl'

interface EngineEffect {
  uid: number
  kind: EffectKind
  x: number
  y: number
  born: number
  life: number
}

interface EngineCrate {
  id: number
  x: number
  y: number
  opened: boolean
}

interface EngineProjectile {
  uid: number
  petId: string
  /** 发射塔的可打击目标类型（溅射结算需按此过滤） */
  targets: TargetKind
  /** 护甲穿透系数 */
  armorMul: number
  x: number
  y: number
  targetUid: number
  /** 目标消失后的坠点 */
  lastX: number
  lastY: number
  damage: number
  splash: number
  slow: SlowSpec | undefined
}

interface EngineFloatText {
  uid: number
  text: string
  x: number
  y: number
  life: number
  kind: 'gold' | 'leak' | 'heal'
}

type Phase = 'countdown' | 'active' | 'gameover'

export interface EngineOptions {
  level: LevelDef
  /** 编队宠物定义（1~6 只，id 唯一） */
  lineup: readonly PetDef[]
  /** petId → 星级（1~5，缺省按 1★） */
  starLevels?: Readonly<Record<string, number>>
  /** 首波准备时间（秒），缺省取引擎常量 */
  firstWaveCountdown?: number
  /** 波间倒计时（秒），缺省取引擎常量 */
  waveBreakSeconds?: number
  /** 随机源（三选一抽取/暴击判定），缺省 Math.random；测试注入 */
  rng?: () => number
  /** 是否启用波次开始的三选一强化（缺省开启；单测可关闭以保持确定性） */
  draftsEnabled?: boolean
  /** 天赋树永久加成（攻击/赏金比例、粮仓上限加值） */
  talentBonus?: {
    attack?: number
    gold?: number
    baseHp?: number
    /** 对精英伤害加成（比例） */
    eliteDamage?: number
    /** 暴击伤害加成（叠加到基础暴击倍率上） */
    critDamage?: number
    /** 波次清空奖励加成（比例） */
    waveGold?: number
    /** 每场战斗开局小鱼干 */
    instantGold?: number
  }
  /** 关卡级词缀（每日挑战等：对本关所有生成的敌人生效） */
  affixes?: string[]
  /** 图鉴收集羁绊加成（与天赋独立乘区/加区） */
  bondBonus?: {
    globalAttack?: number
    gold?: number
    baseHp?: number
    /** 仅作用于冰系宠物的攻击加成 */
    iceAttack?: number
  }
}

/** 三选一强化带来的持久加成（本局有效） */
interface DraftBuffs {
  attack: number
  intervalMul: number
  rangeMul: number
  gold: number
  splashBonus: number
  crit: number
  /** 处决阈值：敌人生命比例低于此值直接击杀（0 = 未获得） */
  execute: number
  /** 连锁闪电：命中后向最近另一敌人弹出该比例伤害（0 = 未获得） */
  chain: number
}

function emptyBuffs(): DraftBuffs {
  return {
    attack: 0,
    intervalMul: 1,
    rangeMul: 0,
    gold: 0,
    splashBonus: 0,
    crit: 0,
    execute: 0,
    chain: 0,
  }
}

function clampStars(stars: number | undefined): number {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return 1
  return Math.min(STAR_MAX, Math.max(1, Math.floor(stars)))
}

/* ===================== 引擎 ===================== */

export class GameEngine {
  private readonly level: LevelDef
  private readonly lineup: readonly PetDef[]
  private readonly starLevels: Readonly<Record<string, number>>
  private readonly pathLength: number
  private readonly firstWaveCountdown: number
  private readonly waveBreakSeconds: number

  private phase: Phase = 'countdown'
  private outcome: BattleOutcome = 'ongoing'
  private now = 0
  private countdown: number = ENGINE.FIRST_WAVE_COUNTDOWN
  /** 下一个待开始的波次下标（0 基） */
  private waveIndex = 0
  private activeWave: WaveDef | null = null
  private activeWaveIndex = -1
  /** 当前波已预支的清空奖励（提前召唤所付） */
  private activeWaveAdvance = 0
  private pendingSpawns: { enemyId: string; at: number; elite: boolean }[] = []

  private baseHp: number
  private baseMaxHp: number
  private gold = 0
  private kills = 0
  private leaks = 0

  private buffs: DraftBuffs = emptyBuffs()
  private draftOptions: readonly DraftOption[] | null = null
  private readonly draftsEnabled: boolean
  private readonly rng: () => number
  private readonly talentBaseHp: number
  private readonly talentEliteDamage: number
  private readonly talentCritDamage: number
  private readonly talentWaveGold: number
  private readonly levelAffixes: string[]
  private activeWaveAffixes: string[] = []
  /** 波间商店：下一波清空奖励 ×2（一次性） */
  private bountyBoost = false
  private readonly bondGlobalAttack: number
  private readonly bondGold: number
  private readonly bondBaseHp: number
  private readonly bondIceAttack: number
  private enemies: EngineEnemy[] = []
  private towers: (EngineTower | undefined)[] = []
  private projectiles: EngineProjectile[] = []
  private floats: EngineFloatText[] = []
  private effects: EngineEffect[] = []
  private crates: EngineCrate[] = []
  /** crates 视图缓存（openCrate 置脏后重建） */
  private cratesViewCache: CrateView[] | null = null

  private nextEnemyUid = 1
  private nextProjUid = 1
  /** uid → 敌人索引（tickProjectiles 复用，避免每 tick 重建） */
  private uidIndex = new Map<number, EngineEnemy>()
  private nextFloatUid = 1
  private nextEffectUid = 1
  private acc = 0
  private speedMultiplier: 1 | 2 = 1

  constructor(options: EngineOptions) {
    this.level = options.level
    this.lineup = options.lineup
    this.starLevels = options.starLevels ?? {}
    this.pathLength = totalPathLength(this.level.path)
    this.firstWaveCountdown =
      options.firstWaveCountdown ?? ENGINE.FIRST_WAVE_COUNTDOWN
    this.waveBreakSeconds = options.waveBreakSeconds ?? ENGINE.WAVE_BREAK_SECONDS
    this.rng = options.rng ?? Math.random
    this.draftsEnabled = options.draftsEnabled ?? true
    const talent = options.talentBonus
    const num = (v: number | undefined): number =>
      v !== undefined && Number.isFinite(v) ? v : 0
    this.talentEliteDamage = Math.max(0, num(talent?.eliteDamage))
    this.talentCritDamage = Math.max(0, num(talent?.critDamage))
    this.talentWaveGold = Math.max(0, num(talent?.waveGold))
    const bond = options.bondBonus
    this.bondGlobalAttack = num(bond?.globalAttack)
    this.bondGold = num(bond?.gold)
    this.bondBaseHp = Math.max(0, Math.floor(num(bond?.baseHp)))
    this.bondIceAttack = num(bond?.iceAttack)
    this.levelAffixes = (options.affixes ?? []).filter(
      (a) => typeof a === 'string' && a.length > 0,
    )
    this.talentBaseHp = Math.max(
      0,
      Math.min(
        this.level.baseHp,
        talent?.baseHp !== undefined && Number.isFinite(talent.baseHp)
          ? Math.floor(talent.baseHp)
          : 0,
      ),
    )
    this.baseHp =
      this.level.baseHp + this.talentBaseHp + this.bondBaseHp
    this.baseMaxHp = this.baseHp
    this.buffs = {
      ...emptyBuffs(),
      attack:
        talent?.attack !== undefined && Number.isFinite(talent.attack)
          ? talent.attack
          : 0,
      gold:
        (talent?.gold !== undefined && Number.isFinite(talent.gold)
          ? talent.gold
          : 0) + this.bondGold,
    }
    this.gold = this.level.startGold
    // 战备存款天赋：战斗开局直接入账
    this.gold += Math.max(0, Math.floor(num(talent?.instantGold)))
    this.countdown = this.firstWaveCountdown
    this.towers = this.level.buildSlots.map(() => undefined)
    this.crates = this.generateCrates()

    /* ---- 入参校验：数据问题在构造期暴露 ---- */
    const ids = new Set(this.lineup.map((p) => p.id))
    if (this.lineup.length === 0) {
      throw new Error('编队不能为空')
    }
    if (ids.size !== this.lineup.length) {
      throw new Error('编队中存在重复宠物')
    }
    if (this.lineup.length > LINEUP_SIZE) {
      throw new Error(`编队最多 ${LINEUP_SIZE} 只`)
    }
    if (!this.level.endless && this.level.waves.length < 1) {
      throw new Error('非无尽关卡至少需要 1 个波次')
    }
    if (
      !Number.isFinite(this.level.hpMul) ||
      this.level.hpMul <= 0 ||
      !Number.isFinite(this.level.speedMul) ||
      this.level.speedMul <= 0
    ) {
      throw new Error('关卡 hpMul/speedMul 必须为正的有限数')
    }
  }

  /* ---------------- 对外状态 ---------------- */

  getOutcome(): BattleOutcome {
    return this.outcome
  }

  getGold(): number {
    return this.gold
  }

  /** 当前粮仓血量（钳制到 ≥0，与快照口径一致） */
  getBaseHp(): number {
    return Math.max(0, this.baseHp)
  }

  getSpeed(): 1 | 2 {
    return this.speedMultiplier
  }

  setSpeed(multiplier: 1 | 2): void {
    this.speedMultiplier = multiplier
  }

  /**
   * 当前波次下标（0 基）：active 阶段 = 正在进行的波；
   * countdown 阶段 = 即将到来的波（UI 展示"第 X 波"语义一致）
   */
  getCurrentWaveIndex(): number {
    return this.phase === 'active' ? this.activeWaveIndex : this.waveIndex
  }

  /** 总波数；无尽模式返回 0（表示无限） */
  getWaveTotal(): number {
    return this.level.endless ? 0 : this.level.waves.length
  }

  /** 编队宠物定义（副本，防止外部污染内部状态） */
  getLineup(): readonly PetDef[] {
    return [...this.lineup]
  }

  /* ---------------- 建造 / 升级 / 出售 ---------------- */

  private towerLevelConfig(level: 1 | 2 | 3, path: TowerPath = 'quick') {
    return TOWER_BRANCHES[path].levels[level - 1]!
  }

  /** 战斗进行中才允许的经济操作 */
  private ensureEditable(): void {
    if (this.phase === 'gameover') throw new Error('战斗已结束')
  }

  upgradeCost(slotIndex: number): number | null {
    const tower = this.towers[slotIndex]
    if (!tower || tower.level >= 3) return null
    const factor =
      tower.level === 1 ? UPGRADE_COST_FACTOR_LV2 : UPGRADE_COST_FACTOR_LV3
    return Math.round(tower.def.cost * factor)
  }

  sellValue(slotIndex: number): number | null {
    const tower = this.towers[slotIndex]
    if (!tower) return null
    return Math.floor(tower.invested * SELL_REFUND_RATIO)
  }

  canPlace(slotIndex: number, petId: string): { ok: boolean; reason?: string } {
    if (this.phase === 'gameover') return { ok: false, reason: '战斗已结束' }
    const slot = this.level.buildSlots[slotIndex]
    if (!slot) return { ok: false, reason: '建造格不存在' }
    if (this.towers[slotIndex]) return { ok: false, reason: '该格已有宠物' }
    const pet = this.lineup.find((p) => p.id === petId)
    if (!pet) return { ok: false, reason: '该宠物不在编队中' }
    if (this.towers.some((t) => t?.def.id === petId)) {
      return { ok: false, reason: '该宠物已上场' }
    }
    if (this.gold < pet.cost) return { ok: false, reason: '小鱼干不足' }
    return { ok: true }
  }

  placeTower(slotIndex: number, petId: string): void {
    const check = this.canPlace(slotIndex, petId)
    if (!check.ok) throw new Error(check.reason ?? '无法放置')
    const pet = this.lineup.find((p) => p.id === petId)!
    const slot = this.level.buildSlots[slotIndex]!
    this.gold -= pet.cost
    this.towers[slotIndex] = {
      slotIndex,
      def: pet,
      level: 1,
      path: null,
      kind: slot.kind ?? 'normal',
      aimAngle: 0,
      x: slot.x,
      y: slot.y,
      cooldown: 0,
      lastInterval: pet.attackInterval,
      invested: pet.cost,
      spawnAt: this.now,
    }
  }

  /** Lv1→Lv2 必须二选一专精；Lv2→Lv3 沿用所选分支 */
  upgradeTower(slotIndex: number, branch?: TowerPath): void {
    this.ensureEditable()
    const tower = this.towers[slotIndex]
    if (!tower) throw new Error('该格没有宠物')
    const cost = this.upgradeCost(slotIndex)
    if (cost === null) throw new Error('已满级')
    if (this.gold < cost) throw new Error('小鱼干不足')
    if (tower.level === 1) {
      if (branch !== 'quick' && branch !== 'heavy') {
        throw new Error('升级到 Lv2 需要选择专精分支')
      }
      tower.path = branch
    } else if (branch && branch !== tower.path) {
      throw new Error('不能中途更换分支')
    }
    this.gold -= cost
    tower.invested += cost
    tower.level = (tower.level + 1) as 1 | 2 | 3
  }

  sellTower(slotIndex: number): void {
    this.ensureEditable()
    const tower = this.towers[slotIndex]
    if (!tower) throw new Error('该格没有宠物')
    this.gold += this.sellValue(slotIndex)!
    this.towers[slotIndex] = undefined
  }

  /* ---------------- 波次控制 ---------------- */

  /** 是否处于波间倒计时（可提前召唤）；三选一待选时不可 */
  canCallNextWave(): boolean {
    return (
      this.phase === 'countdown' &&
      this.outcome === 'ongoing' &&
      !this.draftOptions &&
      (this.level.endless || this.waveIndex < this.level.waves.length)
    )
  }

  /**
   * 提前召唤下一波：立即开始，并预支该波清空奖励的 50%
   * （预支部分在该波清空时抵扣，总奖励不变）
   */
  callNextWave(): void {
    if (!this.canCallNextWave()) throw new Error('当前无法召唤下一波')
    const nextWave = this.getWaveByIndex(this.waveIndex)
    const bonus = Math.floor(nextWave.reward * ENGINE.CALL_NEXT_BONUS_RATIO)
    this.gold += bonus
    this.addFloat(`+${bonus}`, this.basePosition().x, this.basePosition().y - 1, 'gold')
    this.countdown = 0
    this.startWaveIfDue()
    this.activeWaveAdvance = bonus
  }

  private getWaveByIndex(index: number): WaveDef {
    if (this.level.endless) return getEndlessWave(index + 1)
    const wave = this.level.waves[index]
    if (!wave) throw new Error(`波次下标越界: ${index}`)
    return wave
  }

  private basePosition() {
    return pointAtDistance(this.level.path, this.pathLength).pos
  }

  /* ---------------- 主循环 ---------------- */

  /**
   * 推进真实时长（秒）；引擎内部按固定逻辑步长积分，速度倍率在此生效。
   * 非法输入（NaN/Infinity）会被忽略。
   */
  update(dtRealSeconds: number): void {
    if (this.phase === 'gameover') return
    if (this.draftOptions) return // 三选一待选：冻结战场
    if (!Number.isFinite(dtRealSeconds) || dtRealSeconds <= 0) return
    const dt = Math.min(dtRealSeconds, ENGINE.MAX_FRAME_DT)
    this.acc += dt * this.speedMultiplier
    let guard = 0
    while (this.acc >= ENGINE.LOGIC_STEP && guard < 200) {
      this.acc -= ENGINE.LOGIC_STEP
      guard++
      this.stepLogic(ENGINE.LOGIC_STEP)
      // 批内冻结：三选一出现后不得继续消耗剩余逻辑步
      if (this.draftOptions) {
        this.acc = 0
        break
      }
      // stepLogic 会改写 phase（经 outcome 判断避免 TS 属性收窄误报）
      if (this.outcome !== 'ongoing') {
        this.acc = 0
        break
      }
    }
  }

  private stepLogic(dt: number): void {
    this.now += dt

    if (this.phase === 'countdown') {
      this.countdown -= dt
      this.startWaveIfDue()
    }

    this.spawnDue()
    this.tickBossHowls(dt)
    this.moveEnemies(dt)
    if (this.outcome !== 'ongoing') return
    this.tickTowers(dt)
    this.tickProjectiles(dt)
    this.removeDeadEnemies()
    this.tickFloats(dt)
    this.tickEffects()
    this.checkWaveCleared()
  }

  /** 移除已死亡敌人（赏金在 applyDamage 内一次性结算） */
  private removeDeadEnemies(): void {
    if (this.enemies.some((e) => e.hp <= 0)) {
      this.enemies = this.enemies.filter((e) => e.hp > 0)
    }
  }

  private startWaveIfDue(): void {
    if (this.phase !== 'countdown') return
    if (this.countdown > 0) return
    if (!this.level.endless && this.waveIndex >= this.level.waves.length) return

    const wave = this.getWaveByIndex(this.waveIndex)
    const spawns: { enemyId: string; at: number; elite: boolean }[] = []
    for (const entry of wave.entries) {
      const delay = entry.delay ?? 0
      for (let i = 0; i < entry.count; i++) {
        spawns.push({
          enemyId: entry.enemyId,
          at: this.now + delay + i * entry.interval,
          elite: entry.elite ?? false,
        })
      }
    }
    spawns.sort((a, b) => a.at - b.at)
    this.pendingSpawns = spawns
    this.activeWaveAffixes = wave.affixes ?? []
    this.pendingSpawns = spawns
    this.activeWave = wave
    this.activeWaveIndex = this.waveIndex
    this.activeWaveAdvance = 0
    this.phase = 'active'
    // 波次开始时给出三选一（冻结战场直到选择）
    if (this.draftsEnabled) this.offerDraft()
  }

  private spawnDue(): void {
    if (this.phase !== 'active') return
    while (this.pendingSpawns.length > 0 && this.pendingSpawns[0]!.at <= this.now) {
      const spawn = this.pendingSpawns.shift()!
      this.spawnEnemy(spawn.enemyId, spawn.elite)
    }
  }

  private spawnEnemy(enemyId: string, elite: boolean): void {
    const def = getEnemy(enemyId)
    const wave = this.activeWave
    const eliteHpMul = elite ? ENGINE.ELITE.HP_MUL : 1
    const eliteSpeedMul = elite ? ENGINE.ELITE.SPEED_MUL : 1
    const affixMods = this.activeEnemyAffixes()
    const affixHpMul = affixMods.hpMul
    const hp = Math.round(
      def.hp *
        this.level.hpMul *
        (wave?.hpMul ?? 1) *
        eliteHpMul *
        affixHpMul,
    )
    const speed =
      def.speed *
      this.level.speedMul *
      (wave?.speedMul ?? 1) *
      eliteSpeedMul *
      affixMods.speedMul
    // 初始朝向：沿路径第一段方向
    const p0 = this.level.path[0]!
    const p1 = this.level.path[1] ?? p0
    this.enemies.push({
      uid: this.nextEnemyUid++,
      def,
      hp,
      maxHp: hp,
      elite,
      affixes: affixMods.ids,
      regenPct: affixMods.regenPct,
      frostResist: affixMods.frostResist,
      armorBonus: affixMods.armorAdd,
      bountyMul:
        (elite ? ENGINE.ELITE.BOUNTY_MUL : 1) *
        this.levelBountyScale() *
        affixMods.bountyMul,
      speed,
      dist: 0,
      x: p0.x,
      y: p0.y,
      facing: Math.atan2(p1.y - p0.y, p1.x - p0.x),
      slowFactor: 1,
      slowTimer: 0,
      slow2Factor: 1,
      slow2Timer: 0,
      flashUntil: 0,
      howlUntil: 0,
      howlTimer: def.boss ? ENGINE.BOSS_HOWL.interval : 0,
    })
  }

  private tickBossHowls(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.def.boss) continue
      enemy.howlTimer -= dt
      if (enemy.howlTimer <= 0) {
        enemy.howlTimer = ENGINE.BOSS_HOWL.interval
        this.addEffect('howl', enemy.x, enemy.y)
        for (const other of this.enemies) {
          if (other.def.boss) continue
          other.howlUntil = this.now + ENGINE.BOSS_HOWL.duration
        }
      }
    }
  }

  private moveEnemies(dt: number): void {
    const survivors: EngineEnemy[] = []
    for (const enemy of this.enemies) {
      const howlMul =
        enemy.howlUntil > this.now ? 1 + ENGINE.BOSS_HOWL.speedBonus : 1
      const step =
        enemy.speed * this.effectiveSlow(enemy) * howlMul * dt
      enemy.dist += step
      enemy.slowTimer -= dt
      if (enemy.slowTimer <= 0) enemy.slowFactor = 1
      enemy.slow2Timer -= dt
      if (enemy.slow2Timer <= 0) enemy.slow2Factor = 1
      // 再生词缀
      if (enemy.regenPct > 0 && enemy.hp > 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * enemy.regenPct * dt)
      }

      const at = pointAtDistance(this.level.path, enemy.dist)
      // 朝向随移动方向更新（渲染层翻转用）
      const dx = at.pos.x - enemy.x
      const dy = at.pos.y - enemy.y
      if (dx * dx + dy * dy > 1e-9) {
        enemy.facing = Math.atan2(dy, dx)
      }
      enemy.x = at.pos.x
      enemy.y = at.pos.y

      if (at.done) {
        this.baseHp -= enemy.def.leakDamage
        this.leaks++
        const basePos = this.basePosition()
        this.addFloat(
          `-${enemy.def.leakDamage}`,
          Math.max(0, Math.min(basePos.x, this.level.grid.cols - 1)),
          Math.max(0, Math.min(basePos.y, this.level.grid.rows - 1)),
          'leak',
        )
        if (this.baseHp <= 0) {
          this.endBattle('defeat')
          return
        }
        continue
      }
      survivors.push(enemy)
    }
    this.enemies = survivors
  }

  /** 添加粒子特效（死亡爆散/命中/金币/嚎叫） */
  private addEffect(kind: EffectKind, x: number, y: number): void {
    const life = kind === 'poof' ? 0.5 : kind === 'hit' ? 0.25 : 0.6
    if (this.effects.length >= ENGINE.FLOAT_TEXT_MAX * 2) this.effects.shift()
    this.effects.push({
      uid: this.nextEffectUid++,
      kind,
      x,
      y,
      born: this.now,
      life,
    })
  }

  private tickEffects(): void {
    if (this.effects.length === 0) return
    this.effects = this.effects.filter(
      (e) => this.now - e.born < e.life,
    )
  }

  /** 计算塔在当前光环/星级/等级/三选一强化下的实际战斗属性 */
  private computeTowerStats(tower: EngineTower): {
    attack: number
    interval: number
    range: number
    splash: number
    armorMul: number
  } {
    const lv = this.towerLevelConfig(tower.level, tower.path ?? 'quick')
    const attackSpeedMul = 1 + this.bestAuraValue(tower, 'attackSpeed')
    const kindIntervalMul = tower.kind === 'thicket' ? 0.9 : 1
    const interval = Math.max(
      ENGINE.MIN_ATTACK_INTERVAL,
      (tower.def.attackInterval * lv.intervalMul * this.buffs.intervalMul) /
        attackSpeedMul * kindIntervalMul,
    )
    const iceBonus =
      tower.def.role === 'ice' ? 1 + this.bondIceAttack : 1
    const attack =
      tower.def.attack *
      lv.attackMul *
      this.starMul(tower.def.id) *
      (1 + this.bestAuraValue(tower, 'globalAttack') + this.bondGlobalAttack) *
      (1 + this.buffs.attack) *
      iceBonus
    const range =
      (tower.def.range +
        lv.rangeBonus +
        (tower.kind === 'high' ? 0.5 : 0)) *
      (1 + this.buffs.rangeMul)
    return {
      attack,
      interval,
      range,
      armorMul: lv.armorMul,
      // 范围扩张只对已有溅射的宠物扩张（不给单体凭空加 AoE）
      splash:
        (tower.def.splash ?? 0) > 0
          ? (tower.def.splash ?? 0) + this.buffs.splashBonus
          : 0,
    }
  }

  /** 对外查询塔的实际属性（UI 展示 / 测试断言） */
  towerStats(slotIndex: number): {
    attack: number
    interval: number
    range: number
    splash: number
    armorMul: number
    level: 1 | 2 | 3
  } | null {
    const tower = this.towers[slotIndex]
    if (!tower) return null
    return { level: tower.level, ...this.computeTowerStats(tower) }
  }

  private tickTowers(dt: number): void {
    for (const tower of this.towers) {
      if (!tower) continue
      tower.cooldown -= dt
      if (tower.cooldown > 0) continue

      const target = this.acquireTarget(tower)
      if (!target) continue

      const stats = this.computeTowerStats(tower)
      this.projectiles.push({
        uid: this.nextProjUid++,
        petId: tower.def.id,
        targets: tower.def.targets,
        armorMul: stats.armorMul,
        x: tower.x,
        y: tower.y,
        targetUid: target.uid,
        lastX: target.x,
        lastY: target.y,
        damage: stats.attack,
        splash: stats.splash,
        slow: tower.def.slow,
      })
      tower.cooldown = stats.interval
      tower.lastInterval = stats.interval
    }
  }

  private starMul(petId: string): number {
    const stars = clampStars(this.starLevels[petId])
    const base = 1 + (stars - 1) * STAR_ATTACK_GROWTH
    // ★机制解锁：3★/5★ 定位质变（取对应档位，不叠加）
    const role = findPet(petId)?.role ?? 'shooter'
    const perk = ROLE_STAR_PERKS[role]
    if (!perk) return base
    if (stars >= 5) return base * perk.at5
    if (stars >= 3) return base * perk.at3
    return base
  }

  private acquireTarget(tower: EngineTower): EngineEnemy | null {
    const range = this.computeTowerStats(tower).range
    let best: EngineEnemy | null = null
    for (const enemy of this.enemies) {
      if (!this.canHit(tower.def.targets, enemy.def.flying)) continue
      const dx = enemy.x - tower.x
      const dy = enemy.y - tower.y
      if (dx * dx + dy * dy > range * range) continue
      if (!best || enemy.dist > best.dist) best = enemy
    }
    return best
  }

  private canHit(targets: TargetKind, flying: boolean): boolean {
    if (targets === 'both') return true
    return targets === 'air' ? flying : !flying
  }

  /** 取塔能吃到的某类光环最大加成（同类光环不叠加，取最大） */
  private bestAuraValue(
    tower: EngineTower,
    kind: 'attackSpeed' | 'gold' | 'globalAttack',
  ): number {
    let best = 0
    for (const other of this.towers) {
      const aura = other?.def.aura
      if (!aura || aura.kind !== kind) continue
      const dx = other.x - tower.x
      const dy = other.y - tower.y
      if (dx * dx + dy * dy > aura.radius * aura.radius) continue
      best = Math.max(best, aura.value)
    }
    return best
  }

  private tickProjectiles(dt: number): void {
    // 本 tick 的敌人索引，避免每弹线性查找（Map 实例复用，clear 代替重建）
    this.uidIndex.clear()
    const byUid = this.uidIndex
    for (const enemy of this.enemies) byUid.set(enemy.uid, enemy)

    const survivors: EngineProjectile[] = []
    for (const proj of this.projectiles) {
      const target = byUid.get(proj.targetUid)
      if (target) {
        proj.lastX = target.x
        proj.lastY = target.y
      }
      const dx = proj.lastX - proj.x
      const dy = proj.lastY - proj.y
      const dist = Math.hypot(dx, dy)
      if (dist <= ENGINE.PROJECTILE_HIT_DIST) {
        if (target) this.impact(proj, target)
        continue
      }
      const stepRatio = (ENGINE.PROJECTILE_SPEED * dt) / Math.max(dist, 1e-6)
      proj.x += dx * Math.min(stepRatio, 1)
      proj.y += dy * Math.min(stepRatio, 1)
      survivors.push(proj)
    }
    this.projectiles = survivors
  }

  private impact(proj: EngineProjectile, target: EngineEnemy): void {
    this.addEffect('hit', target.x, target.y)
    this.applyDamage(target, proj.damage, proj.armorMul)

    // 连锁闪电：向最近的另一个可命中敌人弹出 50% 伤害
    if (this.buffs.chain > 0) {
      let best: EngineEnemy | null = null
      let bestDist = Infinity
      const range = 1.6
      for (const other of this.enemies) {
        if (other.uid === target.uid || other.hp <= 0) continue
        if (!this.canHit(proj.targets, other.def.flying)) continue
        const dx = other.x - target.x
        const dy = other.y - target.y
        const d2 = dx * dx + dy * dy
        if (d2 < bestDist && d2 <= range * range) {
          bestDist = d2
          best = other
        }
      }
      if (best) {
        this.addEffect('hit', best.x, best.y)
        this.applyDamage(best, proj.damage * this.buffs.chain, proj.armorMul)
      }
    }
    if (proj.slow) this.applySlow(target, proj.slow)

    if (proj.splash > 0) {
      const splashDamage = proj.damage * ENGINE.SPLASH_DAMAGE_RATIO
      for (const enemy of this.enemies) {
        if (enemy.uid === target.uid) continue
        // 溅射同样遵守可打击目标规则（地面炮溅射打不到飞行单位）
        if (!this.canHit(proj.targets, enemy.def.flying)) continue
        const dx = enemy.x - target.x
        const dy = enemy.y - target.y
        if (dx * dx + dy * dy > proj.splash * proj.splash) continue
        this.applyDamage(enemy, splashDamage, proj.armorMul)
        if (proj.slow) this.applySlow(enemy, proj.slow)
      }
    }
  }

  private applyDamage(
    enemy: EngineEnemy,
    rawDamage: number,
    armorMul = 1,
  ): void {
    if (enemy.hp <= 0) return
    // 防御：非法伤害值（NaN/负数）直接忽略，防止污染经济与生死判定
    if (!Number.isFinite(rawDamage) || rawDamage < 0) return
    // 会心一击强化：概率触发暴击（倍率见 balance.CRIT.DAMAGE）
    let damage = rawDamage
    if (enemy.elite) damage *= 1 + this.talentEliteDamage
    if (this.buffs.crit > 0 && this.rng() < this.buffs.crit) {
      damage *= CRIT.DAMAGE + this.talentCritDamage
    }
    const armor = Math.max(0, (enemy.def.armor + (enemy.armorBonus ?? 0)) * armorMul)
    const effective = damage * (ARMOR_K / (ARMOR_K + armor))
    enemy.hp -= effective
    // 处决者：伤害结算后生命比例低于阈值直接击杀
    if (
      this.buffs.execute > 0 &&
      enemy.hp > 0 &&
      enemy.hp <= enemy.maxHp * this.buffs.execute
    ) {
      enemy.hp = 0
    }
    enemy.flashUntil = this.now + 0.12
    if (enemy.hp > 0) return

    // 击杀：爆散 + 金币特效
    this.kills++
    const goldMul =
      (1 + this.goldAuraAt(enemy.x, enemy.y) + this.buffs.gold) *
      enemy.bountyMul
    const flat = this.flatBountyBonus()
    const gained = Math.round(enemy.def.bounty * goldMul) + flat
    this.gold += gained
    this.addFloat(`+${gained}`, enemy.x, enemy.y, 'gold')
    this.addEffect('poof', enemy.x, enemy.y)
    this.addEffect('coin', enemy.x, enemy.y - 0.4)
  }

  /** 关卡赏金缩放：L5 起 +10%/关（无尽按基础值） */
  private levelBountyScale(): number {
    const idx = Number(this.level.id)
    if (!Number.isFinite(idx)) return 1
    return 1 + 0.1 * Math.max(0, idx - 4)
  }

  private applySlow(enemy: EngineEnemy, spec: SlowSpec): void {
    // 冰抗词缀：减速量减半（factor 向 1 回半）
    const eff: SlowSpec = enemy.frostResist
      ? { ...spec, factor: 1 - (1 - spec.factor) / 2 }
      : spec
    spec = eff
    // 双层减速：更强者全额生效，较弱者提供 50% 效果的第二层
    if (enemy.slowTimer > 0 && spec.factor > enemy.slowFactor) {
      // 比现有第一层弱：作为第二层记录（若比现有第二层更强）
      if (enemy.slow2Timer <= 0 || spec.factor < enemy.slow2Factor) {
        enemy.slow2Factor = spec.factor
        enemy.slow2Timer = spec.duration
      }
      return
    }
    // 比现有第一层更强（或无减速）：旧第一层降级为第二层
    if (enemy.slowTimer > 0) {
      if (enemy.slow2Timer <= 0 || enemy.slowFactor < enemy.slow2Factor) {
        enemy.slow2Factor = enemy.slowFactor
        enemy.slow2Timer = enemy.slowTimer
      }
    }
    enemy.slowFactor = spec.factor
    enemy.slowTimer = spec.duration
  }

  /** 双层合成移速系数：s1 - (1-s2)×0.5，下限 0.35 */
  private effectiveSlow(enemy: EngineEnemy): number {
    const s1 = enemy.slowTimer > 0 ? enemy.slowFactor : 1
    if (enemy.slow2Timer > 0) {
      return Math.max(0.35, s1 - (1 - enemy.slow2Factor) * 0.5)
    }
    return s1
  }

  /* ---------------- 无尽波间商店（金币出口） ---------------- */

  private static SHOP_COST = { repair: 120, reroll: 100, bounty: 80 } as const

  shopCost(id: 'repair' | 'reroll' | 'bounty'): number {
    return GameEngine.SHOP_COST[id]
  }

  /** 下一波清空奖励 ×2 是否已激活 */
  hasBountyBoost(): boolean {
    return this.bountyBoost
  }

  /** 购买商店物品（仅无尽进行中可用） */
  shopBuy(id: 'repair' | 'reroll' | 'bounty'): void {
    this.ensureEditable()
    if (!this.level.endless) throw new Error('商店仅无尽模式可用')
    const cost = GameEngine.SHOP_COST[id]
    if (this.gold < cost) throw new Error('小鱼干不足')
    if (id === 'reroll') {
      if (!this.draftOptions) throw new Error('当前没有可重抽的三选一')
      this.gold -= cost
      this.offerDraft()
      return
    }
    this.gold -= cost
    if (id === 'repair') {
      const healed = Math.min(5, this.baseMaxHp - this.baseHp)
      this.baseHp += healed
      const basePos = this.basePosition()
      this.addFloat(`+${healed}`, basePos.x, basePos.y, 'heal')
    } else {
      this.bountyBoost = true
      const basePos = this.basePosition()
      this.addFloat('下一波奖励 ×2', basePos.x, basePos.y, 'gold')
    }
  }

  /** 下一波敌人构成预览（倒计时阶段） */
  private nextWavePreview(): {
    enemyId: string
    name: string
    count: number
  }[] {
    if (this.phase !== 'countdown') return []
    try {
      const wave = this.getWaveByIndex(this.waveIndex)
      const counter = new Map<string, number>()
      for (const entry of wave.entries) {
        counter.set(entry.enemyId, (counter.get(entry.enemyId) ?? 0) + entry.count)
      }
      return [...counter.entries()].map(([enemyId, count]) => ({
        enemyId,
        name: getEnemy(enemyId).name,
        count,
      }))
    } catch {
      return []
    }
  }

  /** 当前生效的词缀修饰聚合 */
  private activeEnemyAffixes(): {
    ids: string[]
    hpMul: number
    speedMul: number
    armorAdd: number
    bountyMul: number
    regenPct: number
    frostResist: boolean
  } {
    const ids = [...this.levelAffixes, ...this.activeWaveAffixes]
    const mods = {
      ids,
      hpMul: 1,
      speedMul: 1,
      armorAdd: 0,
      bountyMul: 1,
      regenPct: 0,
      frostResist: false,
    }
    for (const id of ids) {
      try {
        const a = getAffix(id)
        if (a.hpMul) mods.hpMul *= a.hpMul
        if (a.speedMul) mods.speedMul *= a.speedMul
        if (a.armorAdd) mods.armorAdd += a.armorAdd
        if (a.bountyMul) mods.bountyMul *= a.bountyMul
        if (a.regenPct) mods.regenPct += a.regenPct
        if (a.frostResist) mods.frostResist = true
      } catch {
        /* 未知词缀忽略 */
      }
    }
    return mods
  }

  /** 在场单位提供的波次清空奖励加成（取最大，不叠加） */
  private waveGoldBonus(): number {
    let best = 0
    for (const tower of this.towers) {
      const aura = tower?.def.aura
      if (!aura || aura.kind !== 'waveGold') continue
      best = Math.max(best, aura.value)
    }
    return best
  }

  /** 击杀点吃到的赏金光环最大加成 */
  private goldAuraAt(x: number, y: number): number {
    let best = 0
    for (const tower of this.towers) {
      const aura = tower?.def.aura
      if (!aura || aura.kind !== 'gold') continue
      const dx = tower.x - x
      const dy = tower.y - y
      if (dx * dx + dy * dy > aura.radius * aura.radius) continue
      best = Math.max(best, aura.value)
    }
    return best
  }

  private flatBountyBonus(): number {
    let sum = 0
    for (const tower of this.towers) {
      if (tower?.def.passive?.kind === 'bountyFlat') {
        sum += tower.def.passive.value
      }
    }
    return sum
  }

  private addFloat(
    text: string,
    x: number,
    y: number,
    kind: 'gold' | 'leak' | 'heal',
  ): void {
    if (this.floats.length >= ENGINE.FLOAT_TEXT_MAX) this.floats.shift()
    this.floats.push({
      uid: this.nextFloatUid++,
      text,
      x,
      y,
      life: ENGINE.FLOAT_TEXT_LIFE,
      kind,
    })
  }

  private tickFloats(dt: number): void {
    this.floats = this.floats.filter((f) => {
      f.life -= dt
      return f.life > 0
    })
  }

  private checkWaveCleared(): void {
    if (this.phase !== 'active') return
    if (this.pendingSpawns.length > 0) return
    if (this.enemies.length > 0) return

    const wave = this.activeWave
    if (wave) {
      const waveGoldBonus =
        this.waveGoldBonus() + this.talentWaveGold + this.bondGold
      const boost = this.bountyBoost ? 2 : 1
      this.bountyBoost = false
      const granted = Math.max(
        0,
        Math.round(
          (wave.reward - this.activeWaveAdvance) *
            (1 + waveGoldBonus) *
            boost,
        ),
      )
      if (granted > 0) {
        this.gold += granted
      }
      // 金矿格产出（每波清空 +40/座，与波奖励无关）
      const mineGold = this.towers.filter((t) => t?.kind === 'mine').length * 40
      if (mineGold > 0) {
        this.gold += mineGold
        const basePos = this.basePosition()
        this.addFloat(
          `+${granted}`,
          Math.max(0, Math.min(basePos.x, this.level.grid.cols - 1)),
          Math.max(0, Math.min(basePos.y, this.level.grid.rows - 1)),
          'gold',
        )
      }
    }
    this.activeWave = null
    this.activeWaveAdvance = 0

    if (
      !this.level.endless &&
      this.activeWaveIndex >= this.level.waves.length - 1
    ) {
      this.endBattle('victory')
      return
    }
    this.waveIndex = this.activeWaveIndex + 1
    this.phase = 'countdown'
    this.countdown = this.waveBreakSeconds
  }

  /* ---------------- 地图宝箱 ---------------- */

  /** 按关卡 id 确定性生成 2~3 个宝箱（位置稳定，重开一局在同一位置） */
  private generateCrates(): EngineCrate[] {
    const { cols, rows } = this.level.grid
    const pathCells = expandPathCells(this.level.path)
    const blocked = new Set([
      ...pathCells,
      ...this.level.buildSlots.map((s) => cellKey(s.x, s.y)),
    ])
    // 字符串哈希作种子
    let seed = 2166136261
    for (const ch of this.level.id) {
      seed = (seed ^ ch.charCodeAt(0)) >>> 0
      seed = Math.imul(seed, 16777619) >>> 0
    }
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 0xffffffff
    }
    const crates: EngineCrate[] = []
    const used = new Set<string>()
    const target = 2 + Math.floor(rand() * 2) // 2~3 个
    let guard = 0
    while (crates.length < target && guard < 200) {
      guard++
      const x = Math.floor(rand() * cols)
      const y = Math.floor(rand() * rows)
      const key = cellKey(x, y)
      if (blocked.has(key) || used.has(key)) continue
      used.add(key)
      crates.push({ id: crates.length + 1, x, y, opened: false })
    }
    return crates
  }

  /** 是否存在可开启的宝箱（指定格） */
  crateAt(x: number, y: number): number | null {
    const crate = this.crates.find((c) => !c.opened && c.x === x && c.y === y)
    return crate ? crate.id : null
  }

  /** 开宝箱：获得小鱼干（40~80，10% 概率翻倍） */
  openCrate(crateId: number): { gold: number } | null {
    this.cratesViewCache = null
    this.ensureEditable()
    const crate = this.crates.find((c) => c.id === crateId)
    if (!crate || crate.opened) return null
    crate.opened = true
    let gold = 40 + Math.floor(this.rng() * 41)
    if (this.rng() < 0.1) gold *= 2
    this.gold += gold
    this.addFloat(`+${gold}`, crate.x, crate.y - 0.3, 'gold')
    this.addEffect('coin', crate.x, crate.y)
    return { gold }
  }

  /* ---------------- 肉鸽三选一 ---------------- */

  /** 当前待选的完整强化定义（含 kind/value），投影为 draftOptions 展示 */
  private draftPool: readonly DraftDef[] | null = null

  /** 波次清空后随机抽 3 个不重复强化供选择；选择前战斗冻结 */
  private offerDraft(): void {
    const pool = [...DRAFT_POOL]
    const picks: DraftDef[] = []
    for (let i = 0; i < DRAFT_COUNT && pool.length > 0; i++) {
      // 加权采样：common 3 / rare 2 / epic 1（稀有度分层）
      const total = pool.reduce((sum, d) => sum + DRAFT_RARITY_WEIGHTS[d.rarity], 0)
      let roll = this.rng() * total
      let idx = pool.length - 1
      for (let j = 0; j < pool.length; j++) {
        roll -= DRAFT_RARITY_WEIGHTS[pool[j]!.rarity]
        if (roll < 0) {
          idx = j
          break
        }
      }
      picks.push(pool.splice(idx, 1)[0]!)
    }
    this.draftPool = picks
    this.draftOptions = picks.map((p) => ({
      id: p.id,
      name: p.name,
      desc: p.desc,
      rarity: p.rarity,
    }))
  }

  /** 是否有等待选择的三选一 */
  hasPendingDraft(): boolean {
    return this.draftOptions !== null
  }

  /** 选择一个强化并立即生效，战斗恢复 */
  pickDraft(index: number): void {
    if (this.outcome !== 'ongoing') throw new Error('战斗已结束')
    if (!this.draftPool) throw new Error('当前没有待选的三选一')
    const opt = this.draftPool[index]
    if (!opt) throw new Error('选项不存在')
    this.applyDraft(opt)
    this.draftPool = null
    this.draftOptions = null
  }

  private applyDraft(opt: DraftDef): void {
    switch (opt.kind) {
      case 'attack':
        this.buffs.attack += opt.value
        break
      case 'interval':
        this.buffs.intervalMul *= opt.value
        break
      case 'range':
        this.buffs.rangeMul += opt.value
        break
      case 'gold':
        this.buffs.gold += opt.value
        break
      case 'splash':
        this.buffs.splashBonus += opt.value
        break
      case 'crit':
        this.buffs.crit = Math.min(
          CRIT.CHANCE_CAP,
          this.buffs.crit + opt.value,
        )
        break
      case 'fortify':
        this.baseMaxHp += opt.value
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + opt.value)
        break
      case 'instantGold':
        this.gold += opt.value
        break
      case 'execute':
        this.buffs.execute = opt.value
        break
      case 'chain':
        this.buffs.chain = opt.value
        break
      default: {
        // 穷举守卫：新增 DraftKind 时漏写 case 会在编译期报错
        const _exhaustive: never = opt.kind
        return _exhaustive
      }
    }
  }

  private endBattle(outcome: Extract<BattleOutcome, 'victory' | 'defeat'>): void {
    this.phase = 'gameover'
    this.outcome = outcome
    // 清理待选状态，防止结算画面下遮罩常驻
    this.draftPool = null
    this.draftOptions = null
  }

  /* ---------------- 快照（渲染消费） ---------------- */

  /** crates 视图缓存：openCrate 置脏后重建 */
  private getCratesView(): CrateView[] {
    if (this.cratesViewCache) return this.cratesViewCache
    const view = this.crates.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      opened: c.opened,
    }))
    this.cratesViewCache = view
    return view
  }

  getSnapshot(): BattleSnapshot {
    const enemies: EnemyView[] = this.enemies.map((e) => ({
      id: e.uid,
      enemyId: e.def.id,
      x: e.x,
      y: e.y,
      hp: Math.max(0, e.hp),
      maxHp: e.maxHp,
      flying: e.def.flying,
      boss: e.def.boss,
      slowed: e.slowTimer > 0,
      howled: e.howlUntil > this.now,
      flash: e.flashUntil > this.now,
      facing: e.facing,
      elite: e.elite,
      affixes: e.affixes,
    }))
    const towers: TowerView[] = this.towers
      .filter((t): t is EngineTower => t !== undefined)
      .map((t) => ({
        id: `slot-${t.slotIndex}`,
        petId: t.def.id,
        slotIndex: t.slotIndex,
        x: t.x,
        y: t.y,
        level: t.level,
        path: t.path,
        kind: t.kind,
        aimAngle: t.aimAngle,
        /** 剩余冷却比例：刚发射 ≈1，就绪 =0 */
        cooldownRatio:
          t.lastInterval > 0
            ? Math.max(0, Math.min(1, t.cooldown / t.lastInterval))
            : 0,
        spawnAt: t.spawnAt,
      }))
    const projectiles: ProjectileView[] = this.projectiles.map((p) => ({
      id: p.uid,
      petId: p.petId,
      x: p.x,
      y: p.y,
      angle: Math.atan2(p.lastY - p.y, p.lastX - p.x),
    }))
    const floatTexts: FloatTextView[] = this.floats.map((f) => ({
      id: f.uid,
      text: f.text,
      x: f.x,
      y: f.y,
      life: f.life,
      kind: f.kind,
    }))
    const effects: EffectView[] = this.effects.map((e) => ({
      id: e.uid,
      x: e.x,
      y: e.y,
      kind: e.kind,
      progress: Math.max(0, Math.min(1, (this.now - e.born) / e.life)),
    }))
    const crates = this.getCratesView()

    return {
      outcome: this.outcome,
      baseHp: Math.max(0, this.baseHp),
      baseMaxHp: this.baseMaxHp,
      gold: this.gold,
      waveIndex: this.getCurrentWaveIndex(),
      waveTotal: this.getWaveTotal(),
      waveInProgress: this.phase === 'active',
      affixes: [...this.levelAffixes, ...this.activeWaveAffixes],
      bountyBoost: this.bountyBoost,
      nextWavePreview: this.nextWavePreview(),
      nextWaveCountdown:
        this.phase === 'countdown' ? Math.max(0, this.countdown) : 0,
      speed: this.speedMultiplier,
      time: this.now,
      enemies,
      towers,
      projectiles,
      floatTexts,
      effects,
      crates,
      draft: this.draftOptions ? [...this.draftOptions] : null,
      kills: this.kills,
    }
  }

  /** 调试/结算：漏怪数 */
  getLeaks(): number {
    return this.leaks
  }
}

/* ===================== 星级结算 ===================== */

/** 通关=1★；血量>60%=2★；满血=3★ */
export function starsFor(baseHp: number, baseMaxHp: number): 1 | 2 | 3 {
  if (baseMaxHp <= 0) return 1
  if (baseHp >= baseMaxHp) return 3
  if (baseHp > baseMaxHp * 0.6) return 2
  return 1
}
