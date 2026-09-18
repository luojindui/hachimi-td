import { describe, expect, it } from 'vitest'

import { getEndlessLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import { makeEngine, makePet, makeWave, advance } from './helpers'

const shooter = getPet('tianyuan-cat')

/** 强力单发炮：攻击 1000，间隔 0.5s，射程 5 —— 秒杀全场用 */
const destroyer = makePet({
  id: 't-destroyer',
  attack: 1000,
  attackInterval: 0.5,
  range: 5,
})

describe('波次推进', () => {
  it('按时间线分批生成敌人', () => {
    const engine = makeEngine({
      lineup: [shooter],
      waves: [makeWave([{ enemyId: 'mouse', count: 3, interval: 1 }], 0)],
      firstWaveCountdown: 0.5,
    })
    advance(engine, 1)
    expect(engine.getSnapshot().enemies.length).toBe(1)
    advance(engine, 1)
    expect(engine.getSnapshot().enemies.length).toBe(2)
    advance(engine, 1)
    expect(engine.getSnapshot().enemies.length).toBe(3)
  })

  it('波次清空发奖励并进入倒计时，最后一波清空即胜利', () => {
    const engine = makeEngine({
      lineup: [destroyer],
      waves: [makeWave([{ enemyId: 'mouse', count: 2, interval: 2 }], 40)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, destroyer.id)
    advance(engine, 10)
    const snap = engine.getSnapshot()
    expect(snap.outcome).toBe('victory')
    expect(snap.kills).toBe(2)
    expect(engine.getGold()).toBe(500 - 100 + 8 + 8 + 40)
  })

  it('多波次：清空后倒计时，随后自动开下一波', () => {
    const engine = makeEngine({
      lineup: [destroyer],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
        makeWave([{ enemyId: 'mouse', count: 5, interval: 3 }], 40),
      ],
      firstWaveCountdown: 0.1,
      waveBreakSeconds: 3,
    })
    engine.placeTower(1, destroyer.id)
    advance(engine, 3)
    expect(engine.getSnapshot().outcome).toBe('ongoing')
    expect(engine.getSnapshot().waveInProgress).toBe(false)
    const cd1 = engine.getSnapshot().nextWaveCountdown
    expect(cd1).toBeGreaterThan(0)
    expect(cd1).toBeLessThanOrEqual(3.2)
    advance(engine, 2.5)
    // 第二波已自动开始，且还有敌人待生成
    expect(engine.getSnapshot().waveInProgress).toBe(true)
    expect(engine.getCurrentWaveIndex()).toBe(1)
  })

  it('提前召唤：预支 50%，清波时抵扣（总奖励不变）', () => {
    const engine = makeEngine({
      lineup: [destroyer],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 60),
      ],
      firstWaveCountdown: 0.1,
      waveBreakSeconds: 10,
    })
    engine.placeTower(1, destroyer.id)
    advance(engine, 4) // 第一波已清空，进入倒计时
    expect(engine.canCallNextWave()).toBe(true)
    const afterFirstWave = engine.getGold()
    engine.callNextWave()
    // 预支 floor(60 × 0.5) = 30
    expect(engine.getGold()).toBe(afterFirstWave + 30)
    expect(engine.getSnapshot().waveInProgress).toBe(true)
    // 清空第二波后只补剩余 30（总额 60 不变）
    advance(engine, 4)
    expect(engine.getOutcome()).toBe('victory')
    expect(engine.getGold()).toBe(afterFirstWave + 30 + 30 + 8)
  })

  it('战斗结束后经济操作全部拒绝', () => {
    const engine = makeEngine({
      lineup: [destroyer],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(0, destroyer.id)
    advance(engine, 6)
    expect(engine.getOutcome()).toBe('victory')
    expect(() => engine.upgradeTower(0)).toThrow('战斗已结束')
    expect(() => engine.sellTower(0)).toThrow('战斗已结束')
    expect(() => engine.placeTower(1, destroyer.id)).toThrow('战斗已结束')
  })

  it('构造器入参校验：编队超员 / 空波次 / 非法乘数', () => {
    const six = Array.from({ length: 6 }, (_, i) => makePet({ id: `pet-${i}` }))
    const seven = [...six, makePet({ id: 'pet-7' })]
    expect(() => makeEngine({ lineup: seven })).toThrow('编队最多')

    expect(() =>
      makeEngine({
        lineup: [destroyer],
        level: { endless: true, waves: [] },
      }),
    ).not.toThrow() // 无尽关允许空波次

    expect(() =>
      makeEngine({
        lineup: [destroyer],
        waves: [],
      }),
    ).toThrow('至少需要 1 个波次')

    expect(() =>
      makeEngine({
        lineup: [destroyer],
        level: { speedMul: 0 },
      }),
    ).toThrow('hpMul/speedMul')
  })

  it('update 对非法输入防御（NaN/负数不推进）', () => {
    const engine = makeEngine({
      lineup: [shooter],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
      firstWaveCountdown: 5,
    })
    engine.update(Number.NaN)
    engine.update(-1)
    expect(engine.getSnapshot().nextWaveCountdown).toBeGreaterThan(4.5)
  })

  it('战斗进行中不能召唤，游戏结束后也不能', () => {
    const engine = makeEngine({
      lineup: [shooter],
      waves: [
        makeWave([{ enemyId: 'mouse', count: 5, interval: 0.5 }], 40),
        makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40),
      ],
      firstWaveCountdown: 0.1,
    })
    advance(engine, 1)
    expect(engine.canCallNextWave()).toBe(false)
    expect(() => engine.callNextWave()).toThrow()
    advance(engine, 60)
    expect(engine.getOutcome()).not.toBe('ongoing')
    expect(engine.canCallNextWave()).toBe(false)
  })
})

describe('无尽模式引擎侧', () => {
  it('波次无限推进且不判胜利', () => {
    const engine = makeEngine({
      lineup: [destroyer],
      level: getEndlessLevel(),
      firstWaveCountdown: 0.1,
      waveBreakSeconds: 1,
    })
    engine.placeTower(0, destroyer.id)
    advance(engine, 30)
    const snap = engine.getSnapshot()
    expect(snap.outcome).toBe('ongoing')
    expect(snap.waveTotal).toBe(0)
    expect(engine.getCurrentWaveIndex()).toBeGreaterThanOrEqual(1)
    expect(snap.kills).toBeGreaterThan(0)
  })

  it('无尽波次 hpMul 随引擎生效（敌人血量爬坡）', () => {
    // 弱塔：攻击 60 恰好秒 55 血小怪，但秒不动 6 波后的 55×1.35≈74
    const weak = makePet({
      id: 't-weak',
      attack: 60,
      attackInterval: 0.5,
      range: 5,
    })
    const engine = makeEngine({
      lineup: [weak],
      level: getEndlessLevel(),
      firstWaveCountdown: 0.1,
      waveBreakSeconds: 1,
    })
    engine.placeTower(0, weak.id)
    advance(engine, 25)
    // 前 5 波小怪被秒；第 6 波起需两发，场上应有存活敌人
    expect(engine.getSnapshot().enemies.length).toBeGreaterThan(0)
  })
})
