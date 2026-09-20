<script setup lang="ts">
import { useTemplateRef, watchEffect } from 'vue'

import { CELL_SIZE } from '@/game/data/balance'
import type { LevelDef, BattleSnapshot } from '@/game/types'
import { assets } from '@/render/registry'
import {
  battleCanvasSize,
  cellFromPoint,
  renderDynamic,
  renderStaticLayer,
  slotIndexAt,
} from '@/render/battleRenderer'
import type { RangeRing, RenderHighlight } from '@/render/battleRenderer'

const props = defineProps<{
  level: LevelDef
  snapshot: BattleSnapshot | null
  /** 拖拽宠物悬停的建造格高亮 */
  highlight?: RenderHighlight | null
  /** 选中塔的射程圈（逻辑坐标） */
  rangeRing?: RangeRing | null
}>()

const emit = defineEmits<{
  slotClick: [slotIndex: number | null]
  crateClick: [cell: { x: number; y: number } | null]
}>()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

/* 静态层缓存：场地/路径/装饰按「关卡 + dpr + 素材源」缓存 */
let staticCanvas: HTMLCanvasElement | null = null
let staticKey = ''

function ensureStatic(level: LevelDef, dpr: number): HTMLCanvasElement | null {
  // 素材源异步切换（矢量→精灵）或浏览器缩放后需重建
  const key = `${level.id}:${dpr}:${assets().id}`
  if (staticKey === key && staticCanvas) return staticCanvas
  const { width, height } = battleCanvasSize(level)
  const c = document.createElement('canvas')
  c.width = Math.round(width * dpr)
  c.height = Math.round(height * dpr)
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  renderStaticLayer(ctx, level)
  staticCanvas = c
  staticKey = key
  return c
}

watchEffect(() => {
  const snap = props.snapshot
  const canvas = canvasRef.value
  if (!snap || !canvas) return

  const { width, height } = battleCanvasSize(props.level)
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.round(width * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const bg = ensureStatic(props.level, dpr)
  if (bg) ctx.drawImage(bg, 0, 0, width, height)
  renderDynamic(ctx, snap, props.level, props.highlight ?? null, performance.now() / 1000, props.rangeRing ?? null)
})

/** 供拖拽逻辑读取画布元素做命中检测 */
function getCanvasEl(): HTMLCanvasElement | null {
  return canvasRef.value
}

defineExpose({ getCanvasEl })

function handleClick(event: MouseEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const cssX = event.clientX - rect.left
  const cssY = event.clientY - rect.top
  const cell = cellFromPoint(props.level, cssX, cssY, rect.width)
  if (!cell) {
    emit('slotClick', null)
    emit('crateClick', null)
    return
  }
  // 宝箱优先（宝箱格与建造格互斥）
  const hasCrate = props.snapshot?.crates.some(
    (c) => !c.opened && c.x === cell.x && c.y === cell.y,
  )
  if (hasCrate) {
    emit('crateClick', { x: cell.x, y: cell.y })
    return
  }
  // 移动端容错：精确格无建造格时，尝试相邻偏移格（±0.4 格）
  let slotIndex = slotIndexAt(props.level, cell.x, cell.y)
  if (slotIndex === null) {
    const cellW = rect.width / props.level.grid.cols
    const cellH = rect.height / props.level.grid.rows
    for (const [dx, dy] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]] as const) {
      const c2 = cellFromPoint(
        props.level,
        cssX + dx * cellW,
        cssY + dy * cellH,
        rect.width,
      )
      if (!c2) continue
      slotIndex = slotIndexAt(props.level, c2.x, c2.y)
      if (slotIndex !== null) break
    }
  }
  emit('slotClick', slotIndex)
}
</script>

<template>
  <div class="canvas-wrap">
    <!-- 逻辑画布按 cols*CELL x rows*CELL 渲染，CSS 缩放自适应容器宽度 -->
    <canvas
      ref="canvas"
      class="battle-canvas"
      :style="{ aspectRatio: `${props.level.grid.cols * CELL_SIZE} / ${props.level.grid.rows * CELL_SIZE}` }"
      @click="handleClick"
    ></canvas>
  </div>
</template>

<style scoped>
.canvas-wrap {
  width: 100%;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  background: #dfe8d2;
}

.battle-canvas {
  display: block;
  width: 100%;
  height: auto;
  touch-action: manipulation;
}
</style>
