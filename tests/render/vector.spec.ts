import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'

import { PET_LIST } from '@/game/data/pets'
import { ENEMY_LIST } from '@/game/data/enemies'
import { assets } from '@/render/registry'

function ctx2d(): CanvasRenderingContext2D {
  const canvas = createCanvas(120, 120)
  // napi canvas 上下文与 DOM 类型结构兼容（drawImage 消费），做类型桥接
  return canvas.getContext('2d') as unknown as CanvasRenderingContext2D
}

describe('矢量素材一致性', () => {
  it('全部宠物都有矢量外观且可绘制', () => {
    const A = assets()
    const ctx = ctx2d()
    for (const pet of PET_LIST) {
      expect(() => A.drawPet!(ctx, pet.id, 60, 60, 60), pet.id).not.toThrow()
    }
  })

  it('全部敌人都有矢量外观且可绘制', () => {
    const A = assets()
    const ctx = ctx2d()
    for (const enemy of ENEMY_LIST) {
      expect(() => A.drawEnemy!(ctx, enemy.id, 60, 60, 46), enemy.id).not.toThrow()
    }
  })

  it('未知 id 明确抛错（防御数据漂移）', () => {
    const A = assets()
    expect(() => A.petVisual('no-such-pet')).toThrow()
  })
})
