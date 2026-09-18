import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { listLevels } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import { advance, makeEngine, makeWave } from './helpers'
import { expandPathCells } from '@/game/path'

/** 固定 rng：第一抽 0（金币 40+0=40），第二抽 0.5（<0.1 为 false → 不翻倍） */
const NO_DOUBLE = () => 0.5

const cat = getPet('tianyuan-cat')

describe('地图宝箱', () => {
  it('每关生成 2~3 个宝箱，位置确定且不压路径/建造格', () => {
    for (const level of listLevels()) {
      const engine = new GameEngine({
        level,
        lineup: [cat],
        draftsEnabled: false,
      })
      const crates = engine.getSnapshot().crates
      expect(crates.length, level.id).toBeGreaterThanOrEqual(2)
      expect(crates.length, level.id).toBeLessThanOrEqual(3)
      const pathCells = expandPathCells(level.path)
      const slotKeys = new Set(
        level.buildSlots.map((s) => `${s.x},${s.y}`),
      )
      for (const crate of crates) {
        const key = `${crate.x},${crate.y}`
        expect(pathCells.has(key), key).toBe(false)
        expect(slotKeys.has(key), key).toBe(false)
      }
      // 位置确定性：同关卡再建一个引擎，宝箱位置一致
      const again = new GameEngine({ level, lineup: [cat], draftsEnabled: false })
      expect(again.getSnapshot().crates).toEqual(crates)
    }
  })

  it('开宝箱获得小鱼干并标记已开', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      rng: NO_DOUBLE,
      drafts: false,
    })
    const crates = engine.getSnapshot().crates
    expect(crates.length).toBeGreaterThan(0)
    const before = engine.getGold()
    const result = engine.openCrate(crates[0]!.id)
    expect(result).toEqual({ gold: 60 })
    expect(engine.getGold()).toBe(before + 60)
    expect(engine.getSnapshot().crates[0]!.opened).toBe(true)
  })

  it('重复开启返回 null 且不重复给钱', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      rng: NO_DOUBLE,
      drafts: false,
    })
    const id = engine.getSnapshot().crates[0]!.id
    engine.openCrate(id)
    const before = engine.getGold()
    expect(engine.openCrate(id)).toBeNull()
    expect(engine.getGold()).toBe(before)
  })

  it('战斗结束后不可开箱', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 40)],
      firstWaveCountdown: 0.1,
      drafts: false,
    })
    // 不放塔，让鼠漏怪到胜利（单波清空即胜利）
    advance(engine, 12)
    expect(engine.getOutcome()).not.toBe('ongoing')
    const crates = engine.getSnapshot().crates
    expect(() => engine.openCrate(crates[0]!.id)).toThrow('战斗已结束')
  })

  it('金箍棒 rng 触发翻倍：40 × 2 = 80', () => {
    const engine = makeEngine({
      lineup: [cat],
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      // 第一抽 0.05 → 金币 42；第二抽 0.05 → <0.1 翻倍 → 84
      rng: () => 0.05,
      drafts: false,
    })
    const id = engine.getSnapshot().crates[0]!.id
    const before = engine.getGold()
    engine.openCrate(id)
    expect(engine.getGold()).toBe(before + 84)
  })
})
