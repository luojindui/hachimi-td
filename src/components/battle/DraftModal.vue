<script setup lang="ts">
import type { DraftOption } from '@/game/types'

defineProps<{
  draft: readonly DraftOption[]
}>()

const emit = defineEmits<{
  pick: [index: number]
}>()
</script>

<template>
  <div
    class="draft-mask"
    role="dialog"
    aria-modal="true"
    aria-label="选择一项强化"
  >
    <div class="draft card">
      <h3 class="draft-title">⚡ 选择一项强化</h3>
      <p class="draft-tip">战斗已暂停 · 强化对本局剩余时间生效</p>
      <div class="draft-cards">
        <button
          v-for="(opt, i) in draft"
          :key="opt.id"
          class="draft-option"
          :style="{ animationDelay: `${i * 0.12}s` }"
          @click="emit('pick', i)"
        >
          <span class="draft-opt-name">{{ opt.name }}</span>
          <span class="draft-opt-desc">{{ opt.desc }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-mask {
  position: fixed;
  inset: 0;
  background: rgba(58, 44, 90, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
  padding: 1rem;
  overflow-y: auto;
}

.draft {
  width: min(34rem, 100%);
  margin: auto;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  border: 2px solid var(--c-rarity-sr);
}

.draft-title {
  margin: 0;
  text-align: center;
  font-size: 1.2rem;
  color: var(--c-rarity-sr);
}

.draft-tip {
  margin: 0;
  text-align: center;
  color: var(--c-ink-soft);
  font-size: 0.85rem;
}

.draft-cards {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
}

.draft-option {
  flex: 1 1 8rem;
  max-width: 10rem;
  min-height: 6.4rem;
  border-radius: var(--radius-md);
  border: 2px solid var(--c-rarity-sr);
  background: linear-gradient(180deg, #f6efff, #fffdf8);
  padding: 0.7rem 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  animation: draft-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: transform 0.1s ease;
}

@media (hover: hover) {
  .draft-option:hover {
    transform: translateY(-3px);
  }
}

.draft-option:active {
  transform: scale(0.96);
}

@keyframes draft-pop {
  from {
    transform: translateY(14px) scale(0.85);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .draft-option {
    animation: none;
  }
}

.draft-opt-name {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--c-primary-deep);
}

.draft-opt-desc {
  font-size: 0.8rem;
  color: var(--c-ink);
  text-align: center;
}
</style>
