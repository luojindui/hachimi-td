import { describe, expect, it } from 'vitest'

import { getPet } from '@/game/data/pets'
import { makeEngine, makePet } from './helpers'

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
