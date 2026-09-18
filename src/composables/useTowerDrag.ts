import { onBeforeUnmount, ref, shallowRef } from 'vue'

import { cellFromPoint, slotIndexAt } from '@/render/battleRenderer'
import type { LevelDef } from '@/game/types'

export interface TowerDragHandlers {
  /** 画布元素（命中检测用） */
  getCanvasEl: () => HTMLCanvasElement | null
  level: () => LevelDef
  /** 该格当前是否可放置 */
  canPlace: (slotIndex: number, petId: string) => { ok: boolean }
  /** 松手落在合法格上 */
  onDrop: (slotIndex: number, petId: string) => void
}

/**
 * 拖拽放塔组合式函数：Pointer Events 统一鼠标与触屏。
 * - startDrag 后在 window 上监听 move/up/cancel，拖出组件树也能跟踪
 * - hoverSlot / hoverValid 驱动画布高亮；ghostPos 驱动跟随指针的悬浮宠物
 * - 松手落在合法建造格 → onDrop；否则静默取消
 */
export function useTowerDrag(handlers: TowerDragHandlers) {
  const draggingPetId = shallowRef<string | null>(null)
  /** 悬浮宠物指针位置（client 坐标） */
  const ghostPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })
  const hoverSlot = shallowRef<number | null>(null)
  const hoverValid = ref(false)

  let activePetId: string | null = null
  let listening = false

  function updateHover(e: PointerEvent): void {
    ghostPos.value = { x: e.clientX, y: e.clientY }
    const canvas = handlers.getCanvasEl()
    if (!canvas || !activePetId) {
      hoverSlot.value = null
      hoverValid.value = false
      return
    }
    const rect = canvas.getBoundingClientRect()
    const cell = cellFromPoint(
      handlers.level(),
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
    )
    const slot = cell ? slotIndexAt(handlers.level(), cell.x, cell.y) : null
    hoverSlot.value = slot
    hoverValid.value =
      slot !== null && handlers.canPlace(slot, activePetId).ok
  }

  function onPointerMove(e: PointerEvent): void {
    updateHover(e)
  }

  function onPointerUp(e: PointerEvent): void {
    updateHover(e)
    const petId = activePetId
    const slot = hoverSlot.value
    if (petId && slot !== null && hoverValid.value) {
      handlers.onDrop(slot, petId)
    }
    endDrag()
  }

  function endDrag(): void {
    activePetId = null
    draggingPetId.value = null
    hoverSlot.value = null
    hoverValid.value = false
    if (listening) {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      listening = false
    }
  }

  function onPointerCancel(): void {
    endDrag()
  }

  function startDrag(petId: string, e: PointerEvent): void {
    if (draggingPetId.value) return
    activePetId = petId
    draggingPetId.value = petId
    ghostPos.value = { x: e.clientX, y: e.clientY }
    if (!listening) {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
      listening = true
    }
    updateHover(e)
  }

  onBeforeUnmount(endDrag)

  return {
    draggingPetId,
    ghostPos,
    hoverSlot,
    hoverValid,
    startDrag,
  }
}
