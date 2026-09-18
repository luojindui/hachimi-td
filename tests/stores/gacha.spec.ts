import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GACHA } from '@/game/data/balance'
import { PET_POOL } from '@/game/data/pets'
import { useProfileStore } from '@/stores/profile'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 固定 rng：0.99 永远 roll 出 N（≥0.45） */
const ALWAYS_N = () => 0.99

describe('抽卡基础', () => {
  it('单抽扣 100 猫薄荷，余额不足抛错', () => {
    const store = useProfileStore()
    store.init()
    const before = store.catnip
    const result = store.drawOnce(ALWAYS_N)
    expect(store.catnip).toBe(before - GACHA.SINGLE_COST)
    expect(result.isNew || result.shardsGained > 0).toBe(true)

    store.catnip = 50
    expect(() => store.drawOnce(ALWAYS_N)).toThrow('猫薄荷不足')
  })

  it('十连扣 900，返回 10 张结果', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 1000
    const results = store.drawTen(ALWAYS_N)
    expect(results.length).toBe(10)
    expect(store.catnip).toBe(100)
    expect(store.gacha.totalDraws).toBe(10)
  })

  it('重复宠物自动转碎片（按稀有度数量）', () => {
    const store = useProfileStore()
    store.init()
    // 初始已有田园猫（N 池第一位）；rng 选池内第 0 只
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = store.drawOnce(ALWAYS_N)
    vi.restoreAllMocks()

    expect(result.petId).toBe('tianyuan-cat')
    expect(result.isNew).toBe(false)
    expect(result.shardsGained).toBe(GACHA.DUPE_SHARDS.N)
    expect(store.pets.find((p) => p.id === 'tianyuan-cat')!.shards).toBe(
      GACHA.DUPE_SHARDS.N,
    )
  })

  it('新宠物入库为 1★ 0 碎片', () => {
    const store = useProfileStore()
    store.init()
    // N 池共 6 只，选第 5 只（田园猫/田园犬之外）
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const result = store.drawOnce(ALWAYS_N)
    vi.restoreAllMocks()

    const target = PET_POOL.N[5]!
    expect(result.petId).toBe(target)
    expect(result.isNew).toBe(true)
    expect(store.pets.find((p) => p.id === target)).toEqual({
      id: target,
      stars: 1,
      shards: 0,
    })
  })
})

describe('保底机制', () => {
  it('累计 20 抽未出 SR+ → 第 20 抽强制 SR；SSR 计数继续累计', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 100000
    const rarities: string[] = []
    for (let i = 0; i < 20; i++) {
      rarities.push(store.drawOnce(ALWAYS_N).rarity)
    }
    expect(rarities.filter((r) => r === 'N').length).toBe(19)
    expect(rarities[19]).toBe('SR')
    expect(store.gacha.srPity).toBe(0)
    // SSR 计数未被 SR 保底重置
    expect(store.gacha.ssrPity).toBe(20)
  })

  it('累计 40 抽必出 SSR 并清零双计数器', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 100000
    let last = ''
    for (let i = 0; i < 40; i++) {
      last = store.drawOnce(ALWAYS_N).rarity
    }
    expect(last).toBe('SSR')
    expect(store.gacha.ssrPity).toBe(0)
    expect(store.gacha.srPity).toBe(0)
  })

  it('出 SSR 后保底重新计数', () => {
    const store = useProfileStore()
    store.init()
    store.catnip = 100000
    for (let i = 0; i < 40; i++) store.drawOnce(ALWAYS_N)
    // 此时双计数为 0；再抽 1 次普通 N
    const result = store.drawOnce(ALWAYS_N)
    expect(result.rarity).toBe('N')
    expect(store.gacha.ssrPity).toBe(1)
  })

  it('十连 R+ 保底：全 N 情况下第 10 张强制为 R（总发放数仍为 10）', () => {
    const store = useProfileStore()
    store.init()
    // 池内选择固定取 index 0（Math.random mock）：N=田园猫（初始已拥有 → 全部转碎片）
    vi.spyOn(Math, 'random').mockReturnValue(0)
    store.catnip = 100000
    store.drawTen(ALWAYS_N) // 消耗新手十连标记
    const shardsBefore = store.pets.find((p) => p.id === 'tianyuan-cat')!.shards
    const petsBefore = store.pets.length
    store.catnip = 100000
    const results = store.drawTen(ALWAYS_N)
    vi.restoreAllMocks()

    expect(results.length).toBe(10)
    expect(results[9]!.rarity).toBe('R')
    expect(results[9]!.petId).toBe('shiba') // R 池 index 0，新宠入库
    expect(results.slice(0, 9).every((r) => r.rarity === 'N')).toBe(true)
    // 无双发泄漏：9 抽重复全部转碎片 + 1 张新 R
    expect(store.pets.find((p) => p.id === 'tianyuan-cat')!.shards).toBe(
      shardsBefore + 9 * GACHA.DUPE_SHARDS.N,
    )
    expect(store.pets.length).toBe(petsBefore + 1)
  })

  it('首次十连必出 SR+（新手保底，位于第 10 张）', () => {
    const store = useProfileStore()
    store.init()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    store.catnip = 100000
    const results = store.drawTen(ALWAYS_N)
    vi.restoreAllMocks()

    expect(store.gacha.firstTenDone).toBe(true)
    expect(results[9]!.rarity).toBe('SR')
    // 无双发泄漏：初始 2 只 + 9 张重复田园猫（转碎片）+ 1 只新 SR（金毛）
    expect(store.pets.length).toBe(3)
    expect(store.pets.find((p) => p.id === 'tianyuan-cat')!.shards).toBe(
      9 * GACHA.DUPE_SHARDS.N,
    )
  })
})

describe('升星', () => {
  function prepare(petId: string, stars: number, shards: number, catnip = 100000) {
    const store = useProfileStore()
    store.init()
    const owned = store.pets.find((p) => p.id === petId)!
    owned.stars = stars
    owned.shards = shards
    store.catnip = catnip
    return store
  }

  it('正常升星：扣碎片与猫薄荷，星级 +1', () => {
    const store = prepare('tianyuan-cat', 1, GACHA.DUPE_SHARDS.N)
    const catnipBefore = store.catnip
    expect(store.starUp('tianyuan-cat')).toBe(true)
    const owned = store.pets.find((p) => p.id === 'tianyuan-cat')!
    expect(owned.stars).toBe(2)
    // 5 片 - 升 2★ 消耗 2 片 = 3 片
    expect(owned.shards).toBe(3)
    expect(store.catnip).toBeLessThan(catnipBefore)
  })

  it('碎片不足 / 猫薄荷不足返回 false 且不消耗', () => {
    const store = prepare('tianyuan-cat', 1, 0, 100000)
    expect(store.starUp('tianyuan-cat')).toBe(false)
    expect(store.pets.find((p) => p.id === 'tianyuan-cat')!.stars).toBe(1)

    const poor = prepare('tianyuan-cat', 1, 50, 0)
    expect(poor.starUp('tianyuan-cat')).toBe(false)
    expect(poor.catnip).toBe(0)
  })

  it('5★ 满星不可再升', () => {
    const store = prepare('tianyuan-cat', 5, 999)
    expect(store.starUp('tianyuan-cat')).toBe(false)
    expect(store.starUpShardsNeeded(5)).toBeNull()
    expect(store.starUpCatnipNeeded('tianyuan-cat')).toBeNull()
  })

  it('SSR 升星猫薄荷消耗带稀有度乘数', () => {
    const store = useProfileStore()
    store.init()
    // 手动入库一只 SSR 再查询
    store.pets.push({ id: 'hachimi', stars: 1, shards: 10 })
    // 基础 40 × SSR 乘数 2 = 80
    expect(store.starUpCatnipNeeded('hachimi')).toBe(80)
  })

  it('星级越界值被钳制（≥5 视为满级，<1 视为 1★）', () => {
    const store = useProfileStore()
    store.init()
    const pet = store.pets.find((p) => p.id === 'tianyuan-cat')!
    pet.stars = 99
    expect(store.starUpShardsNeeded(pet.stars)).toBeNull()
    expect(store.starUpCatnipNeeded('tianyuan-cat')).toBeNull()
    pet.stars = 0
    expect(store.starUpShardsNeeded(pet.stars)).toBe(2) // <1 视为 1★ → 升 2★ 需 2 片
  })
})
