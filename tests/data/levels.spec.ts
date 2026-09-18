import { describe, expect, it } from 'vitest'

import { getEnemy } from '@/game/data/enemies'
import {
  getEndlessLevel,
  getEndlessWave,
  getLevel,
  listLevels,
} from '@/game/data/levels'
import { ENDLESS } from '@/game/data/balance'
import { expandPathCells } from '@/game/path'
import type { LevelDef } from '@/game/types'

function checkLevel(level: LevelDef) {
  const { cols, rows } = level.grid

  it(`[${level.id} ${level.name}] 路径为轴对齐且在扩展边界内`, () => {
    for (let i = 0; i + 1 < level.path.length; i++) {
      const a = level.path[i]!
      const b = level.path[i + 1]!
      expect(a.x === b.x || a.y === b.y, `段${i}`).toBe(true)
    }
    for (const p of level.path) {
      expect(p.x).toBeGreaterThanOrEqual(-1)
      expect(p.x).toBeLessThanOrEqual(cols)
      expect(p.y).toBeGreaterThanOrEqual(-1)
      expect(p.y).toBeLessThanOrEqual(rows)
    }
  })

  it(`[${level.id} ${level.name}] 建造格不压路径、在界内、不重复`, () => {
    const pathCells = expandPathCells(level.path)
    const seen = new Set<string>()
    for (const slot of level.buildSlots) {
      const key = `${slot.x},${slot.y}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
      expect(slot.x, key).toBeGreaterThanOrEqual(0)
      expect(slot.x, key).toBeLessThanOrEqual(cols - 1)
      expect(slot.y, key).toBeGreaterThanOrEqual(0)
      expect(slot.y, key).toBeLessThanOrEqual(rows - 1)
      expect(pathCells.has(key), `建造格 ${key} 压在路径上`).toBe(false)
    }
    expect(level.buildSlots.length).toBeGreaterThanOrEqual(10)
  })

  it(`[${level.id} ${level.name}] 波次引用合法且末波含 Boss`, () => {
    if (level.endless) return
    expect(level.waves.length).toBeGreaterThanOrEqual(5)
    expect(level.waves.length).toBeLessThanOrEqual(8)
    for (const wave of level.waves) {
      expect(wave.reward).toBeGreaterThanOrEqual(40)
      expect(wave.reward).toBeLessThanOrEqual(90)
      for (const entry of wave.entries) {
        expect(() => getEnemy(entry.enemyId)).not.toThrow()
        expect(entry.count).toBeGreaterThan(0)
        expect(entry.interval).toBeGreaterThan(0)
        if (entry.delay !== undefined) expect(entry.delay).toBeGreaterThan(0)
      }
    }
    const lastWave = level.waves[level.waves.length - 1]!
    expect(
      lastWave.entries.some((e) => getEnemy(e.enemyId).boss),
      '末波应有 Boss',
    ).toBe(true)
  })

  it(`[${level.id} ${level.name}] 经济参数在规格区间`, () => {
    expect(level.startGold).toBeGreaterThanOrEqual(220)
    expect(level.startGold).toBeLessThanOrEqual(500)
    expect(level.baseHp).toBeGreaterThanOrEqual(10)
    expect(level.hpMul).toBeGreaterThanOrEqual(1)
    if (!level.endless) {
      expect(level.firstClearCatnip).toBeGreaterThanOrEqual(200)
      expect(level.repeatClearCatnip).toBeLessThan(level.firstClearCatnip)
    }
  })
}

describe('普通关卡数据（1~8）', () => {
  const levels = listLevels()

  it('共 8 关、顺序编号、名称唯一', () => {
    expect(levels.map((l) => l.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    const names = levels.map((l) => l.name)
    expect(new Set(names).size).toBe(names.length)
  })

  for (const level of levels) checkLevel(level)
})

describe('无尽模式', () => {
  const level = getEndlessLevel()
  checkLevel(level)

  it('波次生成器：结构合法', () => {
    for (let n = 1; n <= 50; n++) {
      const wave = getEndlessWave(n)
      expect(wave.entries.length).toBeGreaterThanOrEqual(1)
      for (const entry of wave.entries) {
        expect(() => getEnemy(entry.enemyId)).not.toThrow()
        expect(entry.count).toBeGreaterThan(0)
        expect(entry.interval).toBeGreaterThan(0)
      }
      expect(wave.hpMul).toBeGreaterThan(0)
    }
  })

  it('难度爬坡：hpMul 每 5 波乘 1.35，speedMul 每 5 跳 +3%，均逐波不下降', () => {
    let prevHp = 0
    let prevSpeed = 0
    for (let n = 1; n <= 50; n++) {
      const wave = getEndlessWave(n)
      expect(wave.hpMul!).toBeGreaterThanOrEqual(prevHp)
      expect(wave.speedMul!).toBeGreaterThanOrEqual(prevSpeed)
      prevHp = wave.hpMul!
      prevSpeed = wave.speedMul!
    }
    expect(getEndlessWave(1).hpMul).toBe(1)
    expect(getEndlessWave(1).speedMul).toBe(1)
    expect(getEndlessWave(6).hpMul).toBeCloseTo(ENDLESS.RAMP_HP_MULT, 8)
    expect(getEndlessWave(6).speedMul).toBeCloseTo(1 + ENDLESS.RAMP_SPEED_PER_JUMP, 8)
    expect(getEndlessWave(11).hpMul).toBeCloseTo(ENDLESS.RAMP_HP_MULT ** 2, 8)
  })

  it('波次生成器：数量有上限（防超长挂机性能退化）', () => {
    for (let n = 1; n <= 60; n++) {
      for (const entry of getEndlessWave(n).entries) {
        expect(entry.count).toBeLessThanOrEqual(60)
      }
    }
  })

  it('波次奖励随难度跳放大（收入跟得上爬坡）', () => {
    // 第 1 跳内不放大：wave1 = 42、wave5 = 50
    expect(getEndlessWave(1).reward).toBe(42)
    expect(getEndlessWave(5).reward).toBe(50)
    // 第 2 跳起 ×1.22：wave6 = round(52 × 1.22) = 63
    expect(getEndlessWave(6).reward).toBe(Math.round(52 * 1.22))
    // wave11 = round(62 × 1.22²) = 92
    expect(getEndlessWave(11).reward).toBe(Math.round(62 * 1.22 ** 2))
  })

  it('每 5 波出 Boss，20 波起双 Boss', () => {
    for (let n = 1; n <= 30; n++) {
      const hasBoss = getEndlessWave(n).entries.some(
        (e) => getEnemy(e.enemyId).boss,
      )
      expect(hasBoss, `wave ${n}`).toBe(n % 5 === 0)
    }
    expect(
      getEndlessWave(20).entries.find((e) => getEnemy(e.enemyId).boss)!.count,
    ).toBe(2)
  })

  it('早期波次不含未解锁敌人类型', () => {
    expect(
      getEndlessWave(1).entries.some((e) => e.enemyId !== 'mouse'),
    ).toBe(false)
    expect(getEndlessWave(2).entries.some((e) => e.enemyId === 'swift')).toBe(true)
    expect(getEndlessWave(3).entries.some((e) => e.enemyId === 'crow')).toBe(true)
    expect(getEndlessWave(4).entries.some((e) => e.enemyId === 'shield')).toBe(true)
  })
})

describe('关卡查询', () => {
  it('getLevel 支持 1~8 与 endless，未知 id 抛错', () => {
    expect(getLevel('1').name).toBe('后院保卫战')
    expect(getLevel('endless').name).toBe('星空粮仓')
    expect(() => getLevel('9')).toThrow()
    expect(() => getLevel('nope')).toThrow()
  })

  it('血量乘数按关卡递增', () => {
    const muls = listLevels().map((l) => l.hpMul)
    for (let i = 1; i < muls.length; i++) {
      expect(muls[i]!).toBeGreaterThan(muls[i - 1]!)
    }
  })
})
