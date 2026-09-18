import { defineStore } from 'pinia'

import {
  ENDLESS,
  GACHA,
  LINEUP_SIZE,
  NEW_GAME,
  STAR_MILESTONES,
  STAR_UP_CATNIP,
  STAR_UP_RARITY_MUL,
  STAR_UP_SHARDS,
  TALENTS,
} from '@/game/data/balance'
import { getPet, findPet, PET_POOL } from '@/game/data/pets'
import { listLevels } from '@/game/data/levels'
import type { Rarity } from '@/game/types'
import type { OwnedPet, LevelRecord, SaveDataV1 } from './types'

export type { OwnedPet, LevelRecord, SaveDataV1 }

/* ===================== 抽卡结果 ===================== */

export interface DrawResult {
  petId: string
  rarity: Rarity
  /** 是否新获得（false = 转碎片） */
  isNew: boolean
  /** 重复转化成的碎片数 */
  shardsGained: number
}

const SAVE_VERSION = 1
const DAILY_REWARD = 150
const SAVE_KEY = 'hachimi-td:save:v1'
const CORRUPTED_KEY = 'hachimi-td:backup:corrupted'

/** 安全取非负整数：非有限数字返回 null（防损坏档 NaN 污染） */
function finiteInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.floor(value))
}

function freshSave(): SaveDataV1 {
  return {
    version: SAVE_VERSION,
    currencies: { catnip: NEW_GAME.catnip },
    pets: NEW_GAME.starterPetIds.map((id) => ({ id, stars: 1, shards: 0 })),
    lineup: [...NEW_GAME.starterPetIds],
    levels: {},
    endless: { bestWave: 0, claimedMilestones: [] },
    gacha: { totalDraws: 0, srPity: 0, ssrPity: 0, firstTenDone: false },
    starMilestones: [],
    talents: [],
    daily: { lastClaimDate: '' },
    stats: { totalKills: 0, battlesWon: 0 },
  }
}

/** 中性空档（补默认值用；注意与新档 freshSave 区分——补缺不发初始宠物） */
function emptySave(): SaveDataV1 {
  return {
    version: SAVE_VERSION,
    currencies: { catnip: 0 },
    pets: [],
    lineup: [],
    levels: {},
    endless: { bestWave: 0, claimedMilestones: [] },
    gacha: { totalDraws: 0, srPity: 0, ssrPity: 0, firstTenDone: false },
    starMilestones: [],
    talents: [],
    daily: { lastClaimDate: '' },
    stats: { totalKills: 0, battlesWon: 0 },
  }
}

/** 把任意来源的对象修整成合法存档（缺字段填中性默认值、越界值收敛） */
function hydrate(raw: unknown): SaveDataV1 {
  const out = emptySave()
  if (typeof raw !== 'object' || raw === null) return out
  const r = raw as Record<string, unknown>

  if (typeof r.version === 'number') out.version = r.version
  if (typeof r.currencies === 'object' && r.currencies !== null) {
    const c = r.currencies as { catnip?: unknown }
    if (typeof c.catnip === 'number' && Number.isFinite(c.catnip)) {
      out.currencies.catnip = Math.max(0, Math.floor(c.catnip))
    }
  }
  if (Array.isArray(r.pets)) {
    out.pets = r.pets
      .filter(
        (p): p is OwnedPet =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as OwnedPet).id === 'string',
      )
      // 只保留真实存在的宠物 id，防止导入/损坏档让 getPet() 抛错白屏
      .filter((p) => findPet(p.id) !== undefined)
      .map((p) => ({
        id: p.id,
        stars: Math.min(5, Math.max(1, finiteInt(p.stars, 1))),
        shards: finiteInt(p.shards, 0),
      }))
  }
  if (Array.isArray(r.lineup)) {
    const ownedIds = new Set(out.pets.map((p) => p.id))
    out.lineup = r.lineup
      .filter((id): id is string => typeof id === 'string' && ownedIds.has(id))
      .slice(0, LINEUP_SIZE)
  }
  if (typeof r.levels === 'object' && r.levels !== null) {
    const levels: Record<string, LevelRecord> = {}
    for (const [key, value] of Object.entries(r.levels as Record<string, unknown>)) {
      if (typeof value === 'object' && value !== null) {
        const v = value as Partial<LevelRecord>
        levels[key] = {
          stars: Math.min(3, finiteInt(v.stars, 0)),
          cleared: Boolean(v.cleared),
        }
      }
    }
    out.levels = levels
  }
  if (typeof r.endless === 'object' && r.endless !== null) {
    const e = r.endless as { bestWave?: unknown; claimedMilestones?: unknown }
    out.endless.bestWave = finiteInt(e.bestWave, 0)
    if (Array.isArray(e.claimedMilestones)) {
      out.endless.claimedMilestones = e.claimedMilestones.filter(
        (n): n is number =>
          typeof n === 'number' && Number.isInteger(n) && n > 0,
      )
    }
  }
  if (typeof r.gacha === 'object' && r.gacha !== null) {
    const g = r.gacha as Record<string, unknown>
    out.gacha = {
      totalDraws: finiteInt(g.totalDraws, 0),
      srPity: finiteInt(g.srPity, 0),
      ssrPity: finiteInt(g.ssrPity, 0),
      firstTenDone: Boolean(g.firstTenDone),
    }
  }
  if (Array.isArray(r.starMilestones)) {
    out.starMilestones = r.starMilestones.filter(
      (n): n is number =>
        typeof n === 'number' && Number.isInteger(n) && n > 0,
    )
  }
  if (Array.isArray(r.talents)) {
    const valid = new Set(TALENTS.map((t) => t.id))
    out.talents = r.talents.filter(
      (id): id is string => typeof id === 'string' && valid.has(id),
    )
  }
  if (typeof r.daily === 'object' && r.daily !== null) {
    const d = r.daily as { lastClaimDate?: unknown }
    out.daily.lastClaimDate =
      typeof d.lastClaimDate === 'string' ? d.lastClaimDate : ''
  }
  if (typeof r.stats === 'object' && r.stats !== null) {
    const s = r.stats as { totalKills?: unknown; battlesWon?: unknown }
    out.stats = {
      totalKills: finiteInt(s.totalKills, 0),
      battlesWon: finiteInt(s.battlesWon, 0),
    }
  }
  return out
}

/* ===================== 迁移链（版本升级时逐级执行） ===================== */

type Migration = (data: Record<string, unknown>) => Record<string, unknown>

/** index v → v+1；当前只有 v1，占位示意迁移机制 */
const MIGRATIONS: Record<number, Migration> = {}

function migrate(data: SaveDataV1): SaveDataV1 {
  let current = data as unknown as Record<string, unknown>
  let version = data.version
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) break
    current = step(current)
    version = (current.version as number) ?? version + 1
  }
  return hydrate({ ...current, version })
}

/* ===================== 存取工具 ===================== */

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 忽略 */
  }
}

/* ===================== Store 内部辅助 ===================== */

interface ProfileShape {
  catnip: number
  pets: OwnedPet[]
  lineup: string[]
  levels: Record<string, LevelRecord>
  endless: { bestWave: number; claimedMilestones: number[] }
  gacha: { totalDraws: number; srPity: number; ssrPity: number; firstTenDone: boolean }
  starMilestones: number[]
  talents: string[]
  daily: { lastClaimDate: string }
  stats: { totalKills: number; battlesWon: number }
}

function applySaveTo(store: ProfileShape, data: SaveDataV1): void {
  store.catnip = data.currencies.catnip
  store.pets = data.pets
  store.lineup = data.lineup
  store.levels = data.levels
  store.endless = { ...data.endless }
  store.gacha = { ...data.gacha }
  store.starMilestones = [...data.starMilestones]
  store.talents = [...data.talents]
  store.daily = { ...data.daily }
  store.stats = { ...data.stats }
}

/* ===================== 抽卡内部逻辑（模块级，store action 薄封装） ===================== */

interface GachaShape {
  catnip: number
  pets: OwnedPet[]
  gacha: { totalDraws: number; srPity: number; ssrPity: number; firstTenDone: boolean }
}

/** 从对应稀有度卡池随机选一只并入库（新宠 or 转碎片） */
function grantDraw(
  store: GachaShape,
  rarity: 'N' | 'R' | 'SR' | 'SSR',
): DrawResult {
  const pool = PET_POOL[rarity]
  const petId = pool[Math.floor(Math.random() * pool.length)]!
  const owned = store.pets.find((p) => p.id === petId)

  if (owned) {
    const shards = GACHA.DUPE_SHARDS[rarity]
    owned.shards += shards
    return { petId, rarity, isNew: false, shardsGained: shards }
  }
  store.pets.push({ id: petId, stars: 1, shards: 0 })
  return { petId, rarity, isNew: true, shardsGained: 0 }
}

/** 强制生成指定稀有度的结果（保底用），同步更新计数器 */
function forceRarityDraw(
  store: GachaShape,
  rarity: 'R' | 'SR' | 'SSR',
): DrawResult {
  if (rarity === 'SSR') {
    store.gacha.ssrPity = 0
    store.gacha.srPity = 0
  } else if (rarity === 'SR') {
    store.gacha.srPity = 0
  }
  return grantDraw(store, rarity)
}

/** 按概率 roll 一次（含保底检查与计数器更新） */
function rollDraw(store: GachaShape, rng: () => number): DrawResult {
  store.gacha.ssrPity++
  store.gacha.srPity++

  let rarity: 'N' | 'R' | 'SR' | 'SSR'
  if (store.gacha.ssrPity >= GACHA.SSR_PITY) {
    rarity = 'SSR'
  } else if (store.gacha.srPity >= GACHA.SR_PITY) {
    rarity = 'SR'
  } else {
    const r = rng()
    if (r < GACHA.RATES.SSR) rarity = 'SSR'
    else if (r < GACHA.RATES.SSR + GACHA.RATES.SR) rarity = 'SR'
    else if (r < GACHA.RATES.SSR + GACHA.RATES.SR + GACHA.RATES.R) rarity = 'R'
    else rarity = 'N'
  }

  if (rarity === 'SSR') {
    store.gacha.ssrPity = 0
    store.gacha.srPity = 0
  } else if (rarity === 'SR') {
    store.gacha.srPity = 0
  }

  return grantDraw(store, rarity)
}

/* ===================== Store ===================== */

export const useProfileStore = defineStore('profile', {
  state: (): ProfileShape & { persistent: boolean; recoveredFromCorruption: boolean; initialized: boolean } => ({
    catnip: 0,
    pets: [],
    lineup: [],
    levels: {},
    endless: { bestWave: 0, claimedMilestones: [] },
    gacha: { totalDraws: 0, srPity: 0, ssrPity: 0, firstTenDone: false },
    starMilestones: [],
    stats: { totalKills: 0, battlesWon: 0 },
    /** 已购买的天赋节点 id */
    talents: [] as string[],
    daily: { lastClaimDate: '' },
    /** 当前环境是否可持久化（false = 无痕模式，仅内存） */
    persistent: true,
    /** 上次装载是否为损坏恢复（用于 UI 提示） */
    recoveredFromCorruption: false,
    initialized: false,
  }),

  getters: {
    totalStars(state): number {
      return Object.values(state.levels).reduce((sum, l) => sum + l.stars, 0)
    },
    /** 已解锁的普通关卡 id 列表（第 n 关解锁条件：第 n-1 关已通关；第 1 关默认解锁） */
    unlockedLevelIds(state): string[] {
      const unlocked: string[] = []
      for (const level of listLevels()) {
        if (level.id === '1' || state.levels[String(Number(level.id) - 1)]?.cleared) {
          unlocked.push(level.id)
        } else {
          break
        }
      }
      return unlocked
    },
    endlessUnlocked(state): boolean {
      return Boolean(state.levels['8']?.cleared)
    },
    ownedPetIds(state): string[] {
      return state.pets.map((p) => p.id)
    },
    /** 天赋带来的永久加成（传入战斗引擎） */
    talentBonus(state): { attack: number; gold: number; baseHp: number } {
      const bonus = { attack: 0, gold: 0, baseHp: 0 }
      for (const id of state.talents) {
        const node = TALENTS.find((t) => t.id === id)
        if (!node) continue
        if (node.effect.kind === 'attack') bonus.attack += node.effect.value
        else if (node.effect.kind === 'gold') bonus.gold += node.effect.value
        else if (node.effect.kind === 'baseHp') bonus.baseHp += node.effect.value
      }
      return bonus
    },
  },

  actions: {
    /** 启动时装载存档；无档则开新档 */
    init(): void {
      if (this.initialized) return
      const raw = storageGet(SAVE_KEY)
      if (raw === null) {
        applySaveTo(this, freshSave())
      } else {
        try {
          const parsed: unknown = JSON.parse(raw)
          const version = (parsed as SaveDataV1)?.version
          if (typeof version !== 'number' || version < 1) {
            throw new Error('存档版本非法')
          }
          applySaveTo(this, migrate(hydrate(parsed)))
        } catch {
          // 损坏档备份后开新档
          storageSet(CORRUPTED_KEY, raw)
          storageRemove(SAVE_KEY)
          this.recoveredFromCorruption = true
          applySaveTo(this, freshSave())
        }
      }
      // 探测持久化可用性
      this.persistent = storageSet(SAVE_KEY, this.serialize())
      this.initialized = true
    },

    serialize(): string {
      const data: SaveDataV1 = {
        version: SAVE_VERSION,
        currencies: { catnip: this.catnip },
        pets: this.pets,
        lineup: this.lineup,
        levels: this.levels,
        endless: this.endless,
        gacha: this.gacha,
        starMilestones: this.starMilestones,
        daily: this.daily,
        talents: this.talents,
        stats: this.stats,
      }
      return JSON.stringify(data)
    },

    persist(): void {
      if (this.persistent) {
        storageSet(SAVE_KEY, this.serialize())
      }
    },

    /** 直接增加猫薄荷（弹珠机等玩法奖励）；非法/非正数忽略 */
    addCatnip(amount: number): void {
      if (!Number.isFinite(amount) || amount <= 0) return
      this.catnip += Math.floor(amount)
      this.persist()
    },

    /** 消耗猫薄荷：余额不足返回 false（弹珠机/孵蛋等扣费入口） */
    spendCatnip(amount: number): boolean {
      if (!Number.isFinite(amount) || amount <= 0) return false
      const cost = Math.floor(amount)
      if (this.catnip < cost) return false
      this.catnip -= cost
      this.persist()
      return true
    },

    /* ---------------- 天赋树 ---------------- */

    /** 天赋是否可购买（星数门槛 + 前置节点 + 未拥有） */
    canBuyTalent(nodeId: string): boolean {
      const node = TALENTS.find((t) => t.id === nodeId)
      if (!node) return false
      if (this.talents.includes(nodeId)) return false
      if (this.totalStars < node.starReq) return false
      const prereq = TALENTS.find(
        (t) => t.branch === node.branch && t.tier === node.tier - 1,
      )
      if (prereq && !this.talents.includes(prereq.id)) return false
      return this.catnip >= node.cost
    },

    /** 购买天赋节点 */
    buyTalent(nodeId: string): boolean {
      if (!this.canBuyTalent(nodeId)) return false
      const node = TALENTS.find((t) => t.id === nodeId)!
      this.catnip -= node.cost
      this.talents.push(nodeId)
      this.persist()
      return true
    },

    /* ---------------- 每日挑战 ---------------- */

    /** 领取每日挑战首通奖励（同一天只发一次） */
    claimDaily(date: string): number {
      if (this.daily.lastClaimDate === date) return 0
      this.daily.lastClaimDate = date
      this.catnip += DAILY_REWARD
      this.persist()
      return DAILY_REWARD
    },

    /** 编辑出战编队（去重、限 6 只、仅限已拥有） */
    setLineup(ids: string[]): void {
      const owned = new Set(this.pets.map((p) => p.id))
      const unique = [...new Set(ids)].filter((id) => owned.has(id))
      this.lineup = unique.slice(0, LINEUP_SIZE)
      this.persist()
    },

    /** 关卡结算：首通/重复奖励 + 星级记录 + 星数里程碑 */
    completeLevel(levelId: string, rawStars: number, kills: number): {
      catnipGained: number
      firstClear: boolean
    } {
      const level = listLevels().find((l) => l.id === levelId)
      if (!level) return { catnipGained: 0, firstClear: false }
      const stars = Math.min(3, Math.max(1, Math.floor(rawStars)))

      const record = this.levels[levelId]
      const firstClear = !record?.cleared
      let gained = firstClear ? level.firstClearCatnip : level.repeatClearCatnip

      this.levels[levelId] = {
        cleared: true,
        stars: Math.max(record?.stars ?? 0, stars),
      }
      this.stats.battlesWon++
      this.stats.totalKills += kills

      // 星数里程碑（只发一次）
      for (const milestone of STAR_MILESTONES) {
        if (
          this.starMilestones.includes(milestone.stars) ||
          this.totalStars < milestone.stars
        ) {
          continue
        }
        this.starMilestones.push(milestone.stars)
        gained += milestone.catnip
      }

      this.catnip += gained
      this.persist()
      return { catnipGained: gained, firstClear }
    },

    /** 无尽结算：记录最佳波数 + 领取一次性里程碑 */
    recordEndless(wave: number, kills: number): { catnipGained: number } {
      let gained = 0
      if (wave > this.endless.bestWave) {
        for (
          let w = ENDLESS.MILESTONE_WAVE;
          w <= wave;
          w += ENDLESS.MILESTONE_WAVE
        ) {
          if (!this.endless.claimedMilestones.includes(w)) {
            this.endless.claimedMilestones.push(w)
            gained += ENDLESS.MILESTONE_CATNIP
          }
        }
        this.endless.bestWave = wave
      }
      this.stats.totalKills += kills
      this.catnip += gained
      this.persist()
      return { catnipGained: gained }
    },

    /** 重置存档（开新档） */
    resetSave(): void {
      applySaveTo(this, freshSave())
      this.recoveredFromCorruption = false
      this.persist()
    },

    /** 导出存档文本 */
    exportSave(): string {
      return this.serialize()
    },

    /** 导入存档：版本合法（不高于当前版本）且解析成功才覆盖 */
    importSave(text: string): boolean {
      try {
        const parsed: unknown = JSON.parse(text)
        const version = (parsed as SaveDataV1)?.version
        if (typeof version !== 'number' || version < 1) return false
        if (version > SAVE_VERSION) return false // 未来版本档拒绝导入
        applySaveTo(this, migrate(hydrate(parsed)))
        this.persist()
        return true
      } catch {
        return false
      }
    },

    /* ---------------- 抽卡 ---------------- */

    /**
     * 单次抽取（含保底）。rng 仅供测试注入，默认 Math.random。
     * 保底规则（"最多 N 抽内必出"语义）：
     * - 连续 GACHA.SSR_PITY 抽未出 SSR → 该抽强制 SSR（计数器出 SSR 归零）
     * - 连续 GACHA.SR_PITY 抽未出 SR+ → 该抽强制 SR+（出 SR+ 归零）
     */
    drawOnce(rng: () => number = Math.random): DrawResult {
      if (this.catnip < GACHA.SINGLE_COST) throw new Error('猫薄荷不足')
      this.catnip -= GACHA.SINGLE_COST
      this.gacha.totalDraws++
      const result = rollDraw(this, rng)
      this.persist()
      return result
    },

    /**
     * 十连（9 折价）。必出 ≥1 只 R+；首次十连必出 ≥1 只 SR+。
     * 实现：先正常抽 9 抽，第 10 抽作为保底兜底位——若前 9 抽未满足保底，
     * 第 10 抽强制对应稀有度（不产生额外掉落，杜绝"替换式双发"）。
     */
    drawTen(rng: () => number = Math.random): DrawResult[] {
      if (this.catnip < GACHA.MULTI_COST) throw new Error('猫薄荷不足')
      this.catnip -= GACHA.MULTI_COST

      const results: DrawResult[] = []
      for (let i = 0; i < GACHA.MULTI_SIZE - 1; i++) {
        this.gacha.totalDraws++
        results.push(rollDraw(this, rng))
      }

      const hasRPlus = results.some(
        (r) => r.rarity === 'R' || r.rarity === 'SR' || r.rarity === 'SSR',
      )
      const hasSrPlus = results.some(
        (r) => r.rarity === 'SR' || r.rarity === 'SSR',
      )

      // 第 10 抽：新手保底（SR+）优先于普通 R+ 保底
      let backstop: 'R' | 'SR' | 'SSR' | null = null
      if (!this.gacha.firstTenDone) {
        this.gacha.firstTenDone = true
        if (!hasSrPlus) backstop = 'SR'
      }
      if (backstop === null && !hasRPlus) backstop = 'R'

      this.gacha.totalDraws++
      results.push(backstop ? forceRarityDraw(this, backstop) : rollDraw(this, rng))

      this.persist()
      return results
    },

    /* ---------------- 升星 ---------------- */

    /** 升星到 stars+1 的碎片消耗（越界星级先钳制到 1~5） */
    starUpShardsNeeded(stars: number): number | null {
      const s = Math.min(5, Math.max(1, Math.floor(stars)))
      if (s >= 5) return null
      return STAR_UP_SHARDS[s - 1] ?? null
    },

    /** 升星到 stars+1 的猫薄荷消耗（含稀有度乘数） */
    starUpCatnipNeeded(petId: string): number | null {
      const owned = this.pets.find((p) => p.id === petId)
      if (!owned || owned.stars >= 5) return null
      const base = STAR_UP_CATNIP[owned.stars - 1]
      if (base === undefined) return null
      return Math.round(base * STAR_UP_RARITY_MUL[getPet(petId).rarity])
    },

    /** 升星：成功返回 true；碎片或猫薄荷不足返回 false */
    starUp(petId: string): boolean {
      const owned = this.pets.find((p) => p.id === petId)
      if (!owned || owned.stars >= 5) return false
      const shardNeed = this.starUpShardsNeeded(owned.stars)
      const catnipNeed = this.starUpCatnipNeeded(petId)
      if (shardNeed === null || catnipNeed === null) return false
      if (owned.shards < shardNeed || this.catnip < catnipNeed) return false

      owned.shards -= shardNeed
      this.catnip -= catnipNeed
      owned.stars++
      this.persist()
      return true
    },
  },
})
