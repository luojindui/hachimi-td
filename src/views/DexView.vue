<script setup lang="ts">
import { computed, ref } from 'vue'

import { LINEUP_SIZE } from '@/game/data/balance'
import { getPet, PET_LIST } from '@/game/data/pets'
import type { PetDef } from '@/game/types'
import { useProfileStore } from '@/stores/profile'
import { assets } from '@/render/registry'
import PetAvatar from '@/components/common/PetAvatar.vue'

const profile = useProfileStore()
const A = assets()

const selectedId = ref<string | null>(null)
const selected = computed<PetDef | null>(() =>
  selectedId.value ? getPet(selectedId.value) : null,
)

function ownedOf(petId: string) {
  return profile.pets.find((p) => p.id === petId)
}

const inLineup = computed(
  () => selectedId.value !== null && profile.lineup.includes(selectedId.value),
)

const starUpCost = computed(() => {
  if (!selectedId.value) return null
  return {
    shards: profile.starUpShardsNeeded(ownedOf(selectedId.value)?.stars ?? 1),
    catnip: profile.starUpCatnipNeeded(selectedId.value),
  }
})

const canStarUp = computed<boolean>(() => {
  const petId = selectedId.value
  if (!petId) return false
  const owned = ownedOf(petId)
  if (!owned) return false
  const shards = profile.starUpShardsNeeded(owned.stars)
  const catnip = profile.starUpCatnipNeeded(petId)
  if (shards === null || catnip === null) return false
  return owned.shards >= shards && profile.catnip >= catnip
})

const lineupFull = computed(() => profile.lineup.length >= LINEUP_SIZE)
const lineupMsg = ref<string | null>(null)

function doStarUp(): void {
  if (selectedId.value) profile.starUp(selectedId.value)
}

function toggleLineup(): void {
  const id = selectedId.value
  if (!id || !ownedOf(id)) return
  if (profile.lineup.includes(id)) {
    profile.setLineup(profile.lineup.filter((x) => x !== id))
    lineupMsg.value = null
    return
  }
  if (lineupFull.value) {
    lineupMsg.value = '编队已满（6 只），请先移出一只'
    return
  }
  profile.setLineup([...profile.lineup, id])
  lineupMsg.value = null
}

function roleText(pet: PetDef): string {
  const map: Record<string, string> = {
    shooter: '射手',
    cannon: '炮手',
    ice: '冰系',
    support: '辅助',
    antiair: '对空',
  }
  return map[pet.role] ?? pet.role
}

function targetsText(pet: PetDef): string {
  if (pet.targets === 'both') return '空地双修'
  return pet.targets === 'air' ? '仅对空' : '仅地面'
}
</script>

<template>
  <main class="dex">
    <header class="dex-head">
      <RouterLink to="/" class="btn btn-ghost back">‹ 主页</RouterLink>
      <h1 class="title">宠物图鉴</h1>
      <span class="count">{{ profile.pets.length }} / {{ PET_LIST.length }}</span>
    </header>

    <section class="grid-wrap">
      <div class="grid">
        <button
          v-for="pet in PET_LIST"
          :key="pet.id"
          :class="['pet-cell', { picked: selectedId === pet.id, unowned: !ownedOf(pet.id) }]"
          :style="{ '--ring': A.rarityColor(pet.rarity) }"
          @click="selectedId = pet.id"
        >
          <template v-if="ownedOf(pet.id)">
            <PetAvatar :pet-id="pet.id" :size="52" :stars="ownedOf(pet.id)!.stars" />
            <span class="cell-name">{{ pet.name }}</span>
            <span v-if="ownedOf(pet.id)!.shards > 0" class="cell-shards">
              碎片 {{ ownedOf(pet.id)!.shards }}
            </span>
          </template>
          <template v-else>
            <span class="mystery">❓</span>
            <span class="cell-name unknown">未获得</span>
          </template>
        </button>
      </div>
    </section>

    <!-- 详情 -->
    <section v-if="selected" class="detail card">
      <header class="detail-head">
        <PetAvatar
          :pet-id="selected.id"
          :size="64"
          :stars="ownedOf(selected.id)?.stars"
        />
        <div class="head-text">
          <h2 class="pet-title">
            {{ selected.name }}
            <span class="rarity-tag" :style="{ color: A.rarityColor(selected.rarity) }">
              {{ selected.rarity }}
            </span>
          </h2>
          <p class="desc">{{ selected.desc }}</p>
        </div>
      </header>

      <dl class="stats">
        <div><dt>定位</dt><dd>{{ roleText(selected) }} · {{ targetsText(selected) }}</dd></div>
        <div><dt>攻击 / 间隔</dt><dd>{{ selected.attack }} / {{ selected.attackInterval }}s</dd></div>
        <div><dt>射程</dt><dd>{{ selected.range }}</dd></div>
        <div><dt>建造费用</dt><dd>{{ A.icon('fish') }} {{ selected.cost }}</dd></div>
        <div v-if="selected.slow"><dt>减速</dt><dd>×{{ selected.slow.factor }} / {{ selected.slow.duration }}s</dd></div>
        <div v-if="selected.splash"><dt>溅射半径</dt><dd>{{ selected.splash }}</dd></div>
      </dl>

      <template v-if="ownedOf(selected.id)">
        <p class="own-line">
          当前 <strong>{{ ownedOf(selected.id)!.stars }}★</strong>
          · 碎片 <strong>{{ ownedOf(selected.id)!.shards }}</strong>
        </p>
        <div class="actions">
          <button
            v-if="starUpCost?.catnip !== null && starUpCost?.shards !== null"
            class="btn btn-primary"
            :disabled="!canStarUp"
            @click="doStarUp"
          >
            升至 {{ (ownedOf(selected.id)?.stars ?? 1) + 1 }}★
            （{{ starUpCost?.shards }}片 + {{ starUpCost?.catnip }}{{ A.icon('catnip') }}）
          </button>
          <span v-else class="max-star">已满 ★</span>
          <button
            class="btn btn-ghost"
            :disabled="!inLineup && lineupFull"
            @click="toggleLineup"
          >
            {{ inLineup ? '移出编队' : lineupFull ? '编队已满' : '加入编队' }}
          </button>
        </div>
        <p v-if="lineupMsg" class="lineup-msg">{{ lineupMsg }}</p>
      </template>
      <p v-else class="own-line">获得后可编入出战队伍</p>
    </section>
  </main>
</template>

<style scoped>
.dex {
  flex: 1;
  width: min(56rem, 100%);
  margin: 0 auto;
  padding: 0.8rem 0.7rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.dex-head {
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

.count {
  color: var(--c-ink-soft);
  font-size: 0.9rem;
  min-width: 4rem;
  text-align: right;
}

.back {
  min-width: 4.2rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(5.4rem, 1fr));
  gap: 0.5rem;
}

.pet-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.55rem 0.3rem;
  border-radius: var(--radius-md);
  background: var(--c-bg-card);
  border: 2px solid var(--c-line);
  box-shadow: var(--shadow-card);
}

.pet-cell.picked {
  border-color: var(--ring, var(--c-primary));
  background: var(--c-primary-soft);
}

.pet-cell.unowned {
  opacity: 0.6;
}

.mystery {
  font-size: 2rem;
  line-height: 52px;
}

.cell-name {
  font-size: 0.78rem;
  font-weight: 600;
}

.cell-name.unknown {
  color: var(--c-ink-soft);
}

.cell-shards {
  font-size: 0.66rem;
  color: var(--c-ink-soft);
}

.detail {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.detail-head {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.pet-title {
  margin: 0;
  font-size: 1.15rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rarity-tag {
  font-size: 0.9rem;
}

.desc {
  margin: 0.2rem 0 0;
  color: var(--c-ink-soft);
  font-size: 0.88rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.4rem 0.8rem;
  margin: 0;
}

.stats div {
  display: flex;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.stats dt {
  color: var(--c-ink-soft);
}

.stats dd {
  margin: 0;
  font-weight: 600;
}

.own-line {
  margin: 0;
  font-size: 0.9rem;
}

.lineup-msg {
  margin: 0;
  font-size: 0.85rem;
  color: var(--c-danger);
}

.actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.max-star {
  align-self: center;
  color: var(--c-rarity-ssr);
  font-weight: 700;
}
</style>
