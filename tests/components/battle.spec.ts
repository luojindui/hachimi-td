import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { getLevel } from '@/game/data/levels'
import { getPet } from '@/game/data/pets'
import BattleCanvas from '@/components/battle/BattleCanvas.vue'
import TowerMenu from '@/components/battle/TowerMenu.vue'
import { GameEngine } from '@/game/engine/GameEngine'
import { cellFromPoint, slotIndexAt } from '@/render/battleRenderer'

describe('BattleCanvas', () => {
  it('挂载后按关卡逻辑尺寸设置画布并渲染一帧', async () => {
    const level = getLevel('1')
    const engine = new GameEngine({
      level,
      lineup: [getPet('tianyuan-cat'), getPet('tianyuan-dog')],
    })
    engine.placeTower(0, 'tianyuan-cat')
    const snapshot = engine.getSnapshot()

    const wrapper = mount(BattleCanvas, {
      props: { level, snapshot },
    })
    await wrapper.vm.$nextTick()
    const canvas = wrapper.find('canvas')
    expect(canvas.exists()).toBe(true)
    expect(canvas.element.width).toBe(level.grid.cols * 64)
    expect(canvas.element.height).toBe(level.grid.rows * 64)
    wrapper.unmount()
  })

  it('点击坐标换算：像素 → 格 → 建造格下标', () => {
    const level = getLevel('1') // 13x8 网格，格 64px，CSS 宽 832 时 scale=1
    // 建造格 0 = (1,1)：中心像素 (96, 96)
    const cell = cellFromPoint(level, 96, 96, 832)
    expect(cell).toEqual({ x: 1, y: 1 })
    expect(slotIndexAt(level, 1, 1)).toBe(0)
    // 非建造格换算出格子但无槽位
    expect(slotIndexAt(level, 6, 0)).toBeNull()
    // 界外坐标返回 null
    expect(cellFromPoint(level, -5, 100, 832)).toBeNull()
    expect(cellFromPoint(level, 99999, 100, 832)).toBeNull()
  })
})

describe('TowerMenu', () => {
  it('未选格时买得起的卡片可拖拽（pointerdown 发出 dragStart）', async () => {
    setActivePinia(createPinia())
    const level = getLevel('1')
    const lineup = [getPet('tianyuan-cat'), getPet('tianyuan-dog')]
    const engine = new GameEngine({ level, lineup })
    const snapshot = engine.getSnapshot()

    const wrapper = mount(TowerMenu, {
      props: {
        lineup,
        snapshot,
        selectedSlot: null,
        towerStats: null,
        upgradeCost: null,
        sellValue: null,
      },
    })
    expect(wrapper.text()).toContain('按住宠物拖到虚线建造格')
    const cards = wrapper.findAll('.pet-card')
    // 田园猫 80 ≤ 220：可拖拽
    expect(cards[0]!.attributes('disabled')).toBeUndefined()
    await cards[0]!.trigger('pointerdown', { clientX: 10, clientY: 10 })
    expect(wrapper.emitted('dragStart')).toEqual([[{ petId: 'tianyuan-cat', event: expect.anything() }]])
    wrapper.unmount()
  })

  it('已上场/买不起的卡片禁用拖拽', async () => {
    setActivePinia(createPinia())
    const level = getLevel('1')
    // 田园猫上场后不可重复放置；哈基米 320 > 220 买不起
    const lineup = [getPet('tianyuan-cat'), getPet('hachimi')]
    const engine = new GameEngine({ level, lineup })
    engine.placeTower(0, 'tianyuan-cat')
    const snapshot = engine.getSnapshot()

    const wrapper = mount(TowerMenu, {
      props: {
        lineup,
        snapshot,
        selectedSlot: null,
        towerStats: null,
        upgradeCost: null,
        sellValue: null,
      },
    })
    const cards = wrapper.findAll('.pet-card')
    expect(cards[0]!.attributes('disabled')).toBeDefined() // 已上场
    expect(cards[1]!.attributes('disabled')).toBeDefined() // 买不起
    await cards[0]!.trigger('pointerdown', { clientX: 10, clientY: 10 })
    expect(wrapper.emitted('dragStart')).toBeUndefined()
    wrapper.unmount()
  })

  it('选中空建造格后可点击宠物触发 place 事件', async () => {
    setActivePinia(createPinia())
    const level = getLevel('1')
    const lineup = [getPet('tianyuan-cat'), getPet('tianyuan-dog')]
    const engine = new GameEngine({ level, lineup })
    const snapshot = engine.getSnapshot()

    const wrapper = mount(TowerMenu, {
      props: {
        lineup,
        snapshot,
        selectedSlot: 0,
        towerStats: null,
        upgradeCost: null,
        sellValue: null,
      },
    })
    const cards = wrapper.findAll('.pet-card')
    // 紧凑卡片展示 emoji + 费用
    expect(cards[0]!.text()).toContain('🐱')
    expect(cards[0]!.text()).toContain('80')
    expect(cards[0]!.attributes('disabled')).toBeUndefined()

    await cards[0]!.trigger('click')
    expect(wrapper.emitted('place')).toEqual([['tianyuan-cat']])
    wrapper.unmount()
  })

  it('选中已有塔时展示升级与出售', async () => {
    setActivePinia(createPinia())
    const level = getLevel('1')
    const lineup = [getPet('tianyuan-cat')]
    const engine = new GameEngine({ level, lineup })
    engine.placeTower(0, 'tianyuan-cat')
    const snapshot = engine.getSnapshot()

    const wrapper = mount(TowerMenu, {
      props: {
        lineup,
        snapshot,
        selectedSlot: 0,
        towerStats: engine.towerStats(0),
        upgradeCost: engine.upgradeCost(0),
        sellValue: engine.sellValue(0),
      },
    })
    expect(wrapper.text()).toContain('田园猫')
    expect(wrapper.text()).toContain('Lv1')
    expect(wrapper.text()).toContain('升级 Lv2')
    expect(wrapper.text()).toContain('出售')

    await wrapper.find('.action-row .btn-danger').trigger('click')
    expect(wrapper.emitted('sell')).toBeTruthy()
    wrapper.unmount()
  })

  it('小鱼干不足的卡片禁用拖拽', () => {
    setActivePinia(createPinia())
    const level = getLevel('1')
    const lineup = [getPet('hachimi')] // SSR 320 > 开局 220
    const engine = new GameEngine({ level, lineup })
    const wrapper = mount(TowerMenu, {
      props: {
        lineup,
        snapshot: engine.getSnapshot(),
        selectedSlot: null,
        towerStats: null,
        upgradeCost: null,
        sellValue: null,
      },
    })
    // 买不起 → 禁用拖拽，不发出 dragStart
    expect(wrapper.find('.pet-card').attributes('disabled')).toBeDefined()
    wrapper.find('.pet-card').trigger('pointerdown', { clientX: 5, clientY: 5 })
    expect(wrapper.emitted('dragStart')).toBeUndefined()
    wrapper.unmount()
  })
})
