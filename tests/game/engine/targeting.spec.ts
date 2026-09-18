import { describe, expect, it } from 'vitest'

import { getPet } from '@/game/data/pets'
import { advance, makeEngine, makePet, makeWave } from './helpers'

const groundShooter = getPet('tianyuan-cat') // targets: ground
const antiAir = getPet('lihua') // targets: both

/** 一击必杀的测试射手：攻击 100，间隔 10s，射程 2.5 */
const sniper = makePet({
  id: 't-sniper',
  attack: 100,
  attackInterval: 10,
  range: 2.5,
})

describe('索敌规则', () => {
  it('优先攻击沿路径最靠前的敌人', () => {
    const engine = makeEngine({
      lineup: [sniper],
      waves: [makeWave([{ enemyId: 'mouse', count: 2, interval: 3 }])],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, sniper.id) // slot (5,1)
    advance(engine, 4)
    // 第一只鼠标 ~3s 时被一击必杀；此时第二只（uid 2）刚出生
    const snap = engine.getSnapshot()
    expect(snap.enemies.length).toBe(1)
    expect(snap.enemies[0]!.id).toBe(2)
    expect(snap.kills).toBe(1)
  })

  it('地面塔不打飞行敌人，飞贼直接漏怪', () => {
    const engine = makeEngine({
      lineup: [groundShooter],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'crow', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, groundShooter.id)
    advance(engine, 12)
    expect(engine.getSnapshot().projectiles.length).toBe(0)
    expect(engine.getSnapshot().kills).toBe(0)
    expect(engine.getLeaks()).toBe(1)
  })

  it('对空宠物可以打飞行敌人', () => {
    const engine = makeEngine({
      lineup: [antiAir],
      waves: [makeWave([{ enemyId: 'crow', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, antiAir.id)
    advance(engine, 10)
    expect(engine.getSnapshot().kills).toBe(1)
  })

  it('射程外的敌人不会被攻击', () => {
    const engine = makeEngine({
      lineup: [sniper],
      level: {
        buildSlots: [{ x: 3, y: 5 }], // 距路径 y=2 垂直距离 3 > 射程 2.5
      },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(0, sniper.id)
    advance(engine, 12)
    expect(engine.getSnapshot().projectiles.length).toBe(0)
    expect(engine.getSnapshot().kills).toBe(0)
    expect(engine.getLeaks()).toBe(1)
  })
})
