import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { getLevel } from '@/game/data/levels'
import { useTowerDrag } from '@/composables/useTowerDrag'

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  // jsdom 没有 PointerEvent 构造器，用 MouseEvent 模拟（运行时仅需 clientX/Y）
  return new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
  }) as unknown as PointerEvent
}

/** 在真实组件实例内使用组合式函数（onBeforeUnmount 需要实例上下文） */
function mountDragHarness(handlers: Parameters<typeof useTowerDrag>[0]) {
  const Host = defineComponent({
    setup(_, { expose }) {
      const drag = useTowerDrag(handlers)
      expose({ drag })
      return () => null
    },
  })
  const wrapper = mount(Host)
  return {
    drag: (wrapper.vm as unknown as { drag: ReturnType<typeof useTowerDrag> }).drag,
    unmount: () => wrapper.unmount(),
  }
}

function fakeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  // jsdom 的 getBoundingClientRect 全 0，注入真实命中所需的矩形
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 832,
      height: 512,
      right: 832,
      bottom: 512,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  return canvas
}

describe('useTowerDrag', () => {
  it('拖到合法建造格松手触发 onDrop 并复位状态', () => {
    const level = getLevel('1')
    const canvas = fakeCanvas()
    let dropped: { slot: number; petId: string } | null = null

    const { drag, unmount } = mountDragHarness({
      getCanvasEl: () => canvas,
      level: () => level,
      canPlace: (slot, petId) => ({ ok: slot === 0 && petId === 'tianyuan-cat' }),
      onDrop: (slot, petId) => {
        dropped = { slot, petId }
      },
    })

    drag.startDrag('tianyuan-cat', pointerEvent('pointerdown', 10, 10))
    expect(drag.draggingPetId.value).toBe('tianyuan-cat')

    // 移动到建造格 0 = (1,1) 中心 (96,96)
    window.dispatchEvent(pointerEvent('pointermove', 96, 96))
    expect(drag.hoverSlot.value).toBe(0)
    expect(drag.hoverValid.value).toBe(true)

    window.dispatchEvent(pointerEvent('pointerup', 96, 96))
    expect(dropped).toEqual({ slot: 0, petId: 'tianyuan-cat' })
    expect(drag.draggingPetId.value).toBeNull()
    expect(drag.hoverSlot.value).toBeNull()
    unmount()
  })

  it('松手在非法位置不放置，状态复位', () => {
    const level = getLevel('1')
    const canvas = fakeCanvas()
    let dropCount = 0

    const { drag, unmount } = mountDragHarness({
      getCanvasEl: () => canvas,
      level: () => level,
      canPlace: () => ({ ok: false }),
      onDrop: () => {
        dropCount++
      },
    })

    drag.startDrag('tianyuan-cat', pointerEvent('pointerdown', 10, 10))
    // 拖到非建造格 (0,0)
    window.dispatchEvent(pointerEvent('pointermove', 32, 32))
    expect(drag.hoverSlot.value).toBeNull()
    expect(drag.hoverValid.value).toBe(false)

    window.dispatchEvent(pointerEvent('pointerup', 32, 32))
    expect(dropCount).toBe(0)
    expect(drag.draggingPetId.value).toBeNull()
    unmount()
  })

  it('canPlace 拒绝时高亮无效且不触发 onDrop', () => {
    const level = getLevel('1')
    const canvas = fakeCanvas()
    let dropCount = 0

    const { drag, unmount } = mountDragHarness({
      getCanvasEl: () => canvas,
      level: () => level,
      canPlace: () => ({ ok: false }), // 例如小鱼干不足
      onDrop: () => {
        dropCount++
      },
    })

    drag.startDrag('tianyuan-cat', pointerEvent('pointerdown', 10, 10))
    window.dispatchEvent(pointerEvent('pointermove', 96, 96))
    expect(drag.hoverSlot.value).toBe(0)
    expect(drag.hoverValid.value).toBe(false)

    window.dispatchEvent(pointerEvent('pointerup', 96, 96))
    expect(dropCount).toBe(0)
    unmount()
  })
})
