<script setup lang="ts">
import { computed, ref } from 'vue'

import { GACHA } from '@/game/data/balance'
import { getPet } from '@/game/data/pets'
import { useProfileStore } from '@/stores/profile'
import type { DrawResult } from '@/stores/profile'
import { assets } from '@/render/registry'

const profile = useProfileStore()
const A = assets()
const results = ref<DrawResult[] | null>(null)
const revealAll = ref(false)

const canSingle = computed(() => profile.catnip >= GACHA.SINGLE_COST)
const canTen = computed(() => profile.catnip >= GACHA.MULTI_COST)

const srPityLeft = computed(() => Math.max(0, GACHA.SR_PITY - profile.gacha.srPity))
const ssrPityLeft = computed(() => Math.max(0, GACHA.SSR_PITY - profile.gacha.ssrPity))

function doSingle(): void {
  try {
    results.value = [profile.drawOnce()]
    revealAll.value = true
  } catch {
    /* 按钮已做前置校验 */
  }
}

function doTen(): void {
  try {
    results.value = profile.drawTen()
    revealAll.value = false
  } catch {
    /* 按钮已做前置校验 */
  }
}

function revealNext(): void {
  revealAll.value = true
}

function close(): void {
  results.value = null
}

/** 未全部揭示时点击遮罩不关闭（防误触） */
function onMaskClick(): void {
  if (revealAll.value) close()
}

function visibleCount(): number {
  if (!results.value) return 0
  return revealAll.value ? results.value.length : Math.min(1, results.value.length)
}
</script>

<template>
  <main class="hatch">
    <header class="hatch-head">
      <RouterLink to="/" class="btn btn-ghost back">‹ 主页</RouterLink>
      <h1 class="title">孵蛋屋</h1>
      <span class="wallet">{{ A.icon('catnip') }} {{ profile.catnip }}</span>
    </header>

    <!-- 蛋机 -->
    <section class="machine card">
      <div class="egg-stage">
        <span :class="['egg', { shaking: results !== null }]">🥚</span>
        <span class="sparkles">✨</span>
      </div>

      <div class="draw-buttons">
        <button class="btn btn-primary" :disabled="!canSingle" @click="doSingle">
          单抽（{{ GACHA.SINGLE_COST }}{{ A.icon('catnip') }}）
        </button>
        <button class="btn btn-primary ten" :disabled="!canTen" @click="doTen">
          十连（{{ GACHA.MULTI_COST }}{{ A.icon('catnip') }}，必出 R+）
        </button>
      </div>

      <div class="pity">
        <div class="pity-row">
          <span>SR+ 保底还剩 {{ srPityLeft }} 抽</span>
          <div class="bar">
            <div
              class="fill sr"
              :style="{ width: `${Math.min(100, (profile.gacha.srPity / GACHA.SR_PITY) * 100)}%` }"
            ></div>
          </div>
        </div>
        <div class="pity-row">
          <span>SSR 保底还剩 {{ ssrPityLeft }} 抽</span>
          <div class="bar">
            <div
              class="fill ssr"
              :style="{ width: `${Math.min(100, (profile.gacha.ssrPity / GACHA.SSR_PITY) * 100)}%` }"
            ></div>
          </div>
        </div>
      </div>

      <p class="rates">
        概率公示：N {{ Math.round(GACHA.RATES.N * 100) }}% · R {{ Math.round(GACHA.RATES.R * 100) }}% ·
        SR {{ Math.round(GACHA.RATES.SR * 100) }}% · SSR {{ Math.round(GACHA.RATES.SSR * 100) }}%
        （重复自动转碎片）
      </p>
      <p class="rates" :class="{ done: profile.gacha.firstTenDone }">
        🎁 新手保底：首次十连必出 SR+（{{ profile.gacha.firstTenDone ? '已完成' : '进行中' }}）
      </p>
    </section>

    <!-- 结果弹层（未全部揭示时点击遮罩不关闭，防误触） -->
    <div v-if="results" class="result-mask" @click="onMaskClick">
      <div class="result card" @click.stop>
        <h2 class="result-title">孵化结果！</h2>
        <div class="cards">
          <div
            v-for="(r, i) in results.slice(0, visibleCount())"
            :key="i"
            class="draw-card"
            :class="[`r-${r.rarity}`, { new: r.isNew }]"
            :style="{ animationDelay: `${i * 0.09}s` }"
          >
            <span class="draw-emoji">{{ A.petVisual(r.petId).emoji }}</span>
            <span class="draw-name">{{ getPet(r.petId).name }}</span>
            <span class="draw-rarity">{{ r.rarity }}</span>
            <span v-if="r.isNew" class="new-tag">NEW!</span>
            <span v-else class="shard-tag">碎片+{{ r.shardsGained }}</span>
          </div>
        </div>
        <div class="result-actions">
          <button v-if="!revealAll && results.length > 1" class="btn btn-ghost" @click="revealNext">
            全部揭示
          </button>
          <button class="btn btn-primary" @click="close">确定</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.hatch {
  flex: 1;
  width: min(40rem, 100%);
  margin: 0 auto;
  padding: 0.8rem 0.7rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.hatch-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
  text-align: center;
}

.wallet {
  font-weight: 700;
  color: var(--c-primary-deep);
  min-width: 4rem;
  text-align: right;
}

.machine {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.egg-stage {
  position: relative;
  padding: 1rem 0;
}

.egg {
  font-size: 5rem;
  display: inline-block;
  animation: bob 2.4s ease-in-out infinite;
}

.egg.shaking {
  animation: shake 0.5s ease-in-out infinite;
}

.sparkles {
  position: absolute;
  top: 0;
  right: -0.6rem;
  font-size: 1.4rem;
}

@keyframes bob {
  0%,
  100% {
    transform: translateY(0) rotate(-3deg);
  }
  50% {
    transform: translateY(-6px) rotate(3deg);
  }
}

@keyframes shake {
  0%,
  100% {
    transform: rotate(-6deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

.draw-buttons {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  justify-content: center;
}

.pity {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pity-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--c-ink-soft);
}

.pity-row span {
  min-width: 9rem;
}

.bar {
  flex: 1;
  height: 8px;
  background: var(--c-bg-sunken);
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  transition: width 0.3s ease;
}

.fill.sr {
  background: var(--c-rarity-sr);
}

.fill.ssr {
  background: var(--c-rarity-ssr);
}

.rates {
  margin: 0;
  font-size: 0.75rem;
  color: var(--c-ink-soft);
  text-align: center;
}

/* 结果弹层 */
.result-mask {
  position: fixed;
  inset: 0;
  background: rgba(74, 59, 50, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.result {
  width: min(32rem, 100%);
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.result-title {
  margin: 0;
  text-align: center;
  font-size: 1.2rem;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.draw-card {
  width: 6.4rem;
  padding: 0.6rem 0.3rem;
  border-radius: var(--radius-md);
  border: 3px solid;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  animation: pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes pop {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.r-N {
  border-color: var(--c-rarity-n);
}

.r-R {
  border-color: var(--c-rarity-r);
}

.r-SR {
  border-color: var(--c-rarity-sr);
}

.r-SSR {
  border-color: var(--c-rarity-ssr);
  background: linear-gradient(180deg, #fff9e8, #fff);
}

.draw-emoji {
  font-size: 2rem;
}

.draw-name {
  font-size: 0.8rem;
  font-weight: 700;
}

.draw-rarity {
  font-size: 0.7rem;
  font-weight: 800;
}

.new-tag {
  font-size: 0.66rem;
  color: var(--c-success);
  font-weight: 800;
}

.shard-tag {
  font-size: 0.66rem;
  color: var(--c-ink-soft);
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 0.7rem;
}
</style>
<style scoped>
.draw-card {
  animation: draw-card-pop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes draw-card-pop {
  from {
    transform: translateY(16px) rotateY(90deg) scale(0.7);
    opacity: 0;
  }
  to {
    transform: translateY(0) rotateY(0) scale(1);
    opacity: 1;
  }
}
</style>
