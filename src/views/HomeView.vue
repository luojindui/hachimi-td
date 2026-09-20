<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { listLevels } from '@/game/data/levels'
import { getDailyChallenge, todayStr } from '@/game/daily'
import { PET_LIST } from '@/game/data/pets'
import { useProfileStore } from '@/stores/profile'
import { assets } from '@/render/registry'

const profile = useProfileStore()
const A = assets()
const daily = getDailyChallenge(todayStr())
const ONBOARD_KEY = 'hachimi-td:onboarded'
const showOnboard = ref(!localStorage.getItem(ONBOARD_KEY))
function dismissOnboard(): void {
  localStorage.setItem(ONBOARD_KEY, '1')
  showOnboard.value = false
}
const collected = profile.pets.length
const PET_TOTAL = PET_LIST.length
const dailyDone = computed(
  () => profile.daily.lastClaimDate === daily.date,
)

const levels = computed(() =>
  listLevels().map((entry) => ({
    ...entry,
    unlocked: profile.unlockedLevelIds.includes(entry.id),
  })),
)

onMounted(() => {
})

function starsText(id: string): string {
  const stars = profile.levels[id]?.stars ?? 0
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}
</script>

<template>
  <main class="home">
    <header class="home-head">
      <h1 class="logo">🐱 哈基米塔防</h1>
      <div class="wallet">
        <span class="chip">{{ A.icon('catnip') }} {{ profile.catnip }}</span>
        <span class="chip">{{ A.icon('star') }} {{ profile.totalStars }}</span>
      </div>
    </header>

    <p v-if="!profile.persistent" class="notice">
      当前浏览器环境无法保存进度（如无痕模式），关闭页面后进度将丢失
    </p>

    <section class="card block">
      <h2 class="block-title">关卡选择</h2>
      <div class="level-list">
        <template v-for="entry in levels" :key="entry.id">
          <RouterLink
            v-if="entry.unlocked"
            class="level card"
            :to="`/battle/${entry.id}`"
          >
            <span class="level-name">
              第{{ entry.id }}关 · {{ entry.name }}
            </span>
            <span class="level-meta">
              <span class="stars">{{ starsText(entry.id) }}</span>
              <span
                class="level-gold"
                :title="`首通 ${entry.firstClearCatnip} / 重复 ${entry.repeatClearCatnip}`"
              >
                🐟 {{ entry.firstClearCatnip }}
              </span>
            </span>
          </RouterLink>
          <div v-else class="level card locked">
            <span class="level-name">第{{ entry.id }}关 · {{ entry.name }}</span>
            <span class="level-meta">
              <span class="lock">🔒 通关上一关解锁</span>
            </span>
          </div>
        </template>
      </div>
    </section>

    <RouterLink
      v-if="profile.endlessUnlocked"
      to="/battle/endless"
      class="endless card"
    >
      ♾️ 无尽模式 · 星空粮仓
      <span class="endless-best">最佳纪录：第 {{ profile.endless.bestWave }} 波</span>
    </RouterLink>

    <div v-if="showOnboard" class="onboard card" role="dialog" aria-label="新手引导">
      <h2 class="onboard-title">🐺 欢迎来到哈基米塔防！</h2>
      <p class="onboard-line">🐱 编队出战的猫狗守卫 <strong>粮仓</strong>，别让老鼠偷粮</p>
      <p class="onboard-line">🐟 <strong>小鱼干</strong>：建造/升级宠物，通关与击杀获得</p>
      <p class="onboard-line">🌿 <strong>猫薄荷</strong>：孵蛋抽卡 / 升星 / 天赋（主页孵蛋）</p>
      <p class="onboard-line">⭐ <strong>星数</strong>：通关星级累计，解锁天赋树</p>
      <p class="onboard-line">🎯 三选一强化每波开始时出现，选中前战斗暂停</p>
      <button class="btn btn-primary" @click="dismissOnboard">开始游戏！</button>
    </div>

    <RouterLink to="/battle/daily" class="daily card">
      📅 每日挑战
      <span class="daily-meta">
        {{ dailyDone ? `✅ 今日完成 · 连签 ${profile.dailyStreak()} 天` : `奖励 ${daily.catnipReward}🌿` }}
      </span>
    </RouterLink>

    <section class="entries">
      <RouterLink to="/dex" class="btn btn-primary" :title="`宠物收集进度：${collected}/${PET_TOTAL}`">
        📖 图鉴 {{ collected }}/{{ PET_TOTAL }}
      </RouterLink>
      <RouterLink to="/hatch" class="btn btn-primary">🥚 孵蛋</RouterLink>
      <RouterLink to="/talents" class="btn btn-primary">⭐ 天赋</RouterLink>
      <RouterLink to="/settings" class="btn btn-ghost">⚙️ 设置</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.home {
  flex: 1;
  width: min(40rem, 100%);
  margin: 0 auto;
  padding: 1rem 0.8rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.home-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  margin: 0;
  font-size: 1.4rem;
}

.wallet {
  display: flex;
  gap: 0.4rem;
}

.chip {
  background: var(--c-bg-card);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: var(--shadow-card);
}

.notice {
  margin: 0;
  background: #ffe2e2;
  color: var(--c-danger);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.7rem;
  font-size: 0.85rem;
}

.block {
  padding: 0.9rem;
}

.block-title {
  margin: 0 0 0.6rem;
  font-size: 1rem;
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.level {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  text-decoration: none;
  color: inherit;
}

.level.locked {
  opacity: 0.55;
  pointer-events: none;
}

.level-gold {
  font-size: 0.75rem;
  color: var(--c-ink-soft, #8a8f98);
}

.level-name {
  font-weight: 700;
  font-size: 0.95rem;
}

.level-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stars {
  color: var(--c-rarity-ssr);
  font-size: 0.9rem;
  letter-spacing: 2px;
}

.lock {
  font-size: 0.8rem;
  color: var(--c-ink-soft);
}

.entries {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.daily {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.9rem;
  text-decoration: none;
  color: inherit;
  border: 2px solid var(--c-info);
}

.daily-meta {
  font-size: 0.8rem;
  color: var(--c-ink-soft);
}

.endless {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.9rem;
  text-decoration: none;
  color: inherit;
  border: 2px solid var(--c-rarity-ssr);
}

.endless-best {
  font-size: 0.8rem;
  color: var(--c-ink-soft);
}
</style>
<style scoped>
.onboard {
  border: 2px solid var(--c-primary, #f0932b);
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.onboard-title {
  margin: 0 0 0.2rem;
  font-size: 1.05rem;
}

.onboard-line {
  margin: 0;
  font-size: 0.82rem;
  color: var(--c-ink-soft, #8a8f98);
}

.onboard .btn {
  margin-top: 0.4rem;
  align-self: flex-end;
}
</style>
