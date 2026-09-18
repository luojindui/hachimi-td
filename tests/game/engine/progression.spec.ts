import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'

type PetDefSpec = { id: string; stars: number }

/**
 * 关卡门槛回归测试：数值调平后，"合理养成度的编队"必须能通过曾经的难度墙。
 * （对应审核轮 1 数值报告：L6 对空断档、L8 期末考）
 */

interface SimResult {
  outcome: string
  baseHp: number
  baseMaxHp: number
  waveIndex: number
}

function autoPlay(
  levelId: string,
  lineupSpec: { id: string; stars: number }[],
  slots: number[],
  maxSeconds = 900,
): SimResult {
  const level = getLevel(levelId)
  const engine = new GameEngine({
    level,
    lineup: lineupSpec.map((s) => getPet(s.id)),
    starLevels: Object.fromEntries(lineupSpec.map((s) => [s.id, s.stars])),
    draftsEnabled: false, // 门槛回归不含三选一，保持确定性
  })

  const placed = new Set<string>()
  let slotCursor = 0
  const step = 0.25
  for (let t = 0; t < maxSeconds; t += step) {
    if (engine.getOutcome() !== 'ongoing') break

    // 放置：按 slots 顺序放未上场的宠物
    const nextPet = lineupSpec.find((s) => !placed.has(s.id))
    if (nextPet && slotCursor < slots.length) {
      if (engine.canPlace(slots[slotCursor]!, nextPet.id).ok) {
        engine.placeTower(slots[slotCursor]!, nextPet.id)
        placed.add(nextPet.id)
        slotCursor++
      }
    } else {
      // 升级：找第一个可负担的升级
      for (const slot of slots) {
        const cost = engine.upgradeCost(slot)
        if (cost !== null && engine.getGold() >= cost) {
          engine.upgradeTower(slot, 'quick')
          break
        }
      }
    }

    engine.update(step)
    engine.update(step)
    engine.update(step)
    engine.update(step)
  }

  const snap = engine.getSnapshot()
  return {
    outcome: snap.outcome,
    baseHp: snap.baseHp,
    baseMaxHp: snap.baseMaxHp,
    waveIndex: snap.waveIndex,
  }
}

/** 基本 N 队 + 3★ 狸花猫（对空主力），对应 L6 修复验证 */
const N_TEAM_WITH_LIHUA3: PetDefSpec[] = [
  { id: 'lihua', stars: 3 },
  { id: 'tianyuan-cat', stars: 3 },
  { id: 'tianyuan-dog', stars: 3 },
  { id: 'xiaobai', stars: 3 },
  { id: 'spotty', stars: 3 },
]

/** R 队 4★ + 狸花猫对空（R 池无对空卡，混编 N 对空是标准策略） */
const R_TEAM_4STAR: PetDefSpec[] = [
  { id: 'shiba', stars: 4 },
  { id: 'corgi', stars: 4 },
  { id: 'lihua', stars: 4 },
  { id: 'cow-cat', stars: 4 },
  { id: 'sanhua', stars: 4 },
  { id: 'bichon', stars: 4 },
]

/** N 队 2★：中期玩家编队（L2~L5 门槛） */
const N_TEAM_2STAR: PetDefSpec[] = [
  { id: 'tianyuan-cat', stars: 2 },
  { id: 'tianyuan-dog', stars: 2 },
  { id: 'lihua', stars: 2 },
  { id: 'xiaobai', stars: 2 },
  { id: 'spotty', stars: 2 },
]

/** R 队 3★ + 狸花猫 3★：后期玩家编队（L7 门槛） */
const R_TEAM_3STAR: PetDefSpec[] = [
  { id: 'shiba', stars: 3 },
  { id: 'corgi', stars: 3 },
  { id: 'cow-cat', stars: 3 },
  { id: 'sanhua', stars: 3 },
  { id: 'bichon', stars: 3 },
  { id: 'lihua', stars: 3 },
]

describe('关卡门槛回归（调平后必须可通）', () => {
  it('L1 基础 N 队 1★ 可通（新手门槛）', () => {
    const r = autoPlay(
      '1',
      [
        { id: 'tianyuan-cat', stars: 1 },
        { id: 'tianyuan-dog', stars: 1 },
        { id: 'lihua', stars: 1 },
      ],
      [1, 0, 2, 4, 3],
    )
    expect(r.outcome).toBe('victory')
  })

  it('L2~L5 中期 N 队 2★ 可通', () => {
    const slotPlans: Record<string, number[]> = {
      // 按路径分段覆盖排布（放置顺序即优先级）
      '2': [1, 2, 3, 0, 4, 9, 5, 10, 6, 11, 7, 12, 13, 8],
      '3': [4, 10, 11, 0, 1, 7, 9, 3, 5, 6, 2, 8, 12, 13],
      '4': [2, 6, 5, 0, 8, 9, 3, 1, 7, 10, 11, 4, 12],
      '5': [6, 5, 2, 4, 7, 3, 0, 1, 8, 9, 10, 11, 12, 13],
    }
    for (const id of ['2', '3', '4', '5']) {
      const r = autoPlay(id, N_TEAM_2STAR, slotPlans[id]!, 900)
      expect(r.outcome, `L${id} 结果`).toBe('victory')
    }
  }, 30000)

  it('L6 天台花园：N 队 + 3★ 狸花猫可通（对空断档修复验证）', () => {
    const r = autoPlay(
      '6',
      N_TEAM_WITH_LIHUA3,
      // 狸花猫站 (5,3)（slot 6）同时覆盖两条乌鸦路线，再补前后段
      [6, 4, 11, 9, 12, 5, 10, 13],
      1200,
    )
    expect(r.outcome).toBe('victory')
  }, 20000)

  it('L7 粮仓外围：R 队 3★ 可通', () => {
    const r = autoPlay(
      '7',
      R_TEAM_3STAR,
      // 分段覆盖：col6/row5 主战场 → row8 终段 → 起点段
      [2, 5, 3, 6, 4, 7, 12, 8, 9, 0, 1, 10, 11, 13],
      1200,
    )
    expect(r.outcome).toBe('victory')
  }, 20000)

  it('L8 粮仓大殿：R 队 4★ + 对空可通（期末考验证）', () => {
    const r = autoPlay(
      '8',
      R_TEAM_4STAR,
      [0, 1, 3, 7, 12, 14, 5, 10, 4, 16, 2, 11],
      1500,
    )
    expect(r.outcome).toBe('victory')
  }, 25000)
})
