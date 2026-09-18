import { describe, expect, it } from 'vitest'

import { starsFor } from '@/game/engine/GameEngine'
import { advance, makeEngine, makeWave } from './helpers'
import { getPet } from '@/game/data/pets'

const shooter = getPet('tianyuan-cat')

describe('敌人移动与漏怪', () => {
  it('敌人按速度沿直线路径推进', () => {
    const engine = makeEngine({
      lineup: [shooter],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    advance(engine, 0.5) // 波开始并生成（首波敌人已先走 0.4s）
    advance(engine, 2) // 再走 2 秒：x ≈ -1 + 0.6 + 3 = 2.6
    const snap = engine.getSnapshot()
    expect(snap.enemies.length).toBe(1)
    expect(snap.enemies[0]!.x).toBeGreaterThan(2.3)
    expect(snap.enemies[0]!.x).toBeLessThan(2.9)
    expect(snap.enemies[0]!.y).toBe(2)
  })

  it('敌人到达终点扣粮仓血并触发失败', () => {
    const engine = makeEngine({
      lineup: [shooter], // 不放置任何塔，纯漏怪
      level: { baseHp: 1 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    // 路径 10 格 / 速度 1.5 ≈ 6.7s 走完
    advance(engine, 12)
    expect(engine.getOutcome()).toBe('defeat')
    expect(engine.getBaseHp()).toBeLessThanOrEqual(0)
  })

  it('鼠王漏怪一次即失败（leakDamage 5 ≥ baseHp 5）', () => {
    const engine = makeEngine({
      lineup: [shooter],
      level: { baseHp: 5 },
      waves: [makeWave([{ enemyId: 'ratking', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    advance(engine, 20) // 速度 0.9，10 格 ≈ 11.1s
    expect(engine.getOutcome()).toBe('defeat')
  })

  it('敌人位置不会越过终点，漏怪后波次清空照常判胜', () => {
    const engine = makeEngine({
      lineup: [shooter],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    advance(engine, 30)
    // 唯一波次已清空（敌人漏过）且血量 > 0 → 胜利
    expect(engine.getOutcome()).toBe('victory')
    expect(engine.getBaseHp()).toBe(99)
    expect(engine.getLeaks()).toBe(1)
  })
})

describe('星级结算', () => {
  it('满血 3★ / >60% 2★ / 其余 1★', () => {
    expect(starsFor(20, 20)).toBe(3)
    expect(starsFor(13, 20)).toBe(2)
    expect(starsFor(12, 20)).toBe(1)
    expect(starsFor(1, 20)).toBe(1)
  })
})
