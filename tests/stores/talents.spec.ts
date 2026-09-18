import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import { useProfileStore } from '@/stores/profile'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('天赋树', () => {
  it('星数门槛：不足时不可购买', () => {
    const store = useProfileStore()
    store.init()
    // atk1 需要 3 星：0 星时不可买
    expect(store.canBuyTalent('atk1')).toBe(false)
    expect(store.buyTalent('atk1')).toBe(false)
  })

  it('前置节点：tier 2 需要 tier 1 先购', () => {
    const store = useProfileStore()
    store.init()
    // 18 星解锁 atk3，但 atk2/atk1 未购
    store.catnip = 100000
    store.completeLevel('1', 3, 0)
    store.completeLevel('2', 3, 0)
    store.completeLevel('3', 3, 0)
    store.completeLevel('4', 3, 0)
    store.completeLevel('5', 3, 0)
    store.completeLevel('6', 3, 0)
    const stars = store.totalStars
    expect(stars).toBeGreaterThanOrEqual(18)
    expect(store.canBuyTalent('atk3')).toBe(false)
  })

  it('购买：扣猫薄荷、天赋生效到 talentBonus', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 100000
    store.completeLevel('1', 3, 0)
    const before = store.catnip
    expect(store.canBuyTalent('atk1')).toBe(true)
    expect(store.buyTalent('atk1')).toBe(true)
    expect(store.catnip).toBeLessThan(before)
    expect(store.talentBonus.attack).toBeCloseTo(0.03, 6)
  })

  it('重复购买返回 false', () => {
    const store = useProfileStore()
    store.init()
    store.completeLevel('1', 3, 0)
    store.catnip = 100000
    expect(store.buyTalent('atk1')).toBe(true)
    expect(store.buyTalent('atk1')).toBe(false)
  })

  it('猫薄荷不足返回 false', () => {
    const store = useProfileStore()
    store.init()
    store.completeLevel('1', 3, 0)
    store.catnip = 100
    expect(store.buyTalent('atk1')).toBe(false)
  })

  it('天赋加成传入战斗引擎：攻击与粮仓上限生效', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 100000
    store.completeLevel('1', 3, 0)
    store.completeLevel('2', 3, 0)
    store.completeLevel('3', 3, 0)
    store.buyTalent('atk1')
    store.buyTalent('atk2')
    store.buyTalent('hp1')
    // atk1(3%) + atk2(6%) = 9%；hp1 = 粮仓 +2

    const engine = new GameEngine({
      level: getLevel('1'),
      lineup: [getPet('tianyuan-cat')],
      starLevels: {},
      talentBonus: store.talentBonus,
      draftsEnabled: false,
    })
    engine.placeTower(1, 'tianyuan-cat')
    // 田园猫攻击 24 × 1.09 = 26.16
    expect(engine.towerStats(1)!.attack).toBeCloseTo(24 * 1.09, 6)
    expect(engine.getSnapshot().baseMaxHp).toBe(20 + 2)
  })
})

