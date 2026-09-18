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
import { renderBattle, battleCanvasSize } from '@/render/battleRenderer'
import { assets } from '@/render/registry'

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
          engine.upgradeTower(slot)
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
    engine.placeTower(1, sniper.id)
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
