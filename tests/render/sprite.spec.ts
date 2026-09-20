import { describe, expect, it, vi } from 'vitest'

import { createVectorProvider } from '@/render/providers/vector'
import {
  createKenneyProvider,
  installKenneySpritesForTesting,
  kenneySpritesReady,
  preloadKenneySprites,
} from '@/render/providers/sprite'

describe('Kenney 精灵 provider 降级链', () => {
  it('空缓存（精灵未加载）时 drawPet/drawEnemy 回退矢量', () => {
    const calls: string[] = []
    const vector = {
      ...createVectorProvider(),
      drawPet: (_ctx: unknown, id: string) => void calls.push(`pet:${id}`),
      drawEnemy: (_ctx: unknown, id: string) => void calls.push(`enemy:${id}`),
    }
    const provider = createKenneyProvider(vector as never)
    expect(kenneySpritesReady()).toBe(false)
    provider.drawPet!({} as never, 'tianyuan-cat', 0, 0, 40)
    provider.drawEnemy!({} as never, 'mouse', 0, 0, 40)
    expect(calls).toEqual(['pet:tianyuan-cat', 'enemy:mouse'])
  })

  it('tiles() 覆盖建造格配色（精灵皮肤降噪）', () => {
    const provider = createKenneyProvider(createVectorProvider())
    const tiles = provider.tiles('yard')
    expect(tiles.slotFill).toBe('rgba(255, 255, 255, 0.14)')
    expect(tiles.slotStroke).toBe('rgba(255, 255, 255, 0.42)')
  })

  it('markerScale=1.3 且接管塔底背板', () => {
    const provider = createKenneyProvider(createVectorProvider())
    expect(provider.markerScale?.()).toBe(1.3)
    expect(provider.replacesTowerBacking).toBe(true)
  })

  it('preload 对加载失败容错（全部 onerror 也 resolve）', async () => {
    // jsdom 不触发资源加载：mock 一个立即 onerror 的 Image 模拟全部失败
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)
    await expect(preloadKenneySprites()).resolves.toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('空缓存下 kenneySpritesReady 为 false', () => {
    // 本文件未注入精灵图；若其它用例注入过也仅限同文件作用域
    expect(kenneySpritesReady()).toBe(false)
  })
})

describe('精灵注入（测试通道）', () => {
  it('注入后 ready 为 true，可正常绘制不抛错', async () => {
    const { createCanvas } = (await import('@napi-rs/canvas')) as typeof import('@napi-rs/canvas')
    const images: Record<string, { width: number; height: number }> = {}
    for (const f of [
      'ground-grass', 'ground-dirt', 'tree', 'bush', 'rock',
      'tower-base', 'turret-shooter', 'turret-cannon', 'turret-sniper', 'turret-ice',
      'enemy-mouse', 'enemy-swift', 'enemy-shield', 'enemy-crow', 'enemy-ratking',
    ]) {
      const c = createCanvas(64, 64)
      images[f] = c
    }
    installKenneySpritesForTesting(images as never)
    expect(kenneySpritesReady()).toBe(true)

    const provider = createKenneyProvider(createVectorProvider())
    const ctx = createCanvas(128, 128).getContext('2d')
    expect(() =>
      provider.drawPet!(ctx as never, 'tianyuan-cat', 64, 64, 48),
    ).not.toThrow()
    for (const id of ['mouse', 'swift', 'shield', 'crow', 'ratking']) {
      expect(() => provider.drawEnemy!(ctx as never, id, 64, 64, 46, { facing: 0 })).not.toThrow()
    }
  })
})
