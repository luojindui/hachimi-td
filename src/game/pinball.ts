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
  SETTLE_TIMEOUT: 6,
  /** 低速静止判定：速度低于此值持续一段时间后提前结算（防卡球微颤） */
  LOW_SPEED: 25,
  LOW_SPEED_TIME: 0.6,
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

/**
 * 以板中心 (180) 为轴的对称钉板。
 * 几何约束：任一行最靠边钉的表面与墙间距 ≥ 球径 + 2px ——
 * 球既不能被楔死在墙钉夹缝，也不能从贴墙走廊溜过。
 * 金钉按 (行内索引) 对称标记，避免扁平索引错位。
 */
function buildPegs(): PinballPeg[] {
  const pegs: PinballPeg[] = []
  const { WALL, WIDTH } = PINBALL
  const span = WIDTH - WALL * 2
  const centerX = WALL + span / 2
  // 每行的钉数与横向偏移（保证边缘间距 ≥ 球径+2）
  const rowLayout: { count: number; offset: number }[] = []
  for (let row = 0; row < PINBALL.PEG_ROWS; row++) {
    if (row % 2 === 0) rowLayout.push({ count: 7, offset: 0 })
    else rowLayout.push({ count: 6, offset: (span / 6 - span / 7) / 2 + span / 14 })
  }
  const goldMarks: { row: number; col: number }[] = [
    { row: 2, col: 3 },
    { row: 3, col: 1 },
    { row: 3, col: 4 },
  ]
  for (let row = 0; row < PINBALL.PEG_ROWS; row++) {
    const { count, offset } = rowLayout[row]!
    const spacing = span / count
    const y = 90 + row * 44
    for (let k = 0; k < count; k++) {
      pegs.push({
        x: centerX - span / 2 + offset + (k + 0.5) * spacing,
        y,
        r: PINBALL.PEG_R,
        gold: goldMarks.some((m) => m.row === row && m.col === k),
      })
    }
  }
  return pegs
}

/** 真正的 mulberry32 PRNG */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
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
  timedOut = false
  elapsed = 0
  private lowSpeedTime = 0

  private launchX = PINBALL.WIDTH / 2
  private readonly jitterRng: () => number
  private readonly goldHit = new Set<number>()

  constructor(seed = Date.now() >>> 0) {
    this.jitterRng = mulberry32(seed)
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
    this.lowSpeedTime = 0
    const jitter = (this.jitterRng() - 0.5) * 60
    this.ball = {
      x: this.launchX,
      y: 24,
      vx: jitter,
      vy: 0,
    }
  }

  /** 立即按最近槽位结算（视图卸载等场景兜底） */
  forceSettle(): void {
    if (this.ball) {
      this.resolveNearest(this.ball.x)
    }
  }

  /** 推进物理（秒）。返回 landed 表示本球已结算。
   * 非法/超大 dt 会被钳制，防穿透与 NaN 污染。 */
  step(dt: number): 'rolling' | 'landed' {
    const ball = this.ball
    if (!ball) return 'landed'
    if (!Number.isFinite(dt) || dt <= 0) return 'rolling'
    const clamped = Math.min(dt, 1 / 30)
    this.elapsed += clamped
    if (this.elapsed > PINBALL.SETTLE_TIMEOUT) {
      this.timedOut = true
      this.resolveNearest(ball.x)
      return 'landed'
    }
    // 自适应子步：单步位移不超过钉捕获直径的一半
    const sub = Math.max(4, Math.ceil((clamped * PINBALL.GRAVITY) / 40 / 14))
    const h = clamped / sub
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

      // 钉子碰撞（按索引去重金钉）
      for (let pi = 0; pi < this.pegs.length; pi++) {
        const peg = this.pegs[pi]!
        const dx = ball.x - peg.x
        const dy = ball.y - peg.y
        const distSq = dx * dx + dy * dy
        const minDist = peg.r + PINBALL.BALL_R
        if (distSq < minDist * minDist && distSq > 1e-9) {
          const dist = Math.sqrt(distSq)
          const nx = dx / dist
          const ny = dy / dist
          ball.x = peg.x + nx * minDist
          ball.y = peg.y + ny * minDist
          const vn = ball.vx * nx + ball.vy * ny
          ball.vx -= (1 + PINBALL.PEG_REST) * vn * nx
          ball.vy -= (1 + PINBALL.PEG_REST) * vn * ny
          if (peg.gold && !this.goldHit.has(pi)) {
            this.goldHit.add(pi)
            this.goldEarned += PINBALL.GOLD_PEG_BONUS
          }
        }
      }

      // 钉子推出后补一次墙钳制（防瞬时越墙）
      if (ball.x < minX) {
        ball.x = minX
        ball.vx = Math.abs(ball.vx) * PINBALL.WALL_REST
      } else if (ball.x > maxX) {
        ball.x = maxX
        ball.vx = -Math.abs(ball.vx) * PINBALL.WALL_REST
      }

      // 低速近静止：提前按最近非大奖槽结算（避免卡球微颤）
      const speed = Math.hypot(ball.vx, ball.vy)
      if (speed < PINBALL.LOW_SPEED && ball.y < PINBALL.SLOT_Y - 20) {
        this.lowSpeedTime += h
        if (this.lowSpeedTime > PINBALL.LOW_SPEED_TIME) {
          this.timedOut = true
          this.resolveNearest(ball.x)
          return 'landed'
        }
      } else {
        this.lowSpeedTime = 0
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

  /** 兜底结算：永不判大奖（防卡球白嫖 400） */
  private resolveNearest(x: number): void {
    this.ball = null
    let best = 3 // 默认中间小奖槽
    let bestDist = Infinity
    this.slots.forEach((s, i) => {
      if (s.jackpot) return
      const center = (s.x0 + s.x1) / 2
      const d = Math.abs(center - x)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    this.landedSlot = best
    this.landed = true
    this.timedOut = true
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
