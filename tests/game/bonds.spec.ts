import { describe, expect, it } from 'vitest'

import { BOND_LIST, evaluateBonds } from '@/game/data/bonds'
import { PET_LIST, getPet } from '@/game/data/pets'

const owned = (ids: string[]) => ids.map((id) => getPet(id))

describe('图鉴收集羁绊', () => {
  it('数据健全：全部羁绊的 require 数量不超过宠物总数上限', () => {
    for (const b of BOND_LIST) {
      const n = b.require.kind === 'all' ? PET_LIST.length : undefined
      if (n !== undefined) expect(b.require.count).toBeLessThanOrEqual(n)
    }
  })

  it('猫猫家族：8 猫激活 +3% 全体攻击', () => {
    const cats = owned(PET_LIST.filter((p) => p.species === 'cat').slice(0, 8).map((p) => p.id))
    const r = evaluateBonds(cats)
    expect(r.active).toContain('cat-family')
    expect(r.globalAttack).toBeGreaterThanOrEqual(0.03)
  })

  it('7 猫不激活', () => {
    const cats = owned(PET_LIST.filter((p) => p.species === 'cat').slice(0, 7).map((p) => p.id))
    expect(evaluateBonds(cats).active).not.toContain('cat-family')
  })

  it('收藏家：集齐 21 只激活 +10% 赏金', () => {
    const r = evaluateBonds(owned(PET_LIST.map((p) => p.id)))
    expect(r.active).toContain('collector')
    expect(r.gold).toBeCloseTo(0.1, 6)
  })

  it('冰雪小队：4 冰系激活（不影响其他加成）', () => {
    const ices = owned(PET_LIST.filter((p) => p.role === 'ice').slice(0, 4).map((p) => p.id))
    const r = evaluateBonds(ices)
    expect(r.active).toContain('ice-squad')
    expect(r.iceAttack).toBeCloseTo(0.12, 6)
  })
})
