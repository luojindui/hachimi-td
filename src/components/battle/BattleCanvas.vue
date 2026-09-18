<script setup lang="ts">
import { useTemplateRef, watchEffect } from 'vue'

import { CELL_SIZE } from '@/game/data/balance'
import type { LevelDef, BattleSnapshot } from '@/game/types'
import {
  battleCanvasSize,
  cellFromPoint,
  renderBattle,
  slotIndexAt,
} from '@/render/battleRenderer'
import type { RenderHighlight } from '@/render/battleRenderer'

const props = defineProps<{
  level: LevelDef
  snapshot: BattleSnapshot | null
  /** 拖拽宠物悬停的建造格高亮 */
  highlight?: RenderHighlight | null
}>()

const emit = defineEmits<{
  slotClick: [slotIndex: number | null]
}>()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')

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
  renderBattle(ctx, snap, props.level, props.highlight ?? null, performance.now() / 1000)
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
    return
  }
  emit('slotClick', slotIndexAt(props.level, cell.x, cell.y))
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
