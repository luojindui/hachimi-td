import {
  ARMOR_K,
  ENGINE,
  LINEUP_SIZE,
  SELL_REFUND_RATIO,
  STAR_ATTACK_GROWTH,
  STAR_MAX,
  TOWER_LEVELS,
  UPGRADE_COST_FACTOR_LV2,
  UPGRADE_COST_FACTOR_LV3,
} from '../data/balance'
import { getEnemy } from '../data/enemies'
import { getEndlessWave } from '../data/levels'
import { pointAtDistance, totalPathLength } from '../path'
import type {
  BattleOutcome,
  BattleSnapshot,
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
  /** 沿路径弧长（格） */
  dist: number
  x: number
  y: number
  /** 当前减速乘数（1 = 未减速，取最强减速） */
  slowFactor: number
  slowTimer: number
  /** 被嚎叫加速的截止时刻（逻辑秒） */
  howlUntil: number
  /** 自身嚎叫冷却（仅 Boss） */
  howlTimer: number
}

interface EngineTower {
  slotIndex: number
  def: PetDef
  level: 1 | 2 | 3
  x: number
  y: number
  cooldown: number
  /** 本轮攻击间隔（用于冷却进度渲染） */
  lastInterval: number
  /** 建造 + 升级累计投入 */
  invested: number
}

interface EngineProjectile {
  uid: number
  petId: string
  /** 发射塔的可打击目标类型（溅射结算需按此过滤） */
  targets: TargetKind
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
  kind: 'gold' | 'leak'
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
  private pendingSpawns: { enemyId: string; at: number }[] = []

  private baseHp: number
  private gold = 0
  private kills = 0
  private leaks = 0

  private enemies: EngineEnemy[] = []
  private towers: (EngineTower | undefined)[] = []
  private projectiles: EngineProjectile[] = []
  private floats: EngineFloatText[] = []

  private nextEnemyUid = 1
  private nextProjUid = 1
  private nextFloatUid = 1
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
    this.baseHp = this.level.baseHp
    this.gold = this.level.startGold
    this.countdown = this.firstWaveCountdown
    this.towers = this.level.buildSlots.map(() => undefined)

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

  private towerLevelConfig(level: 1 | 2 | 3) {
    return TOWER_LEVELS[level - 1]!
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
      x: slot.x,
      y: slot.y,
      cooldown: 0,
      lastInterval: pet.attackInterval,
      invested: pet.cost,
    }
  }

  upgradeTower(slotIndex: number): void {
    this.ensureEditable()
    const tower = this.towers[slotIndex]
    if (!tower) throw new Error('该格没有宠物')
    const cost = this.upgradeCost(slotIndex)
    if (cost === null) throw new Error('已满级')
    if (this.gold < cost) throw new Error('小鱼干不足')
    this.gold -= cost
    tower.invested += cost
    tower.level = tower.level === 1 ? 2 : 3
  }

  sellTower(slotIndex: number): void {
    this.ensureEditable()
    const tower = this.towers[slotIndex]
    if (!tower) throw new Error('该格没有宠物')
    this.gold += this.sellValue(slotIndex)!
    this.towers[slotIndex] = undefined
  }

  /* ---------------- 波次控制 ---------------- */

  /** 是否处于波间倒计时（可提前召唤） */
  canCallNextWave(): boolean {
    return (
      this.phase === 'countdown' &&
      this.outcome === 'ongoing' &&
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
    if (!Number.isFinite(dtRealSeconds) || dtRealSeconds <= 0) return
    const dt = Math.min(dtRealSeconds, ENGINE.MAX_FRAME_DT)
    this.acc += dt * this.speedMultiplier
    let guard = 0
    while (this.acc >= ENGINE.LOGIC_STEP && guard < 200) {
      this.acc -= ENGINE.LOGIC_STEP
      guard++
      this.stepLogic(ENGINE.LOGIC_STEP)
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
    const spawns: { enemyId: string; at: number }[] = []
    for (const entry of wave.entries) {
      const delay = entry.delay ?? 0
      for (let i = 0; i < entry.count; i++) {
        spawns.push({
          enemyId: entry.enemyId,
          at: this.now + delay + i * entry.interval,
        })
      }
    }
    spawns.sort((a, b) => a.at - b.at)
    this.pendingSpawns = spawns
    this.activeWave = wave
    this.activeWaveIndex = this.waveIndex
    this.activeWaveAdvance = 0
    this.phase = 'active'
  }

  private spawnDue(): void {
    if (this.phase !== 'active') return
    while (this.pendingSpawns.length > 0 && this.pendingSpawns[0]!.at <= this.now) {
      const spawn = this.pendingSpawns.shift()!
      this.spawnEnemy(spawn.enemyId)
    }
  }

  private spawnEnemy(enemyId: string): void {
    const def = getEnemy(enemyId)
    const wave = this.activeWave
    const hp = Math.round(
      def.hp * this.level.hpMul * (wave?.hpMul ?? 1),
    )
    const speed =
      def.speed * this.level.speedMul * (wave?.speedMul ?? 1)
    this.enemies.push({
      uid: this.nextEnemyUid++,
      def,
      hp,
      maxHp: hp,
      speed,
      dist: 0,
      x: this.level.path[0]!.x,
      y: this.level.path[0]!.y,
      slowFactor: 1,
      slowTimer: 0,
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
      enemy.dist += enemy.speed * enemy.slowFactor * howlMul * dt
      enemy.slowTimer -= dt
      if (enemy.slowTimer <= 0) enemy.slowFactor = 1

      const at = pointAtDistance(this.level.path, enemy.dist)
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

  /** 计算塔在当前光环/星级/等级下的实际战斗属性 */
  private computeTowerStats(tower: EngineTower): {
    attack: number
    interval: number
    range: number
  } {
    const lv = this.towerLevelConfig(tower.level)
    const attackSpeedMul = 1 + this.bestAuraValue(tower, 'attackSpeed')
    const interval =
      (tower.def.attackInterval * lv.intervalMul) / attackSpeedMul
    const attack =
      tower.def.attack *
      lv.attackMul *
      this.starMul(tower.def.id) *
      (1 + this.bestAuraValue(tower, 'globalAttack'))
    return { attack, interval, range: tower.def.range + lv.rangeBonus }
  }

  /** 对外查询塔的实际属性（UI 展示 / 测试断言） */
  towerStats(slotIndex: number): {
    attack: number
    interval: number
    range: number
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
        x: tower.x,
        y: tower.y,
        targetUid: target.uid,
        lastX: target.x,
        lastY: target.y,
        damage: stats.attack,
        splash: tower.def.splash ?? 0,
        slow: tower.def.slow,
      })
      tower.cooldown = stats.interval
      tower.lastInterval = stats.interval
    }
  }

  private starMul(petId: string): number {
    const stars = clampStars(this.starLevels[petId])
    return 1 + (stars - 1) * STAR_ATTACK_GROWTH
  }

  private acquireTarget(tower: EngineTower): EngineEnemy | null {
    const lv = this.towerLevelConfig(tower.level)
    const range = tower.def.range + lv.rangeBonus
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
    // 本 tick 的敌人索引，避免每弹线性查找
    const byUid = new Map<number, EngineEnemy>()
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
    this.applyDamage(target, proj.damage)
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
        this.applyDamage(enemy, splashDamage)
        if (proj.slow) this.applySlow(enemy, proj.slow)
      }
    }
  }

  private applyDamage(enemy: EngineEnemy, rawDamage: number): void {
    if (enemy.hp <= 0) return
    // 防御：非法伤害值（NaN/负数）直接忽略，防止污染经济与生死判定
    if (!Number.isFinite(rawDamage) || rawDamage < 0) return
    const effective = rawDamage * (ARMOR_K / (ARMOR_K + enemy.def.armor))
    enemy.hp -= effective
    if (enemy.hp > 0) return

    // 击杀
    this.kills++
    const goldMul = 1 + this.goldAuraAt(enemy.x, enemy.y)
    const flat = this.flatBountyBonus()
    const gained = Math.round(enemy.def.bounty * goldMul) + flat
    this.gold += gained
    this.addFloat(`+${gained}`, enemy.x, enemy.y, 'gold')
  }

  private applySlow(enemy: EngineEnemy, spec: SlowSpec): void {
    const hasActiveSlow = enemy.slowTimer > 0
    // 减速不叠加：已有减速时，只有更强（factor 更小）或等强的减速才生效
    if (hasActiveSlow && spec.factor > enemy.slowFactor) return
    enemy.slowFactor = spec.factor
    enemy.slowTimer = spec.duration
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
    kind: 'gold' | 'leak',
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
      const granted = Math.max(0, wave.reward - this.activeWaveAdvance)
      if (granted > 0) {
        this.gold += granted
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

  private endBattle(outcome: Extract<BattleOutcome, 'victory' | 'defeat'>): void {
    this.phase = 'gameover'
    this.outcome = outcome
  }

  /* ---------------- 快照（渲染消费） ---------------- */

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
        /** 剩余冷却比例：刚发射 ≈1，就绪 =0 */
        cooldownRatio:
          t.lastInterval > 0
            ? Math.max(0, Math.min(1, t.cooldown / t.lastInterval))
            : 0,
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

    return {
      outcome: this.outcome,
      baseHp: Math.max(0, this.baseHp),
      baseMaxHp: this.level.baseHp,
      gold: this.gold,
      waveIndex: this.getCurrentWaveIndex(),
      waveTotal: this.getWaveTotal(),
      waveInProgress: this.phase === 'active',
      nextWaveCountdown:
        this.phase === 'countdown' ? Math.max(0, this.countdown) : 0,
      speed: this.speedMultiplier,
      enemies,
      towers,
      projectiles,
      floatTexts,
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
