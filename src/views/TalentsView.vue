<script setup lang="ts">
import { computed } from 'vue'

import { TALENTS } from '@/game/data/balance'
import type { TalentNode, TalentBranch } from '@/game/data/balance'
import { useProfileStore } from '@/stores/profile'
import { assets } from '@/render/registry'

const profile = useProfileStore()
const A = assets()

const BRANCHES: { key: TalentBranch; name: string; icon: string }[] = [
  { key: 'attack', name: '攻击系', icon: '⚔️' },
  { key: 'economy', name: '经济系', icon: '💰' },
  { key: 'survival', name: '生存系', icon: '🛡️' },
]

const byBranch = (branch: TalentBranch): TalentNode[] =>
  TALENTS.filter((t) => t.branch === branch).sort((a, b) => a.tier - b.tier)

const owned = computed(() => new Set(profile.talents))

function nodeState(node: TalentNode): 'owned' | 'available' | 'locked' {
  if (owned.value.has(node.id)) return 'owned'
  const prereq = TALENTS.find(
    (t) => t.branch === node.branch && t.tier === node.tier - 1,
  )
  if (prereq && !owned.value.has(prereq.id)) return 'locked'
  if (profile.totalStars < node.starReq) return 'locked'
  if (profile.catnip < node.cost) return 'locked'
  return 'available'
}

function buy(node: TalentNode): void {
  profile.buyTalent(node.id)
}
</script>

<template>
  <main class="talents">
    <header class="head">
      <RouterLink to="/" class="btn btn-ghost back">‹ 主页</RouterLink>
      <h1 class="title">⭐ 天赋树</h1>
      <span class="wallet">{{ A.icon('catnip') }} {{ profile.catnip }}</span>
    </header>

    <p class="tip">
      累计星数 {{ profile.totalStars }} ⭐ 解锁天赋 · 猫薄荷购买 · 永久生效
    </p>

    <div class="tree">
      <section
        v-for="branch in BRANCHES"
        :key="branch.key"
        class="branch card"
      >
        <h2 class="branch-name">{{ branch.icon }} {{ branch.name }}</h2>
        <div
          v-for="node in byBranch(branch.key)"
          :key="node.id"
          :class="['node', nodeState(node)]"
        >
          <div class="node-head">
            <span class="node-name">{{ node.name }}</span>
            <span class="node-star">{{ node.starReq }}⭐</span>
          </div>
          <p class="node-desc">{{ node.desc }}</p>
          <button
            v-if="nodeState(node) !== 'owned'"
            class="btn btn-primary buy"
            :disabled="nodeState(node) === 'locked'"
            @click="buy(node)"
          >
            {{ node.cost }}{{ A.icon('catnip') }}
          </button>
          <span v-else class="owned-mark">✔ 已习得</span>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.talents {
  flex: 1;
  width: min(52rem, 100%);
  margin: 0 auto;
  padding: 0.8rem 0.7rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.head {
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

.tip {
  margin: 0;
  font-size: 0.85rem;
  color: var(--c-ink-soft);
  text-align: center;
}

.tree {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.7rem;
}

.branch {
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.branch-name {
  margin: 0;
  font-size: 1rem;
  text-align: center;
}

.node {
  border: 2px solid var(--c-line);
  border-radius: var(--radius-md);
  padding: 0.55rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.node.owned {
  border-color: var(--c-success);
  background: rgba(88, 179, 104, 0.08);
}

.node-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-name {
  font-weight: 700;
  font-size: 0.88rem;
}

.node-star {
  font-size: 0.7rem;
  color: var(--c-rarity-ssr);
}

.node-desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--c-ink-soft);
}

.buy {
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
}

.owned-mark {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--c-success);
  text-align: center;
}
</style>
