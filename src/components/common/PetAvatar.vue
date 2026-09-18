<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue'

import { getPet } from '@/game/data/pets'
import { assets } from '@/render/registry'

const props = defineProps<{
  petId: string
  /** 显示星级角标 */
  stars?: number
  /** 直径像素 */
  size?: number
}>()

const A = assets()
const visual = computed(() => A.petVisual(props.petId))
const name = computed(() => getPet(props.petId).name)
const px = computed(() => `${props.size ?? 48}px`)
/** 矢量 provider 可用时用 canvas 立绘替代 emoji */
const hasVector = typeof A.drawPet === 'function'

const canvasRef = useTemplateRef<HTMLCanvasElement>('petCanvas')

watchEffect(() => {
  if (!hasVector) return
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const cssSize = props.size ?? 48
  canvas.width = Math.round(cssSize * dpr)
  canvas.height = Math.round(cssSize * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  A.drawPet!(ctx, props.petId, cssSize / 2, cssSize / 2, cssSize * 1.15)
})
</script>

<template>
  <div class="pet-avatar" :title="name">
    <span
      class="circle"
      :style="{
        width: px,
        height: px,
        borderColor: A.rarityColor(visual.rarity),
        background: hasVector ? '#f8f3e9' : visual.tint,
      }"
    >
      <canvas
        v-if="hasVector"
        ref="petCanvas"
        class="pet-canvas"
        :style="{ width: px, height: px }"
      ></canvas>
      <template v-else>{{ visual.emoji }}</template>
    </span>
    <span v-if="props.stars !== undefined" class="star-badge">
      {{ '⭐'.repeat(props.stars) || '—' }}
    </span>
  </div>
</template>

<style scoped>
.pet-avatar {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.circle {
  border-radius: 999px;
  border: 3px solid;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
}

.pet-canvas {
  display: block;
}

.star-badge {
  font-size: 0.55rem;
  letter-spacing: -1px;
}
</style>
