<script setup lang="ts">
import { assets } from '@/render/registry'

const props = defineProps<{
  outcome: 'victory' | 'defeat'
  isEndless: boolean
  stars: number
  catnipGained: number
  kills: number
  /** 无尽模式：本局到达的波数 */
  waveReached?: number
  /** 下一关跳转文案（空 = 不显示） */
  nextLabel?: string
  /** 通关奖励部分（首通/重复） */
  clearReward?: number
  /** 星数里程碑部分 */
  milestoneReward?: number
}>()

const emit = defineEmits<{
  retry: []
  home: []
  next: []
}>()

const A = assets()
</script>

<template>
  <div class="modal-mask">
    <div class="modal card" role="dialog" aria-modal="true" aria-label="战斗结算">
      <h2 :class="['title', props.outcome]">
        {{ props.outcome === 'victory' ? '防守成功！' : '粮仓失守…' }}
      </h2>

      <div v-if="props.outcome === 'victory' && !props.isEndless" class="stars">
        <span
          v-for="i in 3"
          :key="i"
          :class="['star', i <= props.stars ? 'lit' : '']"
          :style="{ animationDelay: `${(i - 1) * 0.18}s` }"
        >
          {{ A.icon('star') }}
        </span>
      </div>

      <p v-if="props.isEndless" class="line">
        本次坚持到了第 <strong>{{ props.waveReached ?? 0 }}</strong> 波
      </p>

      <p class="line">
        击杀 <strong>{{ props.kills }}</strong> 只鼠贼 ·
        获得 <strong class="catnip">{{ A.icon('catnip') }} × {{ props.catnipGained }}</strong>
        <span
          v-if="props.clearReward !== undefined"
          class="breakdown"
        >（通关 {{ props.clearReward }}<template v-if="props.milestoneReward"> + 里程碑 {{ props.milestoneReward }}</template>）</span>
      </p>

      <div class="actions">
        <button
      v-if="props.nextLabel"
      class="btn btn-primary"
      @click="emit('next')"
    >
      {{ props.nextLabel }} →
    </button>
<button class="btn btn-primary" @click="emit('retry')">再来一局</button>
        <button class="btn btn-ghost" @click="emit('home')">返回主页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(74, 59, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal {
  width: min(26rem, 100%);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  text-align: center;
}

.title {
  margin: 0;
  font-size: 1.4rem;
}

.title.victory {
  color: var(--c-success);
}

.title.defeat {
  color: var(--c-danger);
}

.stars {
  display: flex;
  gap: 0.4rem;
  font-size: 1.8rem;
}

.star {
  filter: grayscale(1);
  opacity: 0.4;
}

.star.lit {
  filter: none;
  opacity: 1;
  animation: star-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes star-pop {
  from {
    transform: scale(0.2) rotate(-30deg);
  }
  to {
    transform: scale(1) rotate(0deg);
  }
}

.line {
  margin: 0;
  color: var(--c-ink-soft);
}

.catnip {
  color: var(--c-success);
}

.actions {
  display: flex;
  gap: 0.7rem;
  margin-top: 0.4rem;
}
</style>
