<script setup lang="ts">
import { computed } from 'vue'

import { getPet } from '@/game/data/pets'
import type { PetDef, Rarity, BattleSnapshot } from '@/game/types'
import { assets } from '@/render/registry'

const props = defineProps<{
  lineup: readonly PetDef[]
  snapshot: BattleSnapshot
  /** 当前选中建造格下标；null = 未选中 */
  selectedSlot: number | null
  /** 选中格的塔属性（无塔为 null） */
  towerStats: { attack: number; interval: number; range: number; level: 1 | 2 | 3 } | null
  upgradeCost: number | null
  sellValue: number | null
}>()

const emit = defineEmits<{
  place: [petId: string]
  upgrade: [branch: 'quick' | 'heavy' | undefined]
  sell: []
  close: []
  /** 从编队栏开始拖拽宠物（placement 模式） */
  dragStart: [payload: { petId: string; event: PointerEvent }]
}>()

const A = assets()

const selectedTower = computed(() => {
  if (props.selectedSlot === null) return null
  return (
    props.snapshot.towers.find((t) => t.slotIndex === props.selectedSlot) ?? null
  )
})

/** 编队中已上场的宠物 id（不可重复放置） */
const deployedPetIds = computed(
  () => new Set(props.snapshot.towers.map((t) => t.petId)),
)

/** placement 模式：可拖拽 = 买得起且未上场 */
function draggable(pet: PetDef): boolean {
  return !deployedPetIds.value.has(pet.id) && props.snapshot.gold >= pet.cost
}

function onCardPointerDown(pet: PetDef, event: PointerEvent): void {
  if (props.selectedSlot !== null) return // 紧凑模式走点击放置
  if (!draggable(pet)) return
  emit('dragStart', { petId: pet.id, event })
}

function rarityColor(rarity: Rarity): string {
  return A.rarityColor(rarity)
}

function petName(petId: string): string {
  return getPet(petId).name
}
</script>

<template>
  <section class="tower-menu card">
    <!-- 未选格：编队卡片可拖拽到建造格 -->
    <template v-if="props.selectedSlot === null">
      <header class="menu-head">
        <span class="menu-title">按住宠物拖到虚线建造格（或点格子再选）</span>
        <span class="gold">{{ A.icon('fish') }} {{ props.snapshot.gold }}</span>
      </header>
      <div class="lineup-row">
        <button
          v-for="pet in props.lineup"
          :key="pet.id"
          class="pet-card draggable"
          :disabled="!draggable(pet)"
          :title="deployedPetIds.has(pet.id) ? '已上场' : '拖到建造格放置'"
          @pointerdown="onCardPointerDown(pet, $event)"
        >
          <span
            class="avatar"
            :style="{ borderColor: rarityColor(pet.rarity), background: pet.tint }"
          >
            {{ pet.emoji }}
          </span>
          <span class="pet-name">{{ pet.name }}</span>
          <span class="pet-cost">{{ A.icon('fish') }}{{ pet.cost }}</span>
          <span v-if="deployedPetIds.has(pet.id)" class="pet-blocked">已上场</span>
        </button>
        <p v-if="props.lineup.length === 0" class="empty-tip">编队为空</p>
      </div>
    </template>

    <!-- 选中空格 -->
    <template v-else-if="!selectedTower">
      <header class="menu-head">
        <span class="menu-title">空建造格</span>
        <button class="close-btn" @click="emit('close')">✕</button>
      </header>
      <p class="empty-tip">从下方编队选择一只宠物放置</p>
      <div class="lineup-row compact">
        <button
          v-for="pet in props.lineup"
          :key="pet.id"
          class="pet-card mini"
          :disabled="!draggable(pet)"
          @click="emit('place', pet.id)"
        >
          <span class="avatar" :style="{ borderColor: rarityColor(pet.rarity), background: pet.tint }">
            {{ pet.emoji }}
          </span>
          <span class="pet-cost">{{ pet.cost }}</span>
        </button>
      </div>
    </template>

    <!-- 选中已有塔：升级 / 出售 -->
    <template v-else>
      <header class="menu-head">
        <span class="menu-title">
          {{ petName(selectedTower.petId) }}
          <span class="lv">Lv{{ selectedTower.level }}</span>
        </span>
        <button class="close-btn" @click="emit('close')">✕</button>
      </header>
      <div v-if="props.towerStats" class="stat-line">
        攻击 {{ props.towerStats.attack.toFixed(0) }} ·
        间隔 {{ props.towerStats.interval.toFixed(2) }}s ·
        射程 {{ props.towerStats.range.toFixed(1) }}
      </div>
      <div class="action-row">
        <template v-if="props.upgradeCost !== null">
          <button
            v-if="(selectedTower?.level ?? 1) === 1"
            class="btn btn-primary"
            :disabled="props.snapshot.gold < props.upgradeCost"
            @click="emit('upgrade', 'quick')"
          >
            速攻<span class="branch-tip">攻速流·射程+</span>（{{ props.upgradeCost }}🐟）
          </button>
          <button
            v-if="(selectedTower?.level ?? 1) === 1"
            class="btn btn-primary"
            :disabled="props.snapshot.gold < props.upgradeCost"
            @click="emit('upgrade', 'heavy')"
          >
            重击<span class="branch-tip">破甲50%</span>（{{ props.upgradeCost }}🐟）
          </button>
          <button
            v-if="(selectedTower?.level ?? 1) !== 1"
            class="btn btn-primary"
            :disabled="props.snapshot.gold < props.upgradeCost"
            @click="emit('upgrade', undefined)"
          >
            升级 Lv{{ (selectedTower?.level ?? 1) + 1 }}（{{ props.upgradeCost }}🐟）
          </button>
        </template>
        <span v-else class="max-lv">已满级</span>
        <button class="btn btn-danger" @click="emit('sell')">
          出售（+{{ props.sellValue }}🐟）
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tower-menu {
  padding: 0.7rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.menu-title {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.lv {
  background: var(--c-primary-soft);
  color: var(--c-primary-deep);
  border-radius: 8px;
  padding: 0.05rem 0.4rem;
  font-size: 0.8rem;
}

.gold {
  font-weight: 700;
  color: var(--c-primary-deep);
}

.lineup-row {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.2rem;
}

.pet-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-md);
  background: var(--c-bg-sunken);
  min-width: 4.4rem;
  transition: transform 0.08s ease;
}

.pet-card.draggable {
  touch-action: none;
  cursor: grab;
}

.pet-card.draggable:not(:disabled):active {
  cursor: grabbing;
}

.pet-card:not(:disabled):active {
  transform: scale(0.95);
}

.pet-card:disabled {
  opacity: 0.55;
}

.pet-card.mini {
  min-width: 3.4rem;
}

.avatar {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 999px;
  border: 3px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.pet-name {
  font-size: 0.78rem;
  font-weight: 600;
}

.pet-cost {
  font-size: 0.72rem;
  color: var(--c-primary-deep);
  font-weight: 700;
}

.pet-blocked {
  font-size: 0.66rem;
  color: var(--c-danger);
}

.empty-tip {
  color: var(--c-ink-soft);
  font-size: 0.85rem;
  margin: 0;
}

.stat-line {
  font-size: 0.85rem;
  color: var(--c-ink-soft);
}

.action-row {
  display: flex;
  gap: 0.6rem;
}

.max-lv {
  align-self: center;
  color: var(--c-ink-soft);
  font-weight: 600;
}
</style>
<style scoped>
.branch-tip {
  display: block;
  font-size: 0.62rem;
  font-weight: 600;
  opacity: 0.75;
}
</style>
