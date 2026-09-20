import { describe, expect, it } from 'vitest'

/**
 * 编排层回归：每日挑战路由链路（B1 类 bug 防线）。
 * 回归锁：BattleView 源码必须保留 /battle/daily 的 params 判定，
 * 且每日配置（词缀/奖励）始终可用。
 */
import { readFileSync } from 'node:fs'
import { getDailyChallenge, todayStr } from '@/game/daily'
import { router } from '@/router'

describe('BattleView 编排（每日挑战链路）', () => {
  it('回归锁：源码保留 params.levelId === daily 判定', () => {
    const src = readFileSync('src/views/BattleView.vue', 'utf-8')
    expect(src).toContain("route.params.levelId === 'daily'")
    expect(src).toContain('claimDaily(todayStr()')
  })

  it('路由表包含 /battle/:levelId（每日挑战复用战斗路由）', () => {
    const battle = router.resolve('/battle/daily')
    expect(battle.params.levelId).toBe('daily')
  })

  it('每日挑战配置函数存在且今日可用', () => {
    const c = getDailyChallenge(todayStr())
    expect(c.affixes.length).toBeGreaterThanOrEqual(1)
    expect(c.catnipReward).toBeGreaterThan(0)
    expect(c.notes.length).toBeGreaterThanOrEqual(2)
  })

  it('routes 表含每日挑战可达路径', () => {
    // 防止误删 /battle/:levelId 或 daily 别名导致入口断链
    const resolved = router.resolve('/battle/daily')
    expect(resolved.matched.length).toBeGreaterThan(0)
  })
})
