<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BattleSnapshot } from '@/game/types'
import { assets } from '@/render/registry'
import { getAffix } from '@/game/data/affixes'

const props = defineProps<{
  levelName: string
  snapshot: BattleSnapshot
  speed: 1 | 2
  isEndless: boolean
}>()

const previewText = computed(() =>
  props.snapshot.nextWavePreview
    .map((e) => `${e.name}×${e.count}`)
    .join(' '),
)

/* 波次来袭横幅：waveInProgress 上升沿触发，1.6s 后消退 */
const banner = ref(false)
let bannerTimer = 0
watch(
  () => props.snapshot.waveInProgress,
  (now, prev) => {
    if (now && !prev) {
      banner.value = true
      window.clearTimeout(bannerTimer)
      bannerTimer = window.setTimeout(() => (banner.value = false), 1600)
    }
  },
)

const emit = defineEmits<{
  toggleSpeed: []
  callNext: []
  exit: []
}>()

const icon = assets().icon

/** 顶部波次文案 */
function waveText(snap: BattleSnapshot): string {
  if (props.isEndless) return `第 ${snap.waveIndex + 1} 波`
  return `第 ${Math.min(snap.waveIndex + 1, snap.waveTotal)} / ${snap.waveTotal} 波`
}
</script>

<template>
  <header class="hud">
    <div class="hud-row">
      <button class="hud-btn" aria-label="退出战斗" @click="emit('exit')">‹</button>
      <div class="hud-title">
        <span class="level-name">{{ props.levelName }}</span>
        <span class="wave">{{ waveText(props.snapshot) }}</span>
      </div>
      <button class="hud-btn speed" @click="emit('toggleSpeed')">
        {{ props.speed }}x
      </button>
    </div>

    <div class="hud-row stats">
      <span class="stat">{{ icon('life') }} {{ props.snapshot.baseHp }}/{{ props.snapshot.baseMaxHp }}</span>
      <span class="stat">{{ icon('fish') }} {{ props.snapshot.gold }}</span>
      <span class="stat kills">击杀 {{ props.snapshot.kills }}</span>
      <button
        v-if="
          !props.snapshot.waveInProgress && props.snapshot.outcome === 'ongoing'
        "
        class="call-next"
        @click="emit('callNext')"
      >
        召唤下一波（{{ Math.ceil(props.snapshot.nextWaveCountdown) }}s）
        <span
          v-if="props.snapshot.nextWavePreview.length"
          class="next-preview"
        >
          {{ previewText }}
        </span>
        <span class="call-tip">提前召唤只拿 50% 奖励</span>
      </button>
      <span v-else-if="props.snapshot.draft" class="wave-live">选择强化中…</span>
      <span v-else-if="props.snapshot.outcome === 'ongoing'" class="wave-live">战斗中…</span>
    </div>
    <div v-if="props.snapshot.affixes.length" class="affix-row">
      <span
        v-for="id in props.snapshot.affixes"
        :key="id"
        class="affix-chip"
        :title="getAffix(id).desc"
      >⚡ {{ getAffix(id).name }}</span>
    </div>
    <div v-if="banner" class="wave-banner">⚔️ 第 {{ props.snapshot.waveIndex + 1 }} 波来袭！</div>
  </header>
</template>

<style scoped>
.hud {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.25rem;
}

.hud-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hud-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  min-width: 0;
}

.level-name {
  font-weight: 700;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wave {
  color: var(--c-ink-soft);
  font-size: 0.85rem;
  white-space: nowrap;
}

.hud-btn {
  min-width: 2.4rem;
  height: 2.4rem;
  border-radius: 12px;
  background: var(--c-bg-card);
  box-shadow: var(--shadow-card);
  font-weight: 700;
  font-size: 1rem;
}

.hud-btn.speed {
  color: var(--c-primary-deep);
}

.stats {
  justify-content: space-between;
}

.stat {
  background: var(--c-bg-card);
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.kills {
  color: var(--c-ink-soft);
}

.call-next {
  background: var(--c-primary);
  color: #fff;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.85rem;
  font-weight: 700;
  box-shadow: 0 2px 0 var(--c-primary-deep);
}

.wave-live {
  color: var(--c-ink-soft);
  font-size: 0.85rem;
}
</style>
<style scoped>
.call-tip {
  display: block;
  font-size: 0.6rem;
  opacity: 0.8;
}
</style>
<style scoped>
.affix-row {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.affix-chip {
  font-size: 0.66rem;
  font-weight: 800;
  color: #b0567a;
  background: rgba(176, 86, 122, 0.12);
  border-radius: 4px;
  padding: 1px 6px;
  cursor: help;
}
</style>
<style scoped>
.next-preview {
  display: block;
  font-size: 0.6rem;
  opacity: 0.85;
}
</style>
<style scoped>
.wave-banner {
  position: absolute;
  top: 3rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(224, 75, 75, 0.92);
  color: #fff;
  font-weight: 800;
  font-size: 1rem;
  padding: 0.3rem 1rem;
  border-radius: 999px;
  animation: banner-pop 0.3s ease;
  z-index: 10;
}

@keyframes banner-pop {
  from {
    transform: translateX(-50%) scale(0.7);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) scale(1);
    opacity: 1;
  }
}
</style>
