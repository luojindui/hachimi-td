import { CELL_SIZE, ENGINE } from '@/game/data/balance'
import { cellKey, expandPathCells } from '@/game/path'
import type { BattleSnapshot, LevelDef } from '@/game/types'
import { assets } from './registry'

const PATH_CACHE = new WeakMap<LevelDef, Set<string>>()

function pathCellsOf(level: LevelDef): Set<string> {
  let cells = PATH_CACHE.get(level)
  if (!cells) {
    cells = expandPathCells(level.path)
    PATH_CACHE.set(level, cells)
  }
  return cells
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function emoji(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): void {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** 逻辑画布尺寸 */
export function battleCanvasSize(level: LevelDef): {
  width: number
  height: number
} {
  return { width: level.grid.cols * CELL_SIZE, height: level.grid.rows * CELL_SIZE }
}

export interface RenderHighlight {
  /** 拖拽悬停的建造格下标 */
  slotIndex: number
  /** 该格当前是否可放置（绿=可，红=否） */
  valid: boolean
}

/**
 * 把一帧战斗快照画到画布上（逻辑像素坐标，调用方负责 dpr 缩放）。
 * 纯函数式：只读快照与关卡定义，无内部状态。
 */
export function renderBattle(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
  level: LevelDef,
  highlight?: RenderHighlight | null,
): void {
  const A = assets()
  const tiles = A.tiles(level.theme)
  const W = level.grid.cols * CELL_SIZE
  const H = level.grid.rows * CELL_SIZE

  /* ---- 场地 ---- */
  ctx.fillStyle = tiles.bg
  ctx.fillRect(0, 0, W, H)

  /* ---- 路径 ---- */
  ctx.fillStyle = tiles.path
  const inset = 5
  for (const key of pathCellsOf(level)) {
    const [cx, cy] = key.split(',').map(Number) as [number, number]
    roundedRect(
      ctx,
      cx * CELL_SIZE + inset,
      cy * CELL_SIZE + inset,
      CELL_SIZE - inset * 2,
      CELL_SIZE - inset * 2,
      10,
    )
    ctx.fill()
  }

  /* ---- 建造格 ---- */
  const occupied = new Set(snapshot.towers.map((t) => t.slotIndex))
  ctx.setLineDash([7, 5])
  ctx.lineWidth = 2
  level.buildSlots.forEach((slot, index) => {
    if (occupied.has(index)) return
    ctx.fillStyle = tiles.slotFill
    ctx.strokeStyle = tiles.slotStroke
    roundedRect(
      ctx,
      slot.x * CELL_SIZE + 8,
      slot.y * CELL_SIZE + 8,
      CELL_SIZE - 16,
      CELL_SIZE - 16,
      12,
    )
    ctx.fill()
    ctx.stroke()
  })
  ctx.setLineDash([])

  /* ---- 拖拽悬停高亮 ---- */
  if (highlight && !occupied.has(highlight.slotIndex)) {
    const slot = level.buildSlots[highlight.slotIndex]
    if (slot) {
      ctx.lineWidth = 4.5
      ctx.strokeStyle = highlight.valid ? '#58b368' : '#e04b4b'
      ctx.fillStyle = highlight.valid
        ? 'rgba(88,179,104,0.35)'
        : 'rgba(224,75,75,0.22)'
      roundedRect(
        ctx,
        slot.x * CELL_SIZE + 5,
        slot.y * CELL_SIZE + 5,
        CELL_SIZE - 10,
        CELL_SIZE - 10,
        14,
      )
      ctx.fill()
      ctx.stroke()
      emoji(
        ctx,
        highlight.valid ? '✅' : '🚫',
        slot.x * CELL_SIZE + CELL_SIZE / 2,
        slot.y * CELL_SIZE + CELL_SIZE / 2 + 22,
        15,
      )
    }
  }

  /* ---- 鼠洞与粮仓 ---- */
  const spawnCell = level.path[0]!
  emoji(
    ctx,
    A.icon('spawn'),
    Math.max(0, spawnCell.x) * CELL_SIZE + CELL_SIZE / 2,
    Math.max(0, spawnCell.y) * CELL_SIZE + CELL_SIZE / 2,
    34,
  )
  const baseCell = level.path[level.path.length - 1]!
  emoji(
    ctx,
    A.icon('home'),
    Math.min(baseCell.x, level.grid.cols - 1) * CELL_SIZE + CELL_SIZE / 2,
    Math.min(baseCell.y, level.grid.rows - 1) * CELL_SIZE + CELL_SIZE / 2,
    40,
  )

  /* ---- 宠物塔 ---- */
  for (const tower of snapshot.towers) {
    const visual = A.petVisual(tower.petId)
    const cx = tower.x * CELL_SIZE + CELL_SIZE / 2
    const cy = tower.y * CELL_SIZE + CELL_SIZE / 2
    const ring = A.rarityColor(visual.rarity)

    // 底座阴影 + 稀有度描边圆底
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.beginPath()
    ctx.ellipse(cx, cy + 18, 22, 8, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fffdf8'
    ctx.strokeStyle = ring
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(cx, cy + 2, 23 * visual.scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    emoji(ctx, visual.emoji, cx, cy + 2, 28 * visual.scale)

    // 等级标记点
    ctx.fillStyle = ring
    for (let i = 0; i < tower.level - 1; i++) {
      ctx.beginPath()
      ctx.arc(cx - 7 + i * 14, cy + 24 * visual.scale + 6, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /* ---- 敌人 ---- */
  for (const enemy of snapshot.enemies) {
    const visual = A.enemyVisual(enemy.enemyId)
    const size = (enemy.boss ? 26 : 18) * visual.scale
    const cx = enemy.x * CELL_SIZE + CELL_SIZE / 2
    const cy = enemy.y * CELL_SIZE + CELL_SIZE / 2 - (enemy.flying ? 8 : 0)

    // 阴影（飞行单位阴影偏下更明显）
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(cx, enemy.y * CELL_SIZE + CELL_SIZE / 2 + 14, size * 0.6, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    // 识别色圆底
    ctx.fillStyle = visual.tint
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    ctx.arc(cx, cy, size, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    emoji(ctx, visual.emoji, cx, cy, size * 1.5)

    // 状态标记
    if (enemy.slowed) {
      ctx.strokeStyle = '#6ec6ff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy, size + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (enemy.howled) {
      ctx.fillStyle = '#ffd75e'
      emoji(ctx, A.icon('speed'), cx + size + 6, cy - size, 14)
    }

    // 血条
    const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0
    const barW = enemy.boss ? 44 : 32
    const barY = cy - size - 10
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    roundedRect(ctx, cx - barW / 2, barY, barW, 6, 3)
    ctx.fill()
    ctx.fillStyle = hpRatio > 0.5 ? '#58b368' : hpRatio > 0.25 ? '#f0a24a' : '#e04b4b'
    if (hpRatio > 0) {
      roundedRect(ctx, cx - barW / 2, barY, Math.max(4, barW * hpRatio), 6, 3)
      ctx.fill()
    }
  }

  /* ---- 弹道（视觉经素材注册表解析，可整体替换） ---- */
  for (const proj of snapshot.projectiles) {
    ctx.save()
    ctx.translate(proj.x * CELL_SIZE + CELL_SIZE / 2, proj.y * CELL_SIZE + CELL_SIZE / 2)
    ctx.rotate(proj.angle)
    emoji(ctx, A.projectileOf(proj.petId), 0, 0, 18)
    ctx.restore()
  }

  /* ---- 漂浮文字 ---- */
  const floatLife = ENGINE.FLOAT_TEXT_LIFE
  for (const float of snapshot.floatTexts) {
    const progress = 1 - float.life / floatLife
    const alpha = Math.max(0, Math.min(1, float.life / floatLife))
    const fx = float.x * CELL_SIZE + CELL_SIZE / 2
    const fy = float.y * CELL_SIZE + CELL_SIZE / 2 - progress * 22
    ctx.font = 'bold 15px "PingFang SC", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = alpha
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.strokeText(float.text, fx, fy)
    ctx.fillStyle = float.kind === 'gold' ? '#e8940f' : '#e04b4b'
    ctx.fillText(float.text, fx, fy)
    ctx.globalAlpha = 1
  }
}

/** 由画布点击坐标换算格子坐标；不在网格内返回 null */
export function cellFromPoint(
  level: LevelDef,
  cssX: number,
  cssY: number,
  cssWidth: number,
): { x: number; y: number } | null {
  const scale = (level.grid.cols * CELL_SIZE) / cssWidth
  const x = Math.floor(cssX * scale / CELL_SIZE)
  const y = Math.floor(cssY * scale / CELL_SIZE)
  if (x < 0 || x >= level.grid.cols || y < 0 || y >= level.grid.rows) return null
  return { x, y }
}

/** 找到格子对应的建造格下标 */
export function slotIndexAt(level: LevelDef, x: number, y: number): number | null {
  const key = cellKey(x, y)
  const index = level.buildSlots.findIndex((s) => cellKey(s.x, s.y) === key)
  return index >= 0 ? index : null
}
