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

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function ell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number, rot = 0,
): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill()
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  roundedRect(ctx, x, y, w, h, r)
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  style: string | CanvasGradient,
  w: number,
  fn: (k: CanvasRenderingContext2D) => void,
): void {
  ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'
  ctx.beginPath(); fn(ctx); ctx.stroke()
}

/** 确定性伪随机（场景装饰位置固定，不随帧抖动） */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** 每关主题装饰（L4 场景层）：简单矢量道具散布在非路径区域 */
function drawScenery(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
): void {
  const rand = seeded(level.theme.length * 7919 + level.grid.cols * 31)
  const pathCells = pathCellsOf(level)
  const occupied = new Set(level.buildSlots.map((s) => `${s.x},${s.y}`))

  const place = (count: number, draw: (x: number, y: number, r: () => number) => void): void => {
    let tries = 0
    let placedCount = 0
    while (placedCount < count && tries < count * 20) {
      tries++
      const gx = Math.floor(rand() * level.grid.cols)
      const gy = Math.floor(rand() * level.grid.rows)
      if (pathCells.has(`${gx},${gy}`) || occupied.has(`${gx},${gy}`)) continue
      draw(gx * CELL_SIZE + CELL_SIZE / 2, gy * CELL_SIZE + CELL_SIZE / 2, rand)
      placedCount++
    }
  }
  const grassTuft = (x: number, y: number): void => {
    strokePath(ctx, 'rgba(90,140,70,0.55)', 2.5, k => {
      k.moveTo(x - 5, y + 8); k.quadraticCurveTo(x - 7, y, x - 4, y - 8)
      k.moveTo(x, y + 8); k.quadraticCurveTo(x + 1, y - 2, x - 1, y - 11)
      k.moveTo(x + 5, y + 8); k.quadraticCurveTo(x + 8, y, x + 4, y - 7)
    })
  }
  const flower = (x: number, y: number, petal: string): void => {
    ctx.fillStyle = petal
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5
      circle(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.4)
    }
    ctx.fillStyle = '#f5c542'
    circle(ctx, x, y, 2.8)
  }
  const bush = (x: number, y: number): void => {
    ctx.fillStyle = 'rgba(70,120,60,0.5)'
    circle(ctx, x - 8, y, 11)
    circle(ctx, x + 8, y, 11)
    circle(ctx, x, y - 8, 12)
  }
  const star = (x: number, y: number): void => {
    ctx.fillStyle = 'rgba(255,240,200,0.85)'
    circle(ctx, x, y, 1.6 + rand() * 1.2)
  }
  const rock = (x: number, y: number): void => {
    ctx.fillStyle = 'rgba(120,115,105,0.6)'
    ell(ctx, x, y, 10, 7)
    ctx.fillStyle = 'rgba(160,155,145,0.5)'
    ell(ctx, x - 3, y - 3, 5, 3.4)
  }
  const sack = (x: number, y: number): void => {
    ctx.fillStyle = 'rgba(196,166,110,0.85)'
    ell(ctx, x, y, 12, 10)
    ctx.fillStyle = 'rgba(150,122,74,0.85)'
    rr(ctx, x - 6, y - 14, 12, 6, 3); ctx.fill()
  }

  switch (level.theme) {
    case 'yard':
      place(8, (x, y) => grassTuft(x, y))
      place(4, (x, y) => flower(x, y, '#ff9db4'))
      break
    case 'hall':
      place(6, (x, y) => rock(x, y))
      place(4, (x, y) => grassTuft(x, y))
      break
    case 'garden':
      place(6, (x, y) => bush(x, y))
      place(5, (x, y) => flower(x, y, '#f2a54a'))
      break
    case 'park':
      place(5, (x, y) => bush(x, y))
      place(4, (x, y) => flower(x, y, '#ffb3c0'))
      place(3, (x, y) => grassTuft(x, y))
      break
    case 'night':
      place(14, (x, y) => star(x, y))
      place(3, (x, y) => rock(x, y))
      break
    case 'rooftop':
      place(6, (x, y) => star(x, y))
      place(4, (x, y) => grassTuft(x, y))
      place(2, (x, y) => rock(x, y))
      break
    case 'granaryOut':
      place(4, (x, y) => sack(x, y))
      place(4, (x, y) => rock(x, y))
      place(3, (x, y) => grassTuft(x, y))
      break
    case 'granary':
      place(5, (x, y) => sack(x, y))
      place(3, (x, y) => rock(x, y))
      break
    case 'endless':
      place(18, (x, y) => star(x, y))
      place(3, (x, y) => rock(x, y))
      break
  }
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
 * 静态层：场地/路径/主题装饰（鼠洞与粮仓标记在动态层绘制）。
 * 每个关卡只需渲染一次（调用方缓存画布）。
 */
export function renderStaticLayer(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
): void {
  const A = assets()
  const tiles = A.tiles(level.theme)
  const W = level.grid.cols * CELL_SIZE
  const H = level.grid.rows * CELL_SIZE

  /* ---- 精灵地形（provider 提供时完全接管地面） ---- */
  if (A.drawGround) {
    A.drawGround(ctx, level)
  } else {
    /* ---- 场地 ---- */
    ctx.fillStyle = tiles.bg
    ctx.fillRect(0, 0, W, H)

    /* ---- 主题装饰（L4 场景层，画在最底层） ---- */
    drawScenery(ctx, level)

    /* ---- 路径（矢量皮肤专用；精灵皮肤由 drawGround 接管） ---- */
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
  }
}

/**
 * 动态层：建造格/宝箱/塔/敌人/弹道/特效/漂浮文字。
 * 每帧调用；不负责清屏（由静态层垫底）。
 */
export function renderDynamic(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
  level: LevelDef,
  highlight?: RenderHighlight | null,
  animTime = 0,
): void {
  const A = assets()
  const tiles = A.tiles(level.theme)
  // 精灵皮肤敌人放大后，血条/状态环/精英星等标记锚点同步放大
  const markerScale = A.markerScale?.() ?? 1

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

  /* ---- 地图宝箱（未开启） ---- */
  for (const crate of snapshot.crates) {
    if (crate.opened) continue
    const cx = crate.x * CELL_SIZE + CELL_SIZE / 2
    const cy = crate.y * CELL_SIZE + CELL_SIZE / 2
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ell(ctx, cx, cy + 16, 18, 6)
    ctx.fillStyle = '#b98a4e'
    roundedRect(ctx, cx - 17, cy - 14, 34, 28, 5)
    ctx.fill()
    ctx.fillStyle = '#96703a'
    ctx.fillRect(cx - 17, cy - 4, 34, 6)
    ctx.strokeStyle = '#7a5a2c'
    ctx.lineWidth = 2.2
    roundedRect(ctx, cx - 17, cy - 14, 34, 28, 5)
    ctx.stroke()
    ctx.fillStyle = '#ffe9a8'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', cx, cy + 1)
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
    if (!A.replacesTowerBacking) {
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
    }

    // 攻击后坐（刚发射时轻微压缩）与放置弹跳
    const recoil =
      tower.cooldownRatio > 0.85 ? (tower.cooldownRatio - 0.85) / 0.15 : 0
    const sinceSpawn = Math.max(0, snapshot.time - tower.spawnAt)

    if (A.drawPet) {
      ctx.save()
      if (recoil > 0) {
        ctx.translate(cx, cy + 2)
        ctx.scale(1 - recoil * 0.08, 1 + recoil * 0.06)
        ctx.translate(-cx, -(cy + 2))
      }
      A.drawPet(ctx, tower.petId, cx, cy + 4, 56 * visual.scale, {
        t: animTime,
        phase: tower.slotIndex * 1.7,
        sinceSpawn,
      })
      ctx.restore()
    } else {
      emoji(ctx, visual.emoji, cx, cy + 2, 28 * visual.scale)
    }

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
    const size = (enemy.boss ? 26 : 18) * visual.scale * markerScale
    const cx = enemy.x * CELL_SIZE + CELL_SIZE / 2
    const cy = enemy.y * CELL_SIZE + CELL_SIZE / 2 - (enemy.flying ? 8 : 0)

    // 阴影（飞行单位阴影偏下更明显）
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.ellipse(cx, enemy.y * CELL_SIZE + CELL_SIZE / 2 + 14, size * 0.6, 6, 0, 0, Math.PI * 2)
    ctx.fill()

    if (A.drawEnemy) {
      A.drawEnemy(ctx, enemy.enemyId, cx, cy, (enemy.boss ? 62 : 46) * visual.scale, {
        t: animTime,
        phase: enemy.id,
        flash: enemy.flash,
        facing: enemy.facing,
      })
    } else {
      // 识别色圆底
      ctx.fillStyle = visual.tint
      ctx.globalAlpha = 0.92
      ctx.beginPath()
      ctx.arc(cx, cy, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      emoji(ctx, visual.emoji, cx, cy, size * 1.5)
    }

    // 状态标记
    if (enemy.slowed) {
      ctx.strokeStyle = '#6ec6ff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy, size + 3, 0, Math.PI * 2)
      ctx.stroke()
      // 冰霜小点
      ctx.fillStyle = 'rgba(160,220,255,0.9)'
      for (let i = 0; i < 3; i++) {
        const a = animTime * 2 + (i * Math.PI * 2) / 3
        circle(ctx, cx + Math.cos(a) * (size + 6), cy + Math.sin(a) * (size + 6) * 0.5, 1.8)
      }
    }
    if (enemy.elite) {
      ctx.strokeStyle = '#c95fd0'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(cx, cy, size + 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#e18ae0'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('★', cx + size + 8, cy - size - 2)
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

  /* ---- 弹道（视觉经素材注册表解析，可整体替换）＋ 尾迹 ---- */
  for (const proj of snapshot.projectiles) {
    const px = proj.x * CELL_SIZE + CELL_SIZE / 2
    const py = proj.y * CELL_SIZE + CELL_SIZE / 2
    // 尾迹
    const trail = 16
    const grad = ctx.createLinearGradient(
      px - Math.cos(proj.angle) * trail,
      py - Math.sin(proj.angle) * trail,
      px,
      py,
    )
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,235,190,0.75)')
    strokePath(ctx, grad, 4, k => {
      k.moveTo(px - Math.cos(proj.angle) * trail, py - Math.sin(proj.angle) * trail)
      k.lineTo(px, py)
    })
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(proj.angle)
    emoji(ctx, A.projectileOf(proj.petId), 0, 0, 18)
    ctx.restore()
  }

  /* ---- 粒子特效（死亡爆散/命中/金币/嚎叫） ---- */
  for (const fx of snapshot.effects) {
    const fx2 = fx.x * CELL_SIZE + CELL_SIZE / 2
    const fy = fx.y * CELL_SIZE + CELL_SIZE / 2
    const p = fx.progress
    if (fx.kind === 'poof') {
      ctx.globalAlpha = 1 - p
      ctx.fillStyle = '#efe6d6'
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + 0.5
        const r = 6 + p * 20
        circle(ctx, fx2 + Math.cos(a) * r, fy + Math.sin(a) * r, 7 - p * 4)
      }
      ctx.fillStyle = '#fff'
      circle(ctx, fx2, fy, 10 - p * 6)
      ctx.globalAlpha = 1
    } else if (fx.kind === 'hit') {
      ctx.globalAlpha = 1 - p
      ctx.fillStyle = '#ffe9a8'
      circle(ctx, fx2, fy, 9 - p * 5)
      ctx.fillStyle = '#fff'
      circle(ctx, fx2, fy, 4 - p * 3)
      ctx.globalAlpha = 1
    } else if (fx.kind === 'coin') {
      ctx.globalAlpha = 1 - p
      ctx.fillStyle = '#f5c542'
      circle(ctx, fx2 - 5 + p * 4, fy - p * 24, 4)
      circle(ctx, fx2 + 5 - p * 2, fy - p * 30, 3.2)
      ctx.fillStyle = '#e8940f'
      circle(ctx, fx2, fy - p * 20, 3.6)
      ctx.globalAlpha = 1
    } else if (fx.kind === 'howl') {
      ctx.strokeStyle = `rgba(255,215,94,${(1 - p).toFixed(2)})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(fx2, fy, 14 + p * 42, 0, Math.PI * 2)
      ctx.stroke()
    }
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


/**
 * 便捷组合：静态层 + 动态层一帧画完（一次性渲染场景用）。
 */
export function renderBattle(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
  level: LevelDef,
  highlight?: RenderHighlight | null,
  animTime = 0,
): void {
  renderStaticLayer(ctx, level)
  renderDynamic(ctx, snapshot, level, highlight, animTime)
}
