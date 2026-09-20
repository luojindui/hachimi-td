import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { getPet } from '@/game/data/pets'
import { advance, makeEngine, makePet, makeWave } from './helpers'

const cat = getPet('tianyuan-cat') // cost 80
const dog = getPet('tianyuan-dog') // cost 100

describe('建造 / 升级 / 出售 经济', () => {
  it('放塔扣费并占用建造格', () => {
    const engine = makeEngine({ lineup: [cat] })
    expect(engine.canPlace(0, cat.id).ok).toBe(true)
    engine.placeTower(0, cat.id)
    expect(engine.getGold()).toBe(500 - 80)
    expect(engine.canPlace(0, cat.id).ok).toBe(false)
    expect(engine.towerStats(0)).not.toBeNull()
  })

  it('小鱼干不足时拒绝建造', () => {
    const engine = makeEngine({ lineup: [cat], level: { startGold: 50 } })
    expect(engine.canPlace(0, cat.id).ok).toBe(false)
    expect(() => engine.placeTower(0, cat.id)).toThrow('小鱼干不足')
    expect(engine.getGold()).toBe(50)
  })

  it('非编队宠物 / 已上场宠物拒绝建造', () => {
    const engine = makeEngine({ lineup: [cat, dog] })
    expect(engine.canPlace(0, 'shiba').ok).toBe(false)
    engine.placeTower(0, cat.id)
    expect(engine.canPlace(1, cat.id).ok).toBe(false)
    expect(() => engine.placeTower(1, cat.id)).toThrow('已上场')
  })

  it('升级费用与投入累计：Lv2=0.8x，Lv3=1.2x', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    expect(engine.upgradeCost(0)).toBe(Math.round(80 * 0.8)) // 64
    engine.upgradeTower(0, 'quick')
    expect(engine.getGold()).toBe(500 - 80 - 64)
    expect(engine.upgradeCost(0)).toBe(Math.round(80 * 1.2)) // 96
    engine.upgradeTower(0, 'quick')
    expect(engine.upgradeCost(0)).toBeNull()
    expect(engine.towerStats(0)!.level).toBe(3)
    expect(() => engine.upgradeTower(0)).toThrow('已满级')
  })

  it('升级后攻击与射程成长', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    const lv1 = engine.towerStats(0)!
    engine.upgradeTower(0, 'quick')
    const lv2 = engine.towerStats(0)!
    expect(lv2.attack).toBeCloseTo(24 * 1.6, 6)
    expect(lv2.range).toBeCloseTo(2.2 + 0.2, 6)
    expect(lv2.attack).toBeGreaterThan(lv1.attack)
  })

  it('出售返还 60% 累计投入，并释放建造格', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    engine.upgradeTower(0, 'quick')
    engine.upgradeTower(0, 'quick')
    // invested = 80+64+96 = 240 → 返还 144
    const before = engine.getGold()
    engine.sellTower(0)
    expect(engine.getGold()).toBe(before + 144)
    expect(engine.towerStats(0)).toBeNull()
    expect(engine.canPlace(0, cat.id).ok).toBe(true)
  })

  it('星级攻击成长进战斗', () => {
    const engine = makeEngine({ lineup: [cat], starLevels: { 'tianyuan-cat': 3 } })
    engine.placeTower(0, cat.id)
    // 1 + (3-1)*0.15 = 1.3
    expect(engine.towerStats(0)!.attack).toBeCloseTo(24 * 1.3, 6)
  })

  it('星级越界值在引擎内被钳制（99★=5★，NaN=1★）', () => {
    const maxStar = makeEngine({ lineup: [cat], starLevels: { 'tianyuan-cat': 99 } })
    maxStar.placeTower(0, cat.id)
    // 1 + (5-1)*0.15 = 1.6
    expect(maxStar.towerStats(0)!.attack).toBeCloseTo(24 * 1.6, 6)

    const invalid = makeEngine({
      lineup: [cat],
      starLevels: { 'tianyuan-cat': Number.NaN },
    })
    invalid.placeTower(0, cat.id)
    expect(invalid.towerStats(0)!.attack).toBeCloseTo(24 * 1.0, 6)
  })

  it('光环：全场攻击与攻速光环', () => {
    const wangcai = getPet('wangcai')
    const sanhua = getPet('sanhua')
    const testPet = makePet({ id: 't-raw', attack: 30, attackInterval: 1 })
    const engine = makeEngine({
      lineup: [wangcai, sanhua, testPet],
      level: { startGold: 700 },
    })
    engine.placeTower(0, testPet.id)
    engine.placeTower(1, wangcai.id)
    engine.placeTower(2, sanhua.id)
    const stats = engine.towerStats(0)!
    expect(stats.attack).toBeCloseTo(30 * 1.1, 6)
    expect(stats.interval).toBeCloseTo(1 / 1.2, 6)
  })

  it('空编队 / 重复编队抛错', () => {
    expect(() => makeEngine({ lineup: [] })).toThrow('编队')
    const dup = makePet({ id: 'dup-pet' })
    expect(() => makeEngine({ lineup: [dup, dup] })).toThrow('重复')
  })
})

describe('升级分支（Lv2 二选一专精）', () => {
  it('Lv1→Lv2 必须选择分支', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    expect(() => engine.upgradeTower(0)).toThrow('专精分支')
  })

  it('速攻分支：攻速成长快 + 射程小幅扩大', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    engine.upgradeTower(0, 'quick')
    engine.upgradeTower(0, 'quick')
    const s = engine.towerStats(0)!
    expect(s.attack).toBeCloseTo(24 * 2.4, 6)
    expect(s.interval).toBeCloseTo(1.1 * 0.65, 6)
    expect(s.range).toBeCloseTo(2.2 + 0.4, 6)
    expect(s.level).toBe(3)
  })

  it('重击分支：单发伤害成长快', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    engine.upgradeTower(0, 'heavy')
    const s = engine.towerStats(0)!
    expect(s.attack).toBeCloseTo(24 * 2.2, 6)
    expect(s.interval).toBeCloseTo(1.1 * 1.1, 6)
    // 同成本下重击单发更高但总 DPS 更低
    const quickDps = (24 * 2.4) / (1.1 * 0.65)
    const heavyDps = (24 * 2.2) / (1.1 * 1.1)
    expect(heavyDps).toBeLessThan(quickDps)
  })

  it('分支锁定：Lv2 后不能更换分支', () => {
    const engine = makeEngine({ lineup: [cat] })
    engine.placeTower(0, cat.id)
    engine.upgradeTower(0, 'quick')
    expect(() => engine.upgradeTower(0, 'heavy')).toThrow('不能中途更换分支')
  })
})

describe('地形建造格', () => {
  const highSlot = { x: 5, y: 1, kind: 'high' as const }
  const mineSlot = { x: 2, y: 1, kind: 'mine' as const }
  const thicketSlot = { x: 3, y: 3, kind: 'thicket' as const }

  it('高台格：射程 +0.5', () => {
    const cat2 = makePet({ id: 't-high-cat2', attack: 24, attackInterval: 1.1, range: 2.2 })
    const engine = makeEngine({
      lineup: [cat, cat2],
      level: { buildSlots: [highSlot, { x: 2, y: 1 }] },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 100,
    })
    engine.placeTower(0, cat.id) // 高台
    engine.placeTower(1, cat2.id) // 平地
    expect(engine.towerStats(0)!.range).toBeCloseTo(engine.towerStats(1)!.range + 0.5, 6)
  })

  it('草丛格：攻速 +10%（间隔 ×0.9）', () => {
    const cat2 = makePet({ id: 't-thick-cat2', attack: 24, attackInterval: 1.1, range: 2.2 })
    const engine = makeEngine({
      lineup: [cat, cat2],
      level: { buildSlots: [thicketSlot, { x: 2, y: 1 }] },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 100,
    })
    engine.placeTower(0, cat.id) // 草丛
    engine.placeTower(1, cat2.id) // 平地
    expect(engine.towerStats(0)!.interval).toBeCloseTo(engine.towerStats(1)!.interval * 0.9, 6)
  })

  it('金矿格：每波清空 +40（每座）', () => {
    const engine = makeEngine({
      lineup: [cat],
      level: { buildSlots: [mineSlot, { x: 2, y: 1 }] },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 100,
    })
    engine.placeTower(0, cat.id) // 金矿格上的塔激活产出
    const before = engine.getGold()
    engine.callNextWave()
    advance(engine, 6)
    // 波清空奖励 0 + 金矿 40，另有击杀赏金 8 → 48
    expect(engine.getGold() - before).toBe(48)
  })
})

describe('无尽波间商店', () => {
  function endlessEngine(opts?: { startGold?: number; countdown?: number; drafts?: boolean }): GameEngine {
    return makeEngine({
      lineup: [cat],
      level: {
        id: 'endless',
        endless: true,
        theme: 'endless',
        startGold: opts?.startGold ?? 900,
      } as never,
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
      ],
      firstWaveCountdown: opts?.countdown ?? 100,
      drafts: opts?.drafts,
    })
  }

  it('非无尽模式禁用商店', () => {
    const engine = makeEngine({ lineup: [cat] })
    expect(() => engine.shopBuy('repair')).toThrow('无尽')
  })

  it('修补粮仓：+5 且不超过上限', () => {
    const engine = endlessEngine()
    engine.placeTower(1, cat.id)
    engine.callNextWave()
    advance(engine, 12)
    const damaged = engine.getBaseHp()
    expect(damaged).toBeLessThan(engine.getSnapshot().baseMaxHp)
    engine.shopBuy('repair')
    expect(engine.getBaseHp()).toBe(
      Math.min(engine.getSnapshot().baseMaxHp, damaged + 5),
    )
  })

  it('下一波奖励 ×2：一次性消耗（倒计时期购买 → 波清空后失效）', () => {
    const killer = makePet({ id: 't-shop-killer', attack: 500, attackInterval: 1.0, range: 2.6 })
    const engine = makeEngine({
      lineup: [cat, killer],
      level: { id: 'endless', endless: true, theme: 'endless', startGold: 900 } as never,
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40)],
      firstWaveCountdown: 100,
    })
    engine.placeTower(1, killer.id)
    expect(engine.hasBountyBoost()).toBe(false)
    engine.shopBuy('bounty')
    expect(engine.hasBountyBoost()).toBe(true)
    engine.callNextWave()
    advance(engine, 14)
    expect(engine.hasBountyBoost()).toBe(false)
  })

  it('重抽：draft 待选时更换三选一（保持 3 项）', () => {
    const engine = endlessEngine({ countdown: 0.1, drafts: true })
    engine.placeTower(1, cat.id)
    advance(engine, 1)
    expect(engine.getSnapshot().draft).not.toBeNull()
    engine.shopBuy('reroll')
    const after = engine.getSnapshot().draft!
    expect(after).toHaveLength(3)
  })

  it('余额不足抛错', () => {
    const engine = endlessEngine({ startGold: 50 })
    expect(() => engine.shopBuy('repair')).toThrow('小鱼干不足')
  })
})
