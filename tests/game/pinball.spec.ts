import { describe, expect, it } from 'vitest'

import { PinballMachine } from '@/game/pinball'
import { PINBALL } from '@/game/pinball'

function playToLanding(seed: number, launchX: number): {
  slot: number | null
  reward: number | null
} {
  const machine = new PinballMachine(seed)
  machine.setLaunchX(launchX)
  machine.launch()
  const step = 1 / 60
  for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += step) {
    machine.step(step)
  }
  return { slot: machine.landedSlot, reward: machine.totalReward }
}

describe('弹珠机物理', () => {
  it('发射后球在限定时间内落入某个合法槽位', () => {
    const { slot, reward } = playToLanding(42, 180)
    expect(slot).not.toBeNull()
    expect(slot!).toBeGreaterThanOrEqual(0)
    expect(slot!).toBeLessThan(7)
    expect(reward!).toBeGreaterThan(0)
  })

  it('确定性：相同种子 + 相同发射位置 → 相同结果', () => {
    const a = playToLanding(1234, 120)
    const b = playToLanding(1234, 120)
    expect(a).toEqual(b)
  })

  it('球不会飞出墙壁或产生 NaN', () => {
    const machine = new PinballMachine(7)
    machine.setLaunchX(30)
    machine.launch()
    const step = 1 / 60
    for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += step) {
      machine.step(step)
      const ball = machine.ball
      if (ball) {
        expect(Number.isFinite(ball.x)).toBe(true)
        expect(Number.isFinite(ball.y)).toBe(true)
        expect(ball.x).toBeGreaterThanOrEqual(PINBALL.WALL)
        expect(ball.x).toBeLessThanOrEqual(PINBALL.WIDTH - PINBALL.WALL)
      }
    }
  })

  it('slot 分布覆盖全宽且互不重叠', () => {
    const machine = new PinballMachine(1)
    expect(machine.slots[0]!.x0).toBe(PINBALL.WALL)
    for (let i = 1; i < machine.slots.length; i++) {
      expect(machine.slots[i]!.x0).toBe(machine.slots[i - 1]!.x1)
    }
    expect(machine.slots[machine.slots.length - 1]!.x1).toBeCloseTo(
      PINBALL.WIDTH - PINBALL.WALL,
      6,
    )
  })
})

describe('奖励分布抽样（健康度检查）', () => {
  it('200 球全部合法落槽，且不存在 NaN/越界', () => {
    let jackpots = 0
    for (let i = 0; i < 200; i++) {
      const { slot, reward } = playToLanding(500 + i, 30 + ((i * 37) % 300))
      expect(slot).not.toBeNull()
      expect(slot!).toBeGreaterThanOrEqual(0)
      expect(slot!).toBeLessThan(7)
      expect(Number.isFinite(reward!)).toBe(true)
      if (slot === 0 || slot === 6) jackpots++
    }
    // 大奖（边缘槽）应出现但不应泛滥
    expect(jackpots).toBeGreaterThan(0)
    expect(jackpots).toBeLessThan(100)
  })
})
