import { CELL_SIZE } from '../../game/data/balance'
import { customEnemy, customPetBadge } from '../../game/customSkin'
import { getPet } from '../../game/data/pets'
import { hashString, mulberry32 } from '../../game/rng'
import type { LevelDef, LevelTheme, Rarity } from '../../game/types'
import type {
  DrawAnim,
  EnemyVisual,
  PetVisual,
  ThemeTiles,
  UiIconName,
} from '../types'
import type { AssetProvider } from '../types'

/**
 * Kenney 塔防素材皮肤（CC0 协议，无版权限制）。
 * 地形/道路/塔基/炮塔/敌人单位全部来自
 * kenney.nl "Tower Defense (Top-Down)" 素材包。
 * 宠物身份以 emoji 徽章呈现（军事单位 + 宠物指挥官的混搭皮肤）。
 *
 * 降级策略（三条路径一致）：所需精灵任一缺失 → 整体回退矢量绘制。
 */

/** 可被 ctx.drawImage 消费的结构化最小类型（DOM/napi Image 均满足） */
export interface SpriteLike {
  width: number
  height: number
}

const FILES = [
  'ground-grass',
  'ground-dirt',
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
] as const

type SpriteFile = (typeof FILES)[number]

const cache: Record<string, SpriteLike> = {}

function src(file: SpriteFile): string {
  return `${import.meta.env.BASE_URL ?? '/'}assets/kenney/${file}.png`
}

/** 预加载全部精灵图；单张失败不阻塞（由 ready 门禁决定是否启用皮肤） */
export function preloadKenneySprites(): Promise<void> {
  return Promise.all(
    FILES.map(
      (file) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            cache[file] = img
            resolve()
          }
          img.onerror = () => resolve()
          img.src = src(file)
        }),
    ),
  ).then(() => undefined)
}

/** 全部精灵就绪才允许启用皮肤（防部分失败静默半残） */
export function kenneySpritesReady(): boolean {
  return FILES.every((f) => cache[f] !== undefined)
}

/** 供测试环境（napi canvas）注入已加载的精灵图；生产构建为空操作 */
export function installKenneySpritesForTesting(
  images: Record<string, SpriteLike>,
): void {
  if (!import.meta.env.DEV) return
  Object.assign(cache, images)
}

/** 绘制单个精灵；缺图静默跳过（调用方负责整体兜底） */
function draw(
  ctx: CanvasRenderingContext2D,
  file: SpriteFile,
  cx: number,
  cy: number,
  size: number,
  rotation = 0,
): void {
  const img = cache[file]
  if (!img) return
  ctx.save()
  ctx.translate(cx, cy)
  if (rotation !== 0) ctx.rotate(rotation)
  ctx.drawImage(img as unknown as CanvasImageSource, -size / 2, -size / 2, size, size)
  ctx.restore()
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
  antiair: 'turret-sniper',
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

    /** 精灵单位比矢量角色大，标记（血条/状态环）锚点同步放大 */
    markerScale(): number {
      return 1.3
    },

    /** 塔底白盘+稀有度圆环由精灵塔基接管 */
    replacesTowerBacking: true,

    drawGround(ctx: CanvasRenderingContext2D, level: LevelDef): void {
      const tiles = vector.tiles(level.theme)
      // 兜底底色：任一地面精灵缺失时也不露透明
      ctx.fillStyle = tiles.bg
      ctx.fillRect(0, 0, level.grid.cols * CELL_SIZE, level.grid.rows * CELL_SIZE)

      // 底草地 + 稀疏泥土细节（缺图跳过该格，底色已垫）
      const rand = mulberry32(hashString(`${level.id}:ground`))
      for (let y = 0; y < level.grid.rows; y++) {
        for (let x = 0; x < level.grid.cols; x++) {
          const r = rand()
          const img = cache[r < 0.14 ? 'ground-dirt' : 'ground-grass']
          if (!img) continue
          ctx.drawImage(
            img as unknown as CanvasImageSource,
            x * CELL_SIZE,
            y * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE,
          )
        }
      }

      // 主题氛围：非户外主题叠主题底色（夜/馆/仓等），保留地形纹理
      if (level.theme !== 'yard' && level.theme !== 'garden' && level.theme !== 'park') {
        ctx.save()
        ctx.globalAlpha = 0.32
        ctx.fillStyle = tiles.bg
        ctx.fillRect(0, 0, level.grid.cols * CELL_SIZE, level.grid.rows * CELL_SIZE)
        ctx.restore()
      }

      // 道路：沿路径折线连续描边（圆角连接，转弯自然）
      if (level.path.length > 0) {
        const pts = level.path.map(
          (p) => [p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2] as const,
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
        stroke(CELL_SIZE * 0.66, '#c9a469') // 路肩
        stroke(CELL_SIZE * 0.56, '#e7d29a') // 路面
        stroke(3, 'rgba(150, 118, 74, 0.65)', [7, 9]) // 中线虚线
      }

      // 装饰避让：沿折线枚举全部路径格及其 8 邻格（防树冠溢出到路面）
      const nearPath = new Set<string>()
      const wps = level.path
      for (let i = 0; i < wps.length; i++) {
        const p = wps[i]!
        const next = wps[i + 1]
        const steps = next
          ? Math.max(Math.abs(next.x - p.x), Math.abs(next.y - p.y))
          : 0
        const sx = Math.sign(next ? next.x - p.x : 0)
        const sy = Math.sign(next ? next.y - p.y : 0)
        for (let t = 0; t <= steps; t++) {
          const cx2 = p.x + sx * t
          const cy2 = p.y + sy * t
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              nearPath.add(`${cx2 + dx},${cy2 + dy}`)
            }
          }
        }
      }
      const slots = new Set(level.buildSlots.map((s) => `${s.x},${s.y}`))
      const drand = mulberry32(hashString(`${level.id}:decor`))
      for (let y = 0; y < level.grid.rows; y++) {
        for (let x = 0; x < level.grid.cols; x++) {
          const key = `${x},${y}`
          if (nearPath.has(key) || slots.has(key)) continue
          const r = drand()
          const cx = x * CELL_SIZE + CELL_SIZE / 2
          const cy = y * CELL_SIZE + CELL_SIZE / 2
          if (r < 0.1) draw(ctx, 'tree', cx, cy, CELL_SIZE * 0.72)
          else if (r < 0.16) draw(ctx, 'bush', cx, cy, CELL_SIZE * 0.42)
          else if (r < 0.2) draw(ctx, 'rock', cx, cy, CELL_SIZE * 0.38)
        }
      }
    },

    drawPet(ctx, petId, cx, cy, heightPx, anim?: DrawAnim): void {
      const role = getPet(petId).role
      const turret = ROLE_TURRET[role]
      // 精灵不齐 → 整体回退矢量（避免"底座无炮塔"半残态）
      if (!cache['tower-base'] || !turret || !cache[turret]) {
        vector.drawPet?.(ctx, petId, cx, cy, heightPx, anim)
        return
      }
      const visual = vector.petVisual(petId)
      const cell = heightPx * 1.15
      draw(ctx, 'tower-base', cx, cy, cell)
      draw(ctx, turret, cx, cy, cell * 0.8, Math.PI / 2)
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
      const badge = customPetBadge(petId)
      if (badge) {
        // 自定义头像（本机自用素材叠加层）
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx + heightPx * 0.32, cy - heightPx * 0.32, r, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(
          badge as unknown as CanvasImageSource,
          cx + heightPx * 0.32 - r,
          cy - heightPx * 0.32 - r,
          r * 2,
          r * 2,
        )
        ctx.restore()
      } else {
        ctx.fillText(visual.emoji, cx + heightPx * 0.32, cy - heightPx * 0.3 + 1)
      }
      ctx.restore()
    },

    drawEnemy(ctx, enemyId, cx, cy, heightPx, anim?: DrawAnim): void {
      // 自定义敌人素材（本机自用叠加层）优先
      const custom = customEnemy(enemyId)
      if (custom) {
        const rotation = (anim?.facing ?? 0) + Math.PI / 2
        const size = heightPx * 1.3
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rotation)
        ctx.drawImage(
          custom as unknown as CanvasImageSource,
          -size / 2,
          -size / 2,
          size,
          size,
        )
        ctx.restore()
        if (anim?.flash) {
          ctx.save()
          ctx.globalAlpha = 0.5
          ctx.globalCompositeOperation = 'lighter'
          ctx.translate(cx, cy)
          ctx.rotate(rotation)
          ctx.drawImage(
            custom as unknown as CanvasImageSource,
            -size / 2,
            -size / 2,
            size,
            size,
          )
          ctx.restore()
        }
        return
      }
      const file = ENEMY_SPRITE[enemyId]
      if (!file || !cache[file]) {
        vector.drawEnemy?.(ctx, enemyId, cx, cy, heightPx, anim)
        return
      }
      // Kenney 单位朝上：facing（0=向右）→ 旋转 facing + 90°
      const rotation = (anim?.facing ?? 0) + Math.PI / 2
      const size = heightPx * 1.3
      draw(ctx, file, cx, cy, size, rotation)
      // 受击闪白：lighter 叠加原图（提亮而非变暗）
      if (anim?.flash) {
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.globalCompositeOperation = 'lighter'
        draw(ctx, file, cx, cy, size, rotation)
        ctx.restore()
      }
    },
  }
}
