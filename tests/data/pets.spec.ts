import { describe, expect, it } from 'vitest'

import { DPS_COST_RANGE, GACHA } from '@/game/data/balance'
import { PET_LIST, findPet, getPet } from '@/game/data/pets'
import type { PetDef } from '@/game/types'

const COST_BANDS: Record<string, { min: number; max: number }> = {
  N: { min: 80, max: 120 },
  R: { min: 120, max: 180 },
  SR: { min: 180, max: 260 },
  SSR: { min: 300, max: 400 },
}

function dps(pet: PetDef): number {
  return pet.attack / pet.attackInterval
}

describe('宠物卡池数据', () => {
  it('id 全局唯一', () => {
    const ids = PET_LIST.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('建造费用符合稀有度区间', () => {
    for (const pet of PET_LIST) {
      const band = COST_BANDS[pet.rarity]!
      expect(pet.cost, pet.id).toBeGreaterThanOrEqual(band.min)
      expect(pet.cost, pet.id).toBeLessThanOrEqual(band.max)
    }
  })

  it('伤害型定位的 DPS/成本 在平衡区间内', () => {
    const damageRoles = new Set(['shooter', 'cannon', 'antiair'])
    for (const pet of PET_LIST) {
      if (!damageRoles.has(pet.role)) continue
      const ratio = dps(pet) / pet.cost
      expect(ratio, `${pet.id} ratio=${ratio.toFixed(3)}`).toBeGreaterThanOrEqual(
        DPS_COST_RANGE.min,
      )
      expect(ratio, `${pet.id} ratio=${ratio.toFixed(3)}`).toBeLessThanOrEqual(
        DPS_COST_RANGE.max,
      )
    }
  })

  it('卡池构成：N6 / R7 / SR6 / SSR2，SSR 为双子', () => {
    const byRarity = { N: 0, R: 0, SR: 0, SSR: 0 }
    for (const pet of PET_LIST) byRarity[pet.rarity]++
    expect(byRarity).toEqual({ N: 6, R: 7, SR: 6, SSR: 2 })
    const ssrIds = PET_LIST.filter((p) => p.rarity === 'SSR').map((p) => p.id)
    expect(ssrIds.sort()).toEqual(['hachimi', 'wangcai'])
  })

  it('关键功能位齐备：对空 / 冰系 / 三种辅助', () => {
    expect(PET_LIST.filter((p) => p.targets !== 'ground').length).toBeGreaterThanOrEqual(3)
    expect(PET_LIST.filter((p) => p.role === 'ice').length).toBeGreaterThanOrEqual(3)

    const auraKinds = PET_LIST.filter((p) => p.aura).map((p) => p.aura!.kind)
    expect(auraKinds).toContain('attackSpeed')
    expect(auraKinds).toContain('gold')
    expect(auraKinds).toContain('globalAttack')

    const passives = PET_LIST.filter((p) => p.passive)
    expect(passives.length).toBeGreaterThanOrEqual(1)
  })

  it('哈基米对空、旺财为带全场增益的大狗', () => {
    const hachimi = getPet('hachimi')
    expect(hachimi.targets).toBe('both')
    expect(hachimi.species).toBe('cat')
    expect(hachimi.range).toBeGreaterThanOrEqual(2.8)

    const wangcai = getPet('wangcai')
    expect(wangcai.species).toBe('dog')
    expect(wangcai.aura?.kind).toBe('globalAttack')
    expect(wangcai.splash).toBeDefined()
  })

  it('冰系减速参数合法（0 < factor < 1，duration > 0）', () => {
    const ices = PET_LIST.filter((p) => p.slow)
    expect(ices.length).toBeGreaterThanOrEqual(3)
    for (const pet of ices) {
      expect(pet.slow!.factor, pet.id).toBeGreaterThan(0)
      expect(pet.slow!.factor, pet.id).toBeLessThan(1)
      expect(pet.slow!.duration, pet.id).toBeGreaterThan(0)
    }
  })

  it('渲染占位字段非空', () => {
    for (const pet of PET_LIST) {
      expect(pet.emoji.length, pet.id).toBeGreaterThan(0)
      expect(pet.projectile.length, pet.id).toBeGreaterThan(0)
      expect(pet.tint, pet.id).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('概率表合计为 1 且与卡池稀有度一致', () => {
    const sum = Object.values(GACHA.RATES).reduce((s, n) => s + n, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
  })

  it('查询函数行为', () => {
    expect(getPet('shiba').name).toBe('柴犬')
    expect(findPet('not-exist')).toBeUndefined()
    expect(() => getPet('not-exist')).toThrow()
  })
})
