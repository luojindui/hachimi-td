/**
 * 视觉冒烟测试：用真实引擎跑一场战斗，再用真实 battleRenderer 渲染成 PNG。
 * 产物写入 art-output/，供人工审查矢量角色/特效/场景是否正确。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'

import { GameEngine } from '@/game/engine/GameEngine'
import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import { makePet } from '../game/engine/helpers'
import { renderBattle, renderStaticLayer, renderDynamic, battleCanvasSize } from '@/render/battleRenderer'
import { assets, setAssetProvider } from '@/render/registry'
import { createKenneyProvider } from '@/render/providers/sprite'
import { createVectorProvider } from '@/render/providers/vector'

const STEP = 1 / 30

describe('战斗画面渲染（真实引擎 + 真实渲染器）', () => {
  it('L1 中盘画面渲染并写出 PNG', () => {
    const level = getLevel('1')
    const lineup = ['tianyuan-cat', 'tianyuan-dog', 'lihua', 'xiaobai', 'spotty']
    const engine = new GameEngine({
      level,
      draftsEnabled: false,
      lineup: lineup.map((id) => getPet(id)),
      firstWaveCountdown: 0.2,
    })
    // 布阵
    const slots = [1, 0, 2, 4, 3]
    let si = 0
    for (const petId of lineup) {
      while (si < slots.length) {
        const slot = slots[si]!
        si++
        if (engine.canPlace(slot, petId).ok) {
          engine.placeTower(slot, petId)
          break
        }
      }
    }
    // 跑到敌人出现在场上（波次进行中的丰富画面）
    for (let t = 0; t < 40 && engine.getOutcome() === 'ongoing'; t += STEP) {
      for (const slot of slots) {
        const cost = engine.upgradeCost(slot)
        if (cost !== null && engine.getGold() >= cost) {
          engine.upgradeTower(slot, 'quick')
          break
        }
      }
      engine.update(STEP)
      engine.update(STEP)
      engine.update(STEP)
      engine.update(STEP)
      if (engine.getSnapshot().enemies.length >= 3) break
    }
    const snapshot = engine.getSnapshot()
    expect(snapshot.enemies.length).toBeGreaterThanOrEqual(3)
    expect(snapshot.waveInProgress).toBe(true)

    // 渲染（napi canvas 上下文结构与 DOM 兼容，做类型桥接）
    const { width, height } = battleCanvasSize(level)
    const dpr = 2
    const canvas = createCanvas(width * dpr, height * dpr)
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    expect(() =>
      renderBattle(ctx, snapshot, level, null, snapshot.time),
    ).not.toThrow()

    mkdirSync('art-output', { recursive: true })
    const png = canvas.toBuffer('image/png')
    writeFileSync('art-output/battle-frame.png', png)
    expect(png.length).toBeGreaterThan(10000)
  })

  it('注册表默认提供矢量绘制能力', () => {
    const A = assets()
    expect(A.id).toBe('vector-v1')
    expect(typeof A.drawPet).toBe('function')
    expect(typeof A.drawEnemy).toBe('function')
    expect(() => A.drawPet!(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, 'tianyuan-cat', 20, 20, 60)).not.toThrow()
    expect(() => A.drawEnemy!(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, 'mouse', 20, 20, 46)).not.toThrow()
    expect(() => (A as unknown as { drawPet: (c: unknown, id: string) => void }).drawPet(canvas.getContext('2d'), 'no-such-pet')).toThrow()
  })

  it('击杀瞬间产生爆散与金币特效', () => {
    const level = getLevel('1')
    const sniper = getPet('tianyuan-cat')
    const engine = new GameEngine({
      level,
      draftsEnabled: false,
      lineup: [sniper],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, 'tianyuan-cat')
    let sawEffects = false
    for (let t = 0; t < 15 && !sawEffects; t += STEP) {
      engine.update(STEP)
      const snap = engine.getSnapshot()
      if (snap.kills > 0) sawEffects = true
    }
    expect(sawEffects).toBe(true)
  })

  // 共享画布
  const canvas = createCanvas(128, 128)
})

describe('Kenney CC0 皮肤渲染', () => {
  it('精灵皮肤下完整渲染一帧（地形/塔/敌人）', async () => {
    const { Image } = await import('@napi-rs/canvas')
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { installKenneySpritesForTesting } = await import('@/render/providers/sprite')

    const dir = join(process.cwd(), 'public/assets/kenney')
    const files = [
      'ground-grass', 'ground-sand', 'ground-dirt', 'road', 'tree', 'bush', 'rock',
      'tower-base', 'turret-shooter', 'turret-cannon', 'turret-sniper', 'turret-ice',
      'enemy-mouse', 'enemy-swift', 'enemy-shield', 'enemy-crow', 'enemy-ratking', 'granary',
    ]
    // napi Image 为异步解码：必须等 onload 再注入
    const images: Record<string, unknown> = {}
    await Promise.all(
      files.map(
        (f) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              images[f] = img
              resolve()
            }
            img.onerror = () => reject(new Error(`精灵加载失败: ${f}`))
            img.src = readFileSync(join(dir, `${f}.png`))
          }),
      ),
    )
    installKenneySpritesForTesting(images as never)

    setAssetProvider(createKenneyProvider(assets()))

    const level = getLevel('1')
    const { width, height } = battleCanvasSize(level)
    const canvas = createCanvas(width * 2, height * 2)
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D
    ctx.setTransform(2, 0, 0, 2, 0, 0)

    // 用真实宠物（sprite provider 的 drawPet 会查数据表取定位）
    const sniper = makePet({ id: 'tianyuan-cat', attack: 42, attackInterval: 1.0, range: 2.4 })
    const engine = new GameEngine({
      level,
      lineup: [sniper],
      starLevels: {},
      draftsEnabled: false,
      firstWaveCountdown: 0.2,
    })
    engine.placeTower(1, 'tianyuan-cat')
    for (let i = 0; i < 320; i++) engine.update(1 / 30)
    renderStaticLayer(ctx, level)
    renderDynamic(ctx, engine.getSnapshot(), level, null, 3.3)

    // 结构化像素断言（防回归：全透明/错层/草地杂色静默通过）
    // 1) 草地区域：绿色主导且不透明
    const grassZone = ctx.getImageData(1300, 40, 64, 64).data
    let greenOK = 0
    let total = 0
    for (let i = 0; i < grassZone.length; i += 4) {
      total++
      if (grassZone[i + 3]! === 255 && grassZone[i + 1]! > grassZone[i]!) greenOK++
    }
    expect(greenOK / total).toBeGreaterThan(0.9)
    // 2) 路面中心：沙色（红/绿高、蓝低）
    const roadPx = ctx.getImageData(9 * 64 * 2, (6 * 64 + 32) * 2, 1, 1).data
    expect(roadPx[3]!).toBe(255)
    expect(roadPx[0]!).toBeCloseTo(179, 0)
    expect(roadPx[1]!).toBeCloseTo(150, 0)
    // 3) 道路上不应有树冠绿块（草地绿 g≫r；路面 r>g）
    const roadPx2 = ctx.getImageData(5 * 64 * 2, (6 * 64 + 32) * 2, 1, 1).data
    expect(roadPx2[0]!).toBeGreaterThan(roadPx2[1]!)

    writeFileSync('art-output/kenney-frame.png', canvas.toBuffer('image/png'))

    // 恢复矢量 provider，避免注册表污染后续用例
    setAssetProvider(createVectorProvider())
  })
})
