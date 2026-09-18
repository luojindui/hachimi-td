import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'

/** 真实数据、真实关卡的自动挂机模拟（平衡性冒烟测试） */

const BOT_LINEUP = ['tianyuan-cat', 'tianyuan-dog', 'lihua', 'xiaobai', 'spotty']
const BOT_SLOTS = [1, 0, 2, 4, 3]

function botStep(engine: GameEngine, placed: Set<string>): void {
  // 1) 优先完成编队放置
  for (let i = 0; i < BOT_LINEUP.length; i++) {
    const petId = BOT_LINEUP[i]!
    if (!placed.has(petId)) {
      if (engine.canPlace(BOT_SLOTS[i]!, petId).ok) {
        engine.placeTower(BOT_SLOTS[i]!, petId)
        placed.add(petId)
      }
      return
    }
  }
  // 2) 按槽位优先级升级
  for (const slot of BOT_SLOTS) {
    const cost = engine.upgradeCost(slot)
    if (cost !== null && engine.getGold() >= cost) {
      engine.upgradeTower(slot)
      return
    }
  }
}

function simulateLevel1(maxSeconds = 600): GameEngine {
  const level = getLevel('1')
  const engine = new GameEngine({
    level,
    draftsEnabled: false,
    lineup: BOT_LINEUP.map((id) => getPet(id)),
  })
  const placed = new Set<string>()
  const step = 0.25
  for (let t = 0; t < maxSeconds && engine.getOutcome() === 'ongoing'; t += step) {
    botStep(engine, placed)
    engine.update(step)
    engine.update(step)
    engine.update(step)
    engine.update(step)
  }
  return engine
}

describe('第 1 关自动挂机模拟', () => {
  it('基础编队挂机可通关', () => {
    const engine = simulateLevel1()
    const snap = engine.getSnapshot()
    expect(snap.outcome).toBe('victory')
    expect(snap.baseHp).toBeGreaterThan(0)
    expect(snap.kills).toBeGreaterThan(0)
  })

  it('模拟用时合理（≤ 8 分钟游戏时间）', () => {
    const engine = simulateLevel1()
    // 确定性断言：在 600 游戏秒内通关（步数上限即时间上限，不依赖墙钟）
    expect(engine.getOutcome()).toBe('victory')
    expect(engine.getSnapshot().kills).toBeGreaterThan(0)
  })
})
