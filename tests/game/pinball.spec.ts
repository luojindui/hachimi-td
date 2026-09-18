import { describe, expect, it } from 'vitest'

import { PinballMachine } from '@/game/pinball'
import { PINBALL } from '@/game/pinball'

function playToLanding(seed: number, launchX: number): PinballMachine {
  const machine = new PinballMachine(seed)
  machine.setLaunchX(launchX)
  machine.launch()
  const step = 1 / 60
  for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += step) {
    machine.step(step)
  }
  return machine
}

describe('弹珠机物理', () => {
  it('发射后球在限定时间内落入某个合法槽位', () => {
    const machine = playToLanding(42, 180)
    expect(machine.landedSlot).not.toBeNull()
    expect(machine.landedSlot!).toBeGreaterThanOrEqual(0)
    expect(machine.landedSlot!).toBeLessThan(7)
    expect(machine.totalReward!).toBeGreaterThan(0)
  })

  it('确定性：相同种子 + 相同发射位置 → 相同结果', () => {
    const run = (seed: number) => {
      const machine = new PinballMachine(seed)
      machine.setLaunchX(120)
      machine.launch()
      const step = 1 / 60
      for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += step) {
        machine.step(step)
      }
      return { slot: machine.landedSlot, reward: machine.totalReward }
    }
    expect(run(1234)).toEqual(run(1234))
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
        // 物理不变量：球心在 [WALL+BALL_R, WIDTH-WALL-BALL_R]
        expect(ball.x).toBeGreaterThanOrEqual(PINBALL.WALL + PINBALL.BALL_R)
        expect(ball.x).toBeLessThanOrEqual(
          PINBALL.WIDTH - PINBALL.WALL - PINBALL.BALL_R,
        )
      }
    }
  })

  it('step 对非法 dt 防御（NaN/负数/Infinity 不推进不污染）', () => {
    const machine = new PinballMachine(3)
    machine.setLaunchX(180)
    machine.launch()
    machine.step(Number.NaN)
    machine.step(-1)
    machine.step(Infinity)
    expect(machine.rolling).toBe(true)
    const ball = machine.ball!
    expect(Number.isFinite(ball.x)).toBe(true)
    expect(Number.isFinite(ball.y)).toBe(true)
  })

  it('setLaunchX 钳制到有效范围，rolling 中被忽略', () => {
    const machine = new PinballMachine(5)
    machine.setLaunchX(-999)
    expect(machine.currentLaunchX).toBe(PINBALL.WALL + PINBALL.BALL_R)
    machine.setLaunchX(99999)
    expect(machine.currentLaunchX).toBe(
      PINBALL.WIDTH - PINBALL.WALL - PINBALL.BALL_R,
    )
    machine.launch()
    const before = machine.currentLaunchX
    machine.setLaunchX(200) // rolling 中应被忽略
    expect(machine.currentLaunchX).toBe(before)
  })

  it('forceSettle：强制按最近槽位结算', () => {
    const machine = new PinballMachine(11)
    machine.setLaunchX(180)
    machine.launch()
    machine.step(0.5)
    machine.forceSettle()
    expect(machine.rolling).toBe(false)
    expect(machine.landed).toBe(true)
    expect(machine.landedSlot).not.toBeNull()
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

describe('金钉与奖励', () => {
  it('金钉奖励可触发（多种子扫描）', () => {
    let maxGold = 0
    for (let i = 0; i < 30; i++) {
      const machine = playToLanding(300 + i, 40 + ((i * 53) % 280))
      maxGold = Math.max(maxGold, machine.goldEarned)
    }
    expect(maxGold).toBeGreaterThanOrEqual(PINBALL.GOLD_PEG_BONUS)
  })

  it('goldEarned 在每次掉落间重置', () => {
    // 找一个能吃到金钉的种子
    let seed = 0
    let machine = new PinballMachine(seed)
    for (let i = 0; i < 50; i++) {
      machine = new PinballMachine(300 + i)
      machine.setLaunchX(40 + ((i * 53) % 280))
      machine.launch()
      for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += 1 / 60) {
        machine.step(1 / 60)
      }
      if (machine.goldEarned > 0) break
    }
    expect(machine.goldEarned).toBeGreaterThan(0)
    machine.launch()
    expect(machine.goldEarned).toBe(0)
  })
})

describe('奖励分布抽样（对称钉板健康度）', () => {
  it('200 球：均值落在设计区间 [80, 160]，全部合法落槽', () => {
    let sum = 0
    let jackpots = 0
    const n = 200
    for (let i = 0; i < n; i++) {
      const machine = new PinballMachine(900 + i)
      machine.setLaunchX(
        PINBALL.WALL + PINBALL.BALL_R + ((i * 97) % 313),
      )
      machine.launch()
      const step = 1 / 60
      for (let t = 0; t < PINBALL.SETTLE_TIMEOUT + 1 && machine.rolling; t += step) {
        machine.step(step)
      }
      const reward = machine.totalReward
      expect(reward).not.toBeNull()
      expect(Number.isFinite(reward!)).toBe(true)
      sum += reward!
      const slot = machine.landedSlot!
      if (machine.slots[slot]!.jackpot) jackpots++
    }
    const mean = sum / n
    // 奖励表 ×0.65 重校后：均值 ≈100（RTP≈1.0~1.1）
    expect(mean).toBeGreaterThanOrEqual(60)
    expect(mean).toBeLessThanOrEqual(140)
    // 大奖不再可被贴墙走廊白嫖：占比 < 20%
    expect(jackpots / n).toBeLessThan(0.2)
  })
})
