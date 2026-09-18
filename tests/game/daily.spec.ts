import { describe, expect, it } from 'vitest'

import { getDailyChallenge, todayStr } from '@/game/daily'

describe('每日挑战配置', () => {
  it('同一天配置完全一致（确定性）', () => {
    const a = getDailyChallenge('2025-09-18')
    const b = getDailyChallenge('2025-09-18')
    expect(a).toEqual(b)
  })

  it('不同日期配置不同（关卡轮换/数值变化）', () => {
    const configs = new Set(
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(2025, 8, 1 + i)
        const p = (n: number) => String(n).padStart(2, '0')
        const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        const c = getDailyChallenge(date)
        return `${c.levelId}:${c.hpMul.toFixed(2)}:${c.commonOnly}`
      }),
    )
    // 14 天内应有多于 1 种组合（轮换生效）
    expect(configs.size).toBeGreaterThan(1)
  })

  it('数值均在设计区间内', () => {
    const c = getDailyChallenge('2025-09-18')
    expect(c.hpMul).toBeGreaterThanOrEqual(1.2)
    expect(c.hpMul).toBeLessThanOrEqual(1.5)
    expect(c.startGold).toBeGreaterThanOrEqual(300)
    expect(c.startGold).toBeLessThanOrEqual(380)
    expect(c.catnipReward).toBe(150)
    expect(c.notes.length).toBeGreaterThanOrEqual(2)
  })

  it('todayStr 格式合法', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
