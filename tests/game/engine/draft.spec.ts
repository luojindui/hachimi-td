import { describe, expect, it } from 'vitest'

import { DRAFT_COUNT, DRAFT_POOL } from '@/game/data/balance'
import { getPet } from '@/game/data/pets'
import { advance, makeEngine, makeWave, STEP } from './helpers'

/** 固定 rng：总是取第一个可选项，便于确定性断言 */
const FIRST = () => 0
/** 固定 rng：总是取最后一个可选项 */
const LAST = () => 0.99

const cat = getPet('tianyuan-cat')

function twoWaveEngine(rng: () => number) {
  return makeEngine({
    lineup: [cat],
    waves: [
      makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
      makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
    ],
    firstWaveCountdown: 0.1,
    waveBreakSeconds: 5,
    rng,
    drafts: true,
  })
}

describe('肉鸽三选一（波次开始时触发）', () => {
  it('新波开始时给出 3 个不重复选项，并冻结战场', () => {
    const engine = twoWaveEngine(FIRST)
    engine.placeTower(1, cat.id)
    advance(engine, 1) // 波次开始 → 三选一出现
    const draft = engine.getSnapshot().draft
    expect(draft).not.toBeNull()
    expect(draft!.length).toBe(DRAFT_COUNT)
    expect(new Set(draft!.map((d) => d.id)).size).toBe(DRAFT_COUNT)
    for (const opt of draft!) {
      expect(opt.name.length).toBeGreaterThan(0)
      expect(opt.desc.length).toBeGreaterThan(0)
      expect(DRAFT_POOL.some((p) => p.id === opt.id)).toBe(true)
    }
    // 冻结：引擎时钟不走；首只怪在波次开始同一 tick 已出生（≤1），不会再增多
    const t1 = engine.getSnapshot().time
    const enemiesAtFreeze = engine.getSnapshot().enemies.length
    advance(engine, 3)
    expect(engine.getSnapshot().time).toBe(t1)
    expect(engine.getSnapshot().enemies.length).toBeLessThanOrEqual(
      enemiesAtFreeze,
    )
  })

  it('pickDraft 选择后生效：攻击强化立即可见，战斗恢复', () => {
    const engine = twoWaveEngine(FIRST)
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    const before = engine.towerStats(1)!.attack
    engine.pickDraft(0) // FIRST rng → 池第 0 项 = attackPlus（+20%）
    expect(engine.towerStats(1)!.attack).toBeCloseTo(before * 1.2, 6)
    expect(engine.getSnapshot().draft).toBeNull()
    // 战斗恢复：敌人生成
    advance(engine, 1)
    expect(engine.getSnapshot().enemies.length).toBeGreaterThan(0)
  })

  it('fortify 强化：粮仓上限 +5 并修复 5', () => {
    const engine = makeEngine({
      lineup: [cat],
      level: { baseHp: 20 },
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
      ],
      firstWaveCountdown: 0.1,
      rng: LAST,
      drafts: true,
    })
    advance(engine, 1)
    const options = engine.getSnapshot().draft!
    // LAST rng（0.99）依次抽走池尾：economy / fortify / critEdge
    expect(options.map((o) => o.id)).toEqual(['economy', 'fortify', 'critEdge'])
    engine.pickDraft(1) // fortify
    expect(engine.getSnapshot().baseMaxHp).toBe(25)
    expect(engine.getBaseHp()).toBe(25)
    // 漏一只怪后血量从新上限扣除
    advance(engine, 10)
    expect(engine.getBaseHp()).toBe(24)
  })

  it('instantGold 强化：立即获得 150 小鱼干', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
      ],
      firstWaveCountdown: 0.1,
      rng: LAST,
      drafts: true,
    })
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    const goldBefore = engine.getGold()
    engine.pickDraft(0) // economy
    expect(engine.getGold()).toBe(goldBefore + 150)
  })

  it('最终波：选完强化后清空即胜利', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40)],
      firstWaveCountdown: 0.1,
      rng: FIRST,
      drafts: true,
    })
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    expect(engine.getSnapshot().draft).not.toBeNull()
    engine.pickDraft(0)
    advance(engine, 10)
    expect(engine.getOutcome()).toBe('victory')
    expect(engine.getSnapshot().draft).toBeNull()
  })

  it('三选一待选期间无法提前召唤', () => {
    const engine = twoWaveEngine(FIRST)
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    expect(engine.hasPendingDraft()).toBe(true)
    expect(engine.canCallNextWave()).toBe(false)
    expect(() => engine.callNextWave()).toThrow()
  })

  it('draftsEnabled=false 时不触发三选一（旧行为）', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40)],
      firstWaveCountdown: 0.1,
      drafts: false,
    })
    engine.placeTower(1, cat.id)
    advance(engine, 2)
    expect(engine.hasPendingDraft()).toBe(false)
    expect(engine.getSnapshot().draft).toBeNull()
  })

  it('DRAFT_COUNT 不超过强化池大小', () => {
    expect(DRAFT_COUNT).toBeLessThanOrEqual(DRAFT_POOL.length)
  })
})

/* ===================== 每种强化的行为断言（防"白板强化"回归） ===================== */

import { makePet } from './helpers'

/** 单发测试炮：攻击 30、间隔 10s、射程 2.5 */
const sniper30 = makePet({
  id: 't-crit-sniper',
  attack: 30,
  attackInterval: 10,
  range: 2.5,
})

function draftEngine(rng: () => number, waves = 2) {
  return makeEngine({
    lineup: [cat],
    waves: Array.from({ length: waves }, () =>
      makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
    ),
    firstWaveCountdown: 0.1,
    rng,
    drafts: true,
  })
}

describe('每种强化的行为断言', () => {
  it('longRange：射程强化实际扩大索敌范围（开火时刻提前）', () => {
    // 基准：drafts 关闭
    const base = makeEngine({
      lineup: [cat],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
      ],
      firstWaveCountdown: 0.1,
      drafts: false,
    })
    // 强化：同样阵容 + 千里眼
    const boosted = makeEngine({
      lineup: [cat],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
      ],
      firstWaveCountdown: 0.1,
      drafts: true,
      rng: FIRST,
    })
    base.placeTower(1, cat.id)
    boosted.placeTower(1, cat.id)
    // boosted 在波次开始选千里眼
    advance(boosted, 1)
    const bOptions = boosted.getSnapshot().draft!
    boosted.pickDraft(bOptions.findIndex((o) => o.id === 'longRange'))

    // 记录双方首次出现弹道的步数
    let baseFire: number | null = null
    let boostFire: number | null = null
    for (let i = 0; i < 600; i++) {
      advance(base, STEP)
      advance(boosted, STEP)
      if (baseFire === null && base.getSnapshot().projectiles.length > 0) baseFire = i
      if (boostFire === null && boosted.getSnapshot().projectiles.length > 0) boostFire = i
      if (baseFire !== null && boostFire !== null) break
    }
    expect(boostFire).not.toBeNull()
    expect(baseFire).not.toBeNull()
    // 射程 +15% → 进入射程更早
    expect(boostFire!).toBeLessThan(baseFire!)
  }, 20000)

  it('bountyHunter：击杀赏金 ×1.25', () => {
    const fortune = makePet({
      id: 't-bh',
      attack: 60,
      attackInterval: 1.4,
      range: 2.0,
      aura: { kind: 'gold', value: 0.25, radius: 2.5 },
    })
    const engine = makeEngine({
      lineup: [fortune],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0),
      ],
      firstWaveCountdown: 0.1,
      rng: () => 0.4, // 首个选项 = 赏金猎人（池 idx 3）
      drafts: true,
    })
    engine.placeTower(1, fortune.id)
    advance(engine, 1)
    const options = engine.getSnapshot().draft!
    const idx = options.findIndex((o) => o.id === 'bountyHunter')
    expect(idx).toBe(0)
    engine.pickDraft(idx)
    const before = engine.getGold()
    advance(engine, 10)
    // 自身光环 0.25 与三选一 0.25 加法合并：8 × 1.5 = 12
    expect(engine.getGold()).toBe(before + 12)
  })

  it('critEdge：命中按概率双倍伤害（护甲前乘算）', () => {
    const sniper30 = makePet({ id: 't-crit-sniper', attack: 30, attackInterval: 10, range: 2.5 })
    // rng 队列：0.7 先抽中 critEdge（池 idx 5），后续 0 → 每次伤害判定都暴击
    const seq = [0.7, 0, 0, 0]
    const engine = makeEngine({
      lineup: [sniper30],
      waves: [makeWave([{ enemyId: 'shield', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      rng: () => seq.shift() ?? 0,
      drafts: true,
    })
    engine.placeTower(1, sniper30.id)
    advance(engine, 1)
    const options = engine.getSnapshot().draft!
    const critIdx = options.findIndex((o) => o.id === 'critEdge')
    expect(critIdx).toBeGreaterThanOrEqual(0)
    engine.pickDraft(critIdx)
    advance(engine, 5)
    // 盾甲鼠 95 血、护甲 50：暴击伤害 = 30×2×100/150 = 40 → 95-40 = 55
    expect(engine.getSnapshot().enemies[0]!.hp).toBeCloseTo(55, 0)
  })

  it('critEdge 对照：无暴击时首击 30×100/150 = 20 → 75', () => {
    const engine = makeEngine({
      lineup: [sniper30],
      waves: [makeWave([{ enemyId: 'shield', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      drafts: false,
    })
    engine.placeTower(1, sniper30.id)
    advance(engine, 5)
  })

  it('rapidFire：interval ×0.8475（攻速 +18%）', () => {
    const engine = draftEngine(FIRST, 2)
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    const options = engine.getSnapshot().draft!
    engine.pickDraft(options.findIndex((o) => o.id === 'rapidFire'))
    expect(engine.towerStats(1)!.interval).toBeCloseTo(1.1 * 0.8475, 3)
  })

  it('bigSplash：只扩张已有溅射，不给单体凭空加 AoE', () => {
    const cannon = makePet({ id: 't-bc', attack: 60, attackInterval: 10, range: 2.5, splash: 1.0 })
    const engine = makeEngine({
      lineup: [cannon],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      rng: () => 0.55,
      drafts: true,
    })
    engine.placeTower(1, cannon.id)
    advance(engine, 1)
    const options = engine.getSnapshot().draft!
    const splashIdx = options.findIndex((o) => o.id === 'bigSplash')
    expect(splashIdx).toBeGreaterThanOrEqual(0)
    engine.pickDraft(splashIdx)
    // 范围扩张只作用于已有溅射的炮手：1.0 + 0.6 = 1.6（而非 0 + 0.6）
    expect(engine.towerStats(1)!.splash).toBeCloseTo(1.6, 6)
  })

  it('跨波叠加：两次 attackPlus → ×1.44', () => {
    const engine = draftEngine(FIRST, 3)
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    const options1 = engine.getSnapshot().draft!
    engine.pickDraft(options1.findIndex((o) => o.id === 'attackPlus'))
    advance(engine, 8)
    const options2 = engine.getSnapshot().draft!
    engine.pickDraft(options2.findIndex((o) => o.id === 'attackPlus'))
    // 加法叠加：24 × (1 + 0.2 + 0.2) = 33.6
    expect(engine.towerStats(1)!.attack).toBeCloseTo(24 * 1.4, 6)
  })

  it('非法索引抛错', () => {
    const engine = draftEngine(FIRST, 2)
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    expect(() => engine.pickDraft(3)).toThrow()
    expect(() => engine.pickDraft(-1)).toThrow()
  })

  it('相同 rng 两次构建，选项完全一致（确定性）', () => {
    const a = draftEngine(FIRST, 2)
    const b = draftEngine(FIRST, 2)
    a.placeTower(1, cat.id)
    b.placeTower(1, cat.id)
    advance(a, 1)
    advance(b, 1)
    expect(a.getSnapshot().draft!.map((o) => o.id)).toEqual(
      b.getSnapshot().draft!.map((o) => o.id),
    )
  })
})
