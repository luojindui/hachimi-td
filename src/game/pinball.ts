/**
 * 哈基米弹珠屋：纯 TS 物理弹珠机（无 DOM 依赖，可单测）。
 * 玩法：选择发射位置 → 毛线球在钉板间弹跳 → 落入底部奖励槽。
 */

export interface PinballSlot {
  x0: number
  x1: number
  /** 落入该槽的猫薄荷奖励 */
  catnip: number
  /** 大奖槽 */
  jackpot: boolean
}

export interface PinballPeg {
  x: number
  y: number
  r: number
  gold: boolean
}

export interface PinballBall {
  x: number
  y: number
  vx: number
  vy: number
}

export interface PinballReward {
  /** 槽位奖励 + 金钉加成 */
  catnip: number
  /** 命中的金钉数 */
  goldPegs: number
  slotIndex: number
  jackpot: boolean
}

export const PINBALL = {
  COST: 100,
  WIDTH: 360,
  HEIGHT: 480,
  WALL: 8,
  BALL_R: 9,
  PEG_R: 5,
  GRAVITY: 1400,
  PEG_REST: 0.6,
  WALL_REST: 0.5,
  /** 球心到达此线即判定落入奖励槽 */
  SLOT_Y: 432,
  /** 物理兜底：超时按最近槽位结算 */
  SETTLE_TIMEOUT: 12,
  /** 金钉单次碰撞奖励（猫薄荷） */
  GOLD_PEG_BONUS: 15,
  PEG_ROWS: 6,
  /** 边缘大奖 */
  JACKPOT_CATNIP: 400,
} as const

/** 底部 7 槽（对称：边缘窄槽大奖，中间宽槽小奖），按内宽比例分割 */
const SLOT_FRACTIONS = [0.09, 0.13, 0.17, 0.22, 0.17, 0.13, 0.09] as const
const SLOT_REWARDS = [400, 60, 100, 25, 100, 60, 400] as const

function buildSlots(): PinballSlot[] {
  const slots: PinballSlot[] = []
  const span = PINBALL.WIDTH - PINBALL.WALL * 2
  let x = PINBALL.WALL
  for (let i = 0; i < SLOT_FRACTIONS.length; i++) {
    const w = span * SLOT_FRACTIONS[i]!
    slots.push({
      x0: x,
      x1: x + w,
      catnip: SLOT_REWARDS[i]!,
      jackpot: i === 0 || i === SLOT_FRACTIONS.length - 1,
    })
    x += w
  }
  return slots
}

function buildPegs(): PinballPeg[] {
  const pegs: PinballPeg[] = []
  const { WALL, WIDTH } = PINBALL
  const span = WIDTH - WALL * 2
  for (let row = 0; row < PINBALL.PEG_ROWS; row++) {
    const y = 90 + row * 44
    const count = row % 2 === 0 ? 7 : 6
    const step = span / (count + 1)
    for (let i = 0; i < count; i++) {
      pegs.push({
        x: WALL + step * (i + 1) + (row % 2 === 0 ? 0 : step / 2),
        y,
        r: PINBALL.PEG_R,
        gold: false,
      })
    }
  }
  // 3 颗固定位置的金钉
  const goldIdx = [5, 16, 30]
  for (const gi of goldIdx) {
    if (pegs[gi]) pegs[gi]!.gold = true
  }
  return pegs
}

/** 确定性随机源（mulberry32） */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export class PinballMachine {
  readonly pegs: PinballPeg[] = buildPegs()
  readonly slots: PinballSlot[] = buildSlots()
  ball: PinballBall | null = null
  /** 本次掉落已获得的金钉加成 */
  goldEarned = 0
  landedSlot: number | null = null
  landed = false
  elapsed = 0

  private launchX = PINBALL.WIDTH / 2
  private readonly crateSeedRng: () => number
  private readonly goldHit = new Set<number>()

  constructor(seed = Date.now() >>> 0) {
    this.crateSeedRng = mulberry32(seed)
  }

  get rolling(): boolean {
    return this.ball !== null
  }

  get totalReward(): number | null {
    if (this.landedSlot === null) return null
    return (this.slots[this.landedSlot]?.catnip ?? 0) + this.goldEarned
  }

  /** 设置发射位置（发射前可调整） */
  setLaunchX(x: number): void {
    if (this.rolling) return
    this.launchX = Math.max(
      PINBALL.WALL + PINBALL.BALL_R,
      Math.min(PINBALL.WIDTH - PINBALL.WALL - PINBALL.BALL_R, x),
    )
  }

  get currentLaunchX(): number {
    return this.launchX
  }

  /** 发射：毛线球从顶部落下，带轻微随机横向速度 */
  launch(): void {
    if (this.rolling) return
    this.landed = false
    this.landedSlot = null
    this.goldEarned = 0
    this.goldHit.clear()
    this.elapsed = 0
    const jitter = (this.crateSeedRng() - 0.5) * 60
    this.ball = {
      x: this.launchX,
      y: 24,
      vx: jitter,
      vy: 0,
    }
  }

  /** 推进物理（秒）。返回 landed 表示本球已结算 */
  step(dt: number): 'rolling' | 'landed' {
    const ball = this.ball
    if (!ball) return 'landed'
    this.elapsed += dt
    if (this.elapsed > PINBALL.SETTLE_TIMEOUT) {
      this.resolveNearest(ball.x)
      return 'landed'
    }
    const sub = 4
    const h = dt / sub
    for (let i = 0; i < sub; i++) {
      ball.vy += PINBALL.GRAVITY * h
      ball.x += ball.vx * h
      ball.y += ball.vy * h

      // 墙壁
      const minX = PINBALL.WALL + PINBALL.BALL_R
      const maxX = PINBALL.WIDTH - PINBALL.WALL - PINBALL.BALL_R
      if (ball.x < minX) {
        ball.x = minX
        ball.vx = Math.abs(ball.vx) * PINBALL.WALL_REST
      } else if (ball.x > maxX) {
        ball.x = maxX
        ball.vx = -Math.abs(ball.vx) * PINBALL.WALL_REST
      }

      // 钉子碰撞
      for (const peg of this.pegs) {
        const dx = ball.x - peg.x
        const dy = ball.y - peg.y
        const distSq = dx * dx + dy * dy
        const minDist = peg.r + PINBALL.BALL_R
        if (distSq < minDist * minDist && distSq > 1e-9) {
          const dist = Math.sqrt(distSq)
          const nx = dx / dist
          const ny = dy / dist
          // 推出重叠
          ball.x = peg.x + nx * minDist
          ball.y = peg.y + ny * minDist
          // 沿法线反射
          const vn = ball.vx * nx + ball.vy * ny
          ball.vx -= (1 + PINBALL.PEG_REST) * vn * nx
          ball.vy -= (1 + PINBALL.PEG_REST) * vn * ny
          // 金钉奖励（每颗每次掉落只结算一次）
          if (peg.gold && !this.goldHit.has(peg.x)) {
            this.goldHit.add(peg.x)
            this.goldEarned += PINBALL.GOLD_PEG_BONUS
          }
        }
      }

      // 落入奖励槽
      if (ball.y >= PINBALL.SLOT_Y - PINBALL.BALL_R) {
        this.resolveSlot(ball.x)
        return 'landed'
      }
    }
    return 'rolling'
  }

  private resolveSlot(x: number): void {
    const idx = this.slots.findIndex((s) => x >= s.x0 && x <= s.x1)
    this.landedSlot = idx >= 0 ? idx : this.nearestSlotIndex(x)
    this.ball = null
    this.landed = true
  }

  private resolveNearest(x: number): void {
    this.ball = null
    this.landedSlot = this.nearestSlotIndex(x)
    this.landed = true
  }

  private nearestSlotIndex(x: number): number {
    let best = 0
    let bestDist = Infinity
    this.slots.forEach((s, i) => {
      const center = (s.x0 + s.x1) / 2
      const d = Math.abs(center - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  }
}
