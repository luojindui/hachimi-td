import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { makeEngine, makeWave } from './helpers'
import { makePet } from './helpers'

const sniper = makePet({ id: 't-sniper-el', attack: 200, attackInterval: 10, range: 2.5 })

describe('精英词缀', () => {
  it('精英怪血量 ×2.2、带 elite 视觉标记', () => {
    const engine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1, elite: true }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, sniper.id)
    advance1(engine)
    const snap = engine.getSnapshot()
    const enemy = snap.enemies[0]!
    // 55 × 2.2 = 121
    expect(enemy.hp).toBe(121)
    expect(enemy.maxHp).toBe(121)
    expect(enemy.elite).toBe(true)
  })

  it('精英怪击杀赏金 ×3（与光环/固定加成叠加）', () => {
    const engine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1, elite: true }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, sniper.id)
    const before = engine.getGold()
    const step = 1 / 60
    for (let t = 0; t < 12 && engine.getOutcome() === 'ongoing'; t += step) {
      engine.update(step)
      engine.update(step)
    }
    // 精英鼠赏金 8 × 3 = 24
    expect(engine.getGold() - before).toBe(24)
  })

  it('非精英怪不受影响', () => {
    const engine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1, elite: false }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, sniper.id)
    advance1(engine)
    const enemy = engine.getSnapshot().enemies[0]!
    expect(enemy.elite).toBe(false)
    expect(enemy.hp).toBe(55)
  })

  it('精英速度 ×0.9', () => {
    // 精英鼠 speed = 1.5 × 0.9 = 1.35；普通 1.5
    const eliteEngine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1, elite: true }], 0)],
      firstWaveCountdown: 0.1,
    })
    const normalEngine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    advance1(eliteEngine)
    advance1(normalEngine)
    for (let i = 0; i < 30; i++) { eliteEngine.update(1 / 60); normalEngine.update(1 / 60) }
    const ex = eliteEngine.getSnapshot().enemies[0]!.x
    const nx = normalEngine.getSnapshot().enemies[0]!.x
    // 同起点同步数：精英更慢 → x 更小
    expect(ex).toBeLessThan(nx)
  })
})

function advance1(engine: GameEngine): void {
  for (let i = 0; i < 60; i++) engine.update(1 / 60)
}
