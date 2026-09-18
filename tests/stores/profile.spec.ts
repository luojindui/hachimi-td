import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useProfileStore } from '@/stores/profile'

const SAVE_KEY = 'hachimi-td:save:v1'
const CORRUPTED_KEY = 'hachimi-td:backup:corrupted'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('存档初始化', () => {
  it('无存档时开新档：初始宠物 + 猫薄荷 + 默认编队', () => {
    const store = useProfileStore()
    store.init()
    expect(store.pets.map((p) => p.id)).toEqual(['tianyuan-cat', 'tianyuan-dog'])
    expect(store.catnip).toBe(1200)
    expect(store.lineup).toEqual(['tianyuan-cat', 'tianyuan-dog'])
    expect(store.persistent).toBe(true)
  })

  it('已有存档时恢复数据', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        currencies: { catnip: 777 },
        pets: [{ id: 'shiba', stars: 2, shards: 3 }],
        lineup: ['shiba'],
        levels: { '1': { stars: 2, cleared: true } },
        endless: { bestWave: 7, claimedMilestones: [5] },
        gacha: { totalDraws: 11, srPity: 4, ssrPity: 9, firstTenDone: true },
        starMilestones: [],
        stats: { totalKills: 42, battlesWon: 3 },
      }),
    )
    const store = useProfileStore()
    store.init()
    expect(store.catnip).toBe(777)
    expect(store.pets[0]).toEqual({ id: 'shiba', stars: 2, shards: 3 })
    expect(store.levels['1']).toEqual({ stars: 2, cleared: true })
    expect(store.endless.bestWave).toBe(7)
    expect(store.gacha.totalDraws).toBe(11)
  })

  it('损坏存档：备份 + 开新档 + 标记恢复', () => {
    localStorage.setItem(SAVE_KEY, '{not valid json!!')
    const store = useProfileStore()
    store.init()
    expect(store.recoveredFromCorruption).toBe(true)
    expect(localStorage.getItem(CORRUPTED_KEY)).toBe('{not valid json!!')
    expect(store.catnip).toBe(1200)
    // 主档被重写为合法新档
    expect(() => JSON.parse(localStorage.getItem(SAVE_KEY)!)).not.toThrow()
  })

  it('缺字段的存档自动补默认值', () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, currencies: { catnip: 50 } }),
    )
    const store = useProfileStore()
    store.init()
    expect(store.catnip).toBe(50)
    expect(store.gacha.totalDraws).toBe(0)
    expect(store.pets).toEqual([])
  })
})

describe('关卡结算', () => {
  it('首通发首通奖励并记录星级；重复通关发 20%', () => {
    const store = useProfileStore()
    store.init()
    const first = store.completeLevel('1', 3, 30)
    expect(first.firstClear).toBe(true)
    expect(first.catnipGained).toBe(300)
    expect(store.levels['1']).toEqual({ cleared: true, stars: 3 })

    const repeat = store.completeLevel('1', 2, 10)
    expect(repeat.firstClear).toBe(false)
    expect(repeat.catnipGained).toBe(60)
    // 星级保留历史最高
    expect(store.levels['1']?.stars).toBe(3)
  })

  it('星数里程碑只发一次', () => {
    const store = useProfileStore()
    store.init()
    store.completeLevel('1', 3, 0)
    const second = store.completeLevel('2', 3, 0)
    // 累计 6 星 → 触发 6 星里程碑 +300
    expect(second.catnipGained).toBe(300 + 300)
    expect(store.starMilestones).toContain(6)

    // 重打不重复发
    const again = store.completeLevel('2', 3, 0)
    expect(again.catnipGained).toBe(60)
  })

  it('解锁进度：按顺序解锁', () => {
    const store = useProfileStore()
    store.init()
    expect(store.unlockedLevelIds).toEqual(['1'])
    store.completeLevel('1', 1, 0)
    expect(store.unlockedLevelIds).toEqual(['1', '2'])
  })
})

describe('无尽结算', () => {
  it('里程碑按最佳波数一次性补发', () => {
    const store = useProfileStore()
    store.init()
    expect(store.recordEndless(5, 10).catnipGained).toBe(100)
    expect(store.recordEndless(5, 10).catnipGained).toBe(0)
    // 6~12 波之间有 10 波里程碑未领 → +100
    expect(store.recordEndless(12, 5).catnipGained).toBe(100)
    expect(store.endless.bestWave).toBe(12)
    expect(store.endless.claimedMilestones).toEqual([5, 10])
  })

  it('低于最佳波数不发奖', () => {
    const store = useProfileStore()
    store.init()
    store.recordEndless(10, 0)
    expect(store.recordEndless(4, 0).catnipGained).toBe(0)
    expect(store.endless.bestWave).toBe(10)
  })
})

describe('编队', () => {
  it('去重、过滤未拥有、限 6 只', () => {
    const store = useProfileStore()
    store.init()
    // shiba 未拥有应被过滤；重复 id 去重；超限截断
    store.setLineup([
      'tianyuan-cat',
      'tianyuan-cat',
      'shiba',
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
    expect(store.lineup).toEqual(['tianyuan-cat'])
  })
})

describe('导出导入与重置', () => {
  it('导出→导入往返一致', () => {
    const store = useProfileStore()
    store.init()
    store.completeLevel('1', 3, 20)
    const text = store.exportSave()

    // 新 pinia 实例模拟另一台设备
    setActivePinia(createPinia())
    const fresh = useProfileStore()
    expect(fresh.importSave(text)).toBe(true)
    fresh.init()
    expect(fresh.levels['1']).toEqual({ cleared: true, stars: 3 })
    expect(fresh.stats.totalKills).toBe(20)
  })

  it('导入非法文本返回 false 且不动原档', () => {
    const store = useProfileStore()
    store.init()
    const before = store.catnip
    expect(store.importSave('garbage')).toBe(false)
    expect(store.importSave('{"version":"x"}')).toBe(false)
    expect(store.catnip).toBe(before)
  })

  it('导入未来版本存档被拒绝', () => {
    const store = useProfileStore()
    store.init()
    const before = store.catnip
    expect(
      store.importSave(JSON.stringify({ version: 99, currencies: { catnip: 1 } })),
    ).toBe(false)
    expect(store.catnip).toBe(before)
  })

  it('导入含未知宠物 id 的存档被过滤（不致崩溃）', () => {
    const store = useProfileStore()
    store.init()
    expect(
      store.importSave(
        JSON.stringify({
          version: 1,
          currencies: { catnip: 10 },
          pets: [
            { id: 'tianyuan-cat', stars: 2, shards: 1 },
            { id: 'not-a-pet', stars: 1, shards: 0 },
          ],
          lineup: ['tianyuan-cat', 'not-a-pet'],
        }),
      ),
    ).toBe(true)
    expect(store.pets.map((p) => p.id)).toEqual(['tianyuan-cat'])
    expect(store.lineup).toEqual(['tianyuan-cat'])
    expect(store.catnip).toBe(10)
  })

  it('重置存档回到新档', () => {
    const store = useProfileStore()
    store.init()
    store.completeLevel('1', 3, 0)
    store.resetSave()
    expect(store.levels['1']).toBeUndefined()
    expect(store.catnip).toBe(1200)
  })
})
