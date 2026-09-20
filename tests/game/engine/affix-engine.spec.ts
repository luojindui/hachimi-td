import { describe, expect, it } from 'vitest'

import { makeEngine, makeWave, makePet } from './helpers'

const FAST_SNIPER = makePet({ id: 't-affix-sniper', attack: 50, attackInterval: 10, range: 2.6 })

describe('词缀引擎效果', () => {
  it('钢壳词缀：护甲 +30（伤害降低）', () => {
    const engine = makeEngine({
      lineup: [FAST_SNIPER],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['steel'],
    })
    engine.placeTower(1, FAST_SNIPER.id)
    advance2(engine, 4)
    // 小鼠护甲 0 + 钢壳 30：首击 50×100/130 = 38.46 → 55-38.46 = 16.54
    expect(engine.getSnapshot().enemies[0]!.hp).toBeCloseTo(16.54, 1)
    expect(engine.getSnapshot().affixes).toContain('steel')
  })

  it('巨体词缀：血量 ×1.2', () => {
    const engine = makeEngine({
      lineup: [FAST_SNIPER],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['titan'],
    })
    engine.placeTower(1, FAST_SNIPER.id)
    advance2(engine, 0.5)
    // 55 × 1.2 = 66
    expect(engine.getSnapshot().enemies[0]!.maxHp).toBe(66)
  })

  it('再生词缀：随时间回血', () => {
    const engine = makeEngine({
      lineup: [FAST_SNIPER],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['regen'],
    })
    engine.placeTower(1, FAST_SNIPER.id)
    advance2(engine, 4) // 已被命中一击（50 伤 → 5 血）
    const before = engine.getSnapshot().enemies[0]!.hp
    advance2(engine, 2) // 再生 1%/s × 2s ≈ +1.1
    const after = engine.getSnapshot().enemies[0]!.hp
    expect(after).toBeGreaterThan(before)
    expect(after).toBeLessThanOrEqual(55)
  })

  it('财源词缀：击杀赏金 ×1.5', () => {
    const sniper = makePet({ id: 't-rich-sniper', attack: 500, attackInterval: 10, range: 2.6 })
    const engine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['rich'],
    })
    engine.placeTower(1, sniper.id)
    const before = engine.getGold()
    advance2(engine, 8)
    // 鼠赏金 8 × 1.5 = 12
    expect(engine.getGold() - before).toBe(12)
  })

  it('冰抗词缀：减速效果减半', () => {
    const icer = makePet({ id: 't-frost-icer', attack: 5, attackInterval: 1.0, range: 2.5, slow: { factor: 0.5, duration: 3 } })
    const withResist = makeEngine({
      lineup: [icer],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['frostward'],
    })
    const without = makeEngine({
      lineup: [icer],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    withResist.placeTower(1, icer.id)
    without.placeTower(1, icer.id)
    advance2(withResist, 3)
    advance2(without, 3)
    const rx = withResist.getSnapshot().enemies[0]!.x
    const nx = without.getSnapshot().enemies[0]!.x
    // 冰抗者被减速更少 → 走得更远
    expect(rx).toBeGreaterThan(nx)
  })

  it('词缀随快照透出（HUD 情报）', () => {
    const engine = makeEngine({
      lineup: [FAST_SNIPER],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
      affixes: ['swift', 'steel'],
    })
    engine.placeTower(1, FAST_SNIPER.id)
    advance2(engine, 0.5)
    const affixes = engine.getSnapshot().affixes
    expect(affixes).toContain('swift')
    expect(affixes).toContain('steel')
  })
})

function advance2(engine: Parameters<typeof advance>[0], seconds: number): void {
  const steps = Math.round(seconds * 30)
  for (let i = 0; i < steps; i++) engine.update(1 / 30)
}

import { advance } from './helpers'
