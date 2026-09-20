import { getPet } from '../../game/data/pets'
import type { AssetProvider } from '../types'
import type { LevelDef, LevelTheme, Rarity } from '../../game/types'
import type { DrawAnim, EnemyVisual, PetVisual, ThemeTiles, UiIconName } from '../types'
const BASE_URL: string = import.meta.env.BASE_URL ?? '/'

/**
 * Kenney 塔防素材皮肤（CC0 协议，无版权限制）。
 * 地形/道路/塔基/炮塔/敌人单位全部来自
 * kenney.nl "Tower Defense (Top-Down)" 素材包。
 * 宠物身份仍以 emoji 徽章呈现（军事单位 + 宠物指挥官的混搭皮肤）。
 */

interface SpriteCache {
  [file: string]: HTMLImageElement
}

const FILES = [
  'ground-grass',
  'ground-sand',
  'ground-dirt',
  'road',
  'tree',
  'bush',
  'rock',
  'tower-base',
  'turret-shooter',
  'turret-cannon',
  'turret-sniper',
  'turret-ice',
  'enemy-mouse',
  'enemy-swift',
  'enemy-shield',
  'enemy-crow',
  'enemy-ratking',
  'granary',
] as const

type SpriteFile = (typeof FILES)[number]

const cache: SpriteCache = {}

function src(file: SpriteFile): string {
  return `${BASE_URL}assets/kenney/${file}.png`
}

/** 供测试环境（napi canvas）注入已加载的精灵图 */
export function installKenneySpritesForTesting(
  images: Record<string, HTMLImageElement>,
): void {
  Object.assign(cache, images)
}

export function kenneySpritesReady(): boolean {
  return FILES.every((f) => cache[f] !== undefined)
}

/** 预加载全部精灵图；解析后即可切换到该皮肤 */
export function preloadKenneySprites(): Promise<void> {
  const jobs = FILES.map(
    (file) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          cache[file] = img
          resolve()
        }
        img.onerror = () => resolve() // 单张失败不阻塞整体
        img.src = src(file)
      }),
  )
  return Promise.all(jobs).then(() => undefined)
}

function draw(
  ctx: CanvasRenderingContext2D,
  file: SpriteFile,
  cx: number,
  cy: number,
  size: number,
  rotation = 0,
): void {
  const img = cache[file]
  if (!img || !img.complete || img.naturalWidth === 0) return
  ctx.save()
  ctx.translate(cx, cy)
  if (rotation !== 0) ctx.rotate(rotation)
  ctx.drawImage(img, -size / 2, -size / 2, size, size)
  ctx.restore()
}

/** 确定性伪随机（装饰散布用，同一关卡布局稳定） */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function pathKey(x: number, y: number): string {
  return `${x},${y}`
}

/** 敌人 id → 精灵名 */
const ENEMY_SPRITE: Record<string, SpriteFile> = {
  mouse: 'enemy-mouse',
  swift: 'enemy-swift',
  shield: 'enemy-shield',
  crow: 'enemy-crow',
  ratking: 'enemy-ratking',
}

/** 宠物定位 → 炮塔精灵 */
const ROLE_TURRET: Record<string, SpriteFile> = {
  shooter: 'turret-shooter',
  cannon: 'turret-cannon',
  sniper: 'turret-sniper',
  ice: 'turret-ice',
  support: 'turret-ice',
}

export function createKenneyProvider(vector: AssetProvider): AssetProvider {
  return {
    id: 'kenney-cc0',

    petVisual(petId: string): PetVisual {
      return vector.petVisual(petId)
    },

    enemyVisual(enemyId: string): EnemyVisual {
      return vector.enemyVisual(enemyId)
    },

    projectileOf(petId: string): string {
      return vector.projectileOf(petId)
    },

    rarityColor(rarity: Rarity): string {
      return vector.rarityColor(rarity)
    },

    icon(name: UiIconName): string {
      return vector.icon(name)
    },

    tiles(theme: LevelTheme): ThemeTiles {
      const base = vector.tiles(theme)
      // 草地精灵皮肤下：建造格用白色半透明，避免沙色块在草地上突兀
      return {
        ...base,
        slotFill: 'rgba(255, 255, 255, 0.14)',
        slotStroke: 'rgba(255, 255, 255, 0.42)',
      }
    },

    drawGround(ctx: CanvasRenderingContext2D, level: LevelDef): void {
      const { cols, rows } = level.grid
      const cell = 64
      const rand = seeded(level.id.length * 7919 + cols * 31 + rows * 17)

      // 底草地 + 稀疏泥土细节
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const r = rand()
          const img = cache[r < 0.14 ? 'ground-dirt' : 'ground-grass']
          if (!img) return
          ctx.drawImage(img, x * cell, y * cell, cell, cell)
        }
      }

      // 道路：沿路径折线连续描边（圆角连接，转弯自然）
      if (level.path.length > 0) {
        const pts = level.path.map(
          (p) => [p.x * cell + cell / 2, p.y * cell + cell / 2] as const,
        )
        const stroke = (width: number, style: string, dash?: number[]) => {
          ctx.save()
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          ctx.lineWidth = width
          ctx.strokeStyle = style
          if (dash) ctx.setLineDash(dash)
          ctx.beginPath()
          ctx.moveTo(pts[0]![0], pts[0]![1])
          for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y)
          ctx.stroke()
          ctx.restore()
        }
        stroke(cell * 0.66, '#c9a469') // 路肩
        stroke(cell * 0.56, '#e7d29a') // 路面
        stroke(3, 'rgba(150, 118, 74, 0.65)', [7, 9]) // 中线虚线
      }

      // 装饰：非路径/非建造格散布树/灌木/岩石
      const pathSet = new Set(level.path.map((p) => pathKey(p.x, p.y)))
      const slots = new Set(level.buildSlots.map((s) => pathKey(s.x, s.y)))
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const key = pathKey(x, y)
          if (pathSet.has(key) || slots.has(key)) continue
          const r = rand()
          if (r < 0.1) draw(ctx, 'tree', x * cell + cell / 2, y * cell + cell / 2, cell * 0.9)
          else if (r < 0.16) draw(ctx, 'bush', x * cell + cell / 2, y * cell + cell / 2, cell * 0.5)
          else if (r < 0.2) draw(ctx, 'rock', x * cell + cell / 2, y * cell + cell / 2, cell * 0.45)
        }
      }
    },

    drawPet(ctx, petId, cx, cy, heightPx, anim?: DrawAnim): void {
      if (!cache['tower-base'] || !cache['turret-shooter']) {
        vector.drawPet?.(ctx, petId, cx, cy, heightPx, anim)
        return
      }
      const visual = vector.petVisual(petId)
      const role = getPet(petId).role
      const cell = heightPx * 1.15
      // 塔基
      draw(ctx, 'tower-base', cx, cy, cell)
      // 炮塔（固定朝右）
      const turret = ROLE_TURRET[role] ?? 'turret-shooter'
      const recoil = anim?.recoil ? -2 : 0
      draw(ctx, turret, cx + recoil, cy, cell * 0.8, Math.PI / 2)
      // 宠物身份徽章（右上角小圆 + emoji）
      const r = heightPx * 0.24
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx + heightPx * 0.32, cy - heightPx * 0.32, r, 0, Math.PI * 2)
      ctx.fillStyle = '#fff8ec'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(90,70,50,0.5)'
      ctx.stroke()
      ctx.font = `${r * 1.3}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(visual.emoji, cx + heightPx * 0.32, cy - heightPx * 0.3 + 1)
      ctx.restore()
    },

    drawEnemy(ctx, enemyId, cx, cy, heightPx, anim?: DrawAnim): void {
      const file = ENEMY_SPRITE[enemyId]
      if (!file || !cache[file]) {
        vector.drawEnemy?.(ctx, enemyId, cx, cy, heightPx, anim)
        return
      }
      // 落地投影（增强立体感）
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.fillStyle = '#000'
      ctx.beginPath()
      ctx.ellipse(cx, cy + heightPx * 0.42, heightPx * 0.34, heightPx * 0.13, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      // Kenney 单位朝上：facing（0=向右）→ 旋转 facing + 90°
      const rotation = (anim?.facing ?? 0) + Math.PI / 2
      const size = heightPx * 1.3
      draw(ctx, file, cx, cy, size, rotation)
      if (anim?.flash) {
        ctx.save()
        ctx.globalAlpha = 0.55
        draw(ctx, file, cx, cy, size, rotation)
        ctx.restore()
      }
    },
  }
}
