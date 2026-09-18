<script setup lang="ts">
import { computed } from 'vue'

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
</script>

<template>
  <div class="pet-avatar" :title="name">
    <span
      class="circle"
      :style="{
        width: px,
        height: px,
        borderColor: A.rarityColor(visual.rarity),
        background: visual.tint,
        fontSize: `calc(${px} * 0.55)`,
      }"
    >
      {{ visual.emoji }}
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
}

.star-badge {
  font-size: 0.55rem;
  letter-spacing: -1px;
}
</style>
