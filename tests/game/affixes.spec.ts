import { describe, expect, it } from 'vitest'

import { AFFIX_LIST, getAffix, pickAffixes } from '@/game/data/affixes'

describe('词缀选取', () => {
  it('同 seed 结果一致（确定性）', () => {
    expect(pickAffixes('endless:12', 2)).toEqual(pickAffixes('endless:12', 2))
  })

  it('抽取数量与不重复性', () => {
    const picks = pickAffixes('x', 3)
    expect(picks).toHaveLength(3)
    expect(new Set(picks).size).toBe(3)
  })

  it('n=0 或超池时不崩溃', () => {
    expect(pickAffixes('x', 0)).toEqual([])
    expect(pickAffixes('x', 99).length).toBe(AFFIX_LIST.length)
  })

  it('getAffix 未知 id 抛错', () => {
    expect(() => getAffix('nope')).toThrow()
  })
})
