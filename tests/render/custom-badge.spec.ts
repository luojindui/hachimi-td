import { createCanvas } from '@napi-rs/canvas'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import { GameEngine } from '@/game/engine/GameEngine'
import {
  createKenneyProvider,
  installKenneySpritesForTesting,
  kenneySpritesReady,
} from '@/render/providers/sprite'
import { createVectorProvider } from '@/render/providers/vector'
import { installCustomBadgesForTesting, customPetBadge } from '@/game/customSkin'
import { setAssetProvider, assets } from '@/render/registry'
import { renderBattle } from '@/render/battleRenderer'
import { makePet } from '../game/engine/helpers'

describe('自定义徽章渲染管线（回归锁）', () => {
  it('自定义徽章经 drawPet 渲染到塔上（注入→绘制→像素全链路）', async () => {
    const { Image } = await import('@napi-rs/canvas')
    const dir = process.cwd() + '/public/assets/kenney'
    const images: Record<string, unknown> = {}
    for (const f of ['tower-base', 'turret-shooter', 'enemy-mouse', 'ground-grass']) {
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = rej
        img.src = readFileSync(`${dir}/${f}.png`)
      })
      images[f] = img
    }
    installKenneySpritesForTesting(images as never)
    const badge = createCanvas(64, 64)
    const bc = badge.getContext('2d')
    bc.fillStyle = '#ff2020'
    bc.fillRect(0, 0, 64, 64)
    installCustomBadgesForTesting({ 'tianyuan-cat': badge })
    expect(customPetBadge('tianyuan-cat')).toBeDefined()

    setAssetProvider(createKenneyProvider(createVectorProvider()))

    const sniper = makePet({ id: 'tianyuan-cat', attack: 42, attackInterval: 1.0, range: 2.4 })
    const engine = new GameEngine({
      level: getLevel('1'),
      lineup: [sniper],
      starLevels: {},
      draftsEnabled: false,
      firstWaveCountdown: 100,
    })
    engine.placeTower(1, 'tianyuan-cat')
    const canvas = createCanvas(832, 512)
    const ctx = canvas.getContext('2d')
    renderBattle(ctx, engine.getSnapshot(), getLevel('1'), null, 0)

    // 徽章圆心 = 塔心 + (0.32*56, -0.32*56) = (224+18, 96-18) = (242, 78)
    const px = ctx.getImageData(242, 78, 1, 1).data
    expect(px[0]).toBe(255)
    expect(px[1]).toBe(32)
    expect(px[2]).toBe(32)
  })
})
