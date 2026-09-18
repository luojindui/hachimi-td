<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { listLevels } from '@/game/data/levels'
import { useProfileStore } from '@/stores/profile'
import { assets } from '@/render/registry'

const profile = useProfileStore()
const A = assets()

const levels = computed(() =>
  listLevels().map((entry) => ({
    ...entry,
    unlocked: profile.unlockedLevelIds.includes(entry.id),
  })),
)

onMounted(() => {
  if (!profile.initialized) profile.init()
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

    <section class="entries">
      <RouterLink to="/dex" class="btn btn-primary">📖 图鉴</RouterLink>
      <RouterLink to="/hatch" class="btn btn-primary">🥚 孵蛋</RouterLink>
      <RouterLink to="/pinball" class="btn btn-primary">🎰 弹珠屋</RouterLink>
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
  justify-content: center;
  gap: 1rem;
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
