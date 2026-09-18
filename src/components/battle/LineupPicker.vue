<script setup lang="ts">
import { computed } from 'vue'

import { getPet } from '@/game/data/pets'
import { LINEUP_SIZE } from '@/game/data/balance'
import type { OwnedPet } from '@/stores/profile'
import PetAvatar from '@/components/common/PetAvatar.vue'

const props = defineProps<{
  owned: readonly OwnedPet[]
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

const ownedPets = computed(() => props.owned.map((p) => getPet(p.id)))
const starsOf = (petId: string): number =>
  props.owned.find((p) => p.id === petId)?.stars ?? 1

const ROLE_LABEL: Record<string, string> = {
  shooter: '射手',
  cannon: '炮手',
  ice: '冰系',
  support: '辅助',
  antiair: '对空',
}

function toggle(petId: string): void {
  const next = props.modelValue.includes(petId)
    ? props.modelValue.filter((id) => id !== petId)
    : [...props.modelValue, petId]
  emit('update:modelValue', next.slice(0, LINEUP_SIZE))
}
</script>

<template>
  <div class="lineup-picker">
    <p class="tip">
      已选 {{ props.modelValue.length }} / {{ LINEUP_SIZE }}（点击头像选择出战宠物）
    </p>
    <div class="grid">
      <button
        v-for="pet in ownedPets"
        :key="pet.id"
        :class="['pick', { picked: props.modelValue.includes(pet.id) }]"
        @click="toggle(pet.id)"
      >
        <PetAvatar :pet-id="pet.id" :stars="starsOf(pet.id)" :size="44" />
        <span class="name">{{ pet.name }}</span>
        <span class="role-tag">{{ pet.rarity }} · {{ ROLE_LABEL[pet.role] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tip {
  margin: 0 0 0.6rem;
  color: var(--c-ink-soft);
  font-size: 0.85rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.6rem, 1fr));
  gap: 0.5rem;
}

.pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.5rem 0.3rem;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  background: var(--c-bg-sunken);
}

.pick.picked {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}

.name {
  font-size: 0.78rem;
  font-weight: 600;
}

.role-tag {
  font-size: 0.68rem;
  color: var(--c-ink-soft);
}
</style>
