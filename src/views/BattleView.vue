<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getPet } from '@/game/data/pets'
import { getLevel } from '@/game/data/levels'
import { starsFor } from '@/game/engine/GameEngine'
import type { LevelDef } from '@/game/types'
import { useProfileStore } from '@/stores/profile'
import { useBattleEngine } from '@/composables/useBattleEngine'
import { useTowerDrag } from '@/composables/useTowerDrag'
import { assets } from '@/render/registry'
import BattleCanvas from '@/components/battle/BattleCanvas.vue'
import BattleHud from '@/components/battle/BattleHud.vue'
import LineupPicker from '@/components/battle/LineupPicker.vue'
import ResultModal from '@/components/battle/ResultModal.vue'
import TowerMenu from '@/components/battle/TowerMenu.vue'

const route = useRoute()
const router = useRouter()
const profile = useProfileStore()
const A = assets()

/* ---------- 关卡解析（路由参数在挂载期固定） ---------- */

function resolveLevel(): LevelDef {
  const id = String(route.params.levelId ?? '1')
  try {
    return getLevel(id)
  } catch {
    router.replace('/')
    return getLevel('1')
  }
}

const level = resolveLevel()
const isEndless = level.endless === true

/* ---------- 编队 ---------- */

const pickedIds = ref<string[]>([])
const battleStarted = ref(false)

watch(
  () => profile.initialized,
  () => {
    if (!profile.initialized) return
    const owned = new Set(profile.ownedPetIds)
    pickedIds.value = profile.lineup.filter((id) => owned.has(id))
  },
  { immediate: true },
)

function lineupPetDefs() {
  return pickedIds.value.map((id) => getPet(id))
}

function starLevels(): Record<string, number> {
  const map: Record<string, number> = {}
  for (const id of pickedIds.value) {
    map[id] = profile.pets.find((p) => p.id === id)?.stars ?? 1
  }
  return map
}

function confirmLineup(): void {
  if (pickedIds.value.length === 0) return
  profile.setLineup(pickedIds.value)
  battleStarted.value = true
  battle.start()
}

// 调试/演示辅助：?autostart=1 跳过编队确认直接开战（用于自动化截图验证）
onMounted(() => {
  if (!battleStarted.value && route.query.autostart === '1' && pickedIds.value.length > 0) {
    confirmLineup()
    // 演示布阵：把编队宠物按顺序放到前几个建造格
    const demoSlots = [1, 0, 2, 4, 3, 5]
    let si = 0
    for (const id of pickedIds.value) {
      while (si < demoSlots.length) {
        const slot = demoSlots[si]!
        si++
        if (engine.value?.canPlace(slot, id).ok) {
          engine.value.placeTower(slot, id)
          break
        }
      }
    }
  }
})

/* ---------- 引擎循环 ---------- */

const battle = useBattleEngine(() => ({
  level,
  lineup: lineupPetDefs(),
  starLevels: starLevels(),
}))

const snapshot = battle.snapshot
const engine = battle.engine

/* ---------- 拖拽放塔 ---------- */

const battleCanvasRef = ref<InstanceType<typeof BattleCanvas> | null>(null)

function placePetAt(slotIndex: number, petId: string): void {
  const e = engine.value
  if (!e) return
  try {
    e.placeTower(slotIndex, petId)
    selectedSlot.value = null
  } catch {
    /* 悬停高亮已做前置校验，吞掉竞态错误 */
  }
}

const towerDrag = useTowerDrag({
  getCanvasEl: () => battleCanvasRef.value?.getCanvasEl() ?? null,
  level: () => level,
  canPlace: (slotIndex, petId) =>
    engine.value?.canPlace(slotIndex, petId) ?? { ok: false },
  onDrop: placePetAt,
})

const dragGhostStyle = computed(() => ({
  left: `${towerDrag.ghostPos.value.x}px`,
  top: `${towerDrag.ghostPos.value.y}px`,
}))

const dragGhostVisual = computed(() =>
  towerDrag.draggingPetId.value
    ? assets().petVisual(towerDrag.draggingPetId.value)
    : null,
)

const dragHighlight = computed(() =>
  towerDrag.hoverSlot.value === null
    ? null
    : {
        slotIndex: towerDrag.hoverSlot.value,
        valid: towerDrag.hoverValid.value,
      },
)

function onDragStart(payload: { petId: string; event: PointerEvent }): void {
  selectedSlot.value = null
  towerDrag.startDrag(payload.petId, payload.event)
}

/* ---------- 建造交互（点击流：点格 → 菜单选宠/升级/出售） ---------- */

const selectedSlot = ref<number | null>(null)

function onSlotClick(slotIndex: number | null): void {
  selectedSlot.value = slotIndex
}

function placePet(petId: string): void {
  const e = engine.value
  if (!e || selectedSlot.value === null) return
  try {
    e.placeTower(selectedSlot.value, petId)
  } catch {
    /* UI 已做前置校验，吞掉竞态错误 */
  }
  selectedSlot.value = null
}

function upgradeSelected(): void {
  const e = engine.value
  if (!e || selectedSlot.value === null) return
  try {
    e.upgradeTower(selectedSlot.value)
  } catch {
    /* 忽略 */
  }
}

function sellSelected(): void {
  const e = engine.value
  if (!e || selectedSlot.value === null) return
  try {
    e.sellTower(selectedSlot.value)
  } catch {
    /* 忽略 */
  }
  selectedSlot.value = null
}

function toggleSpeed(): void {
  const next = snapshot.value?.speed === 2 ? 1 : 2
  engine.value?.setSpeed(next)
}

function callNext(): void {
  try {
    engine.value?.callNextWave()
  } catch {
    /* 忽略 */
  }
}

/** 退出确认（战斗中退出=放弃本局） */
const confirmExit = ref(false)

function requestExit(): void {
  if (snapshot.value?.outcome !== 'ongoing') {
    goHome()
    return
  }
  confirmExit.value = true
}

function confirmExitYes(): void {
  confirmExit.value = false
  goHome()
}

/* ---------- 建造菜单数据 ---------- */

const lineupDefs = computed(() =>
  battle.engine.value ? battle.engine.value.getLineup() : [],
)

const selectedTowerStats = computed(() => {
  if (selectedSlot.value === null || !engine.value) return null
  return engine.value.towerStats(selectedSlot.value)
})

const upgradeCost = computed(() => {
  if (selectedSlot.value === null || !engine.value) return null
  return engine.value.upgradeCost(selectedSlot.value)
})

const sellValue = computed(() => {
  if (selectedSlot.value === null || !engine.value) return null
  return engine.value.sellValue(selectedSlot.value)
})

/* ---------- 结算（outcome 变化只处理一次） ---------- */

const settlement = ref<{
  outcome: 'victory' | 'defeat'
  stars: number
  catnipGained: number
  kills: number
  waveReached?: number
} | null>(null)

watch(
  () => snapshot.value?.outcome,
  (outcome) => {
    if (!outcome || outcome === 'ongoing' || settlement.value) return
    const snap = snapshot.value!
    let catnipGained = 0

    if (isEndless) {
      const waveReached = snap.waveIndex + 1
      catnipGained = profile.recordEndless(waveReached, snap.kills).catnipGained
      settlement.value = {
        outcome,
        stars: 0,
        catnipGained,
        kills: snap.kills,
        waveReached,
      }
    } else if (outcome === 'victory') {
      const stars = starsFor(snap.baseHp, snap.baseMaxHp)
      catnipGained = profile.completeLevel(level.id, stars, snap.kills).catnipGained
      settlement.value = { outcome, stars, catnipGained, kills: snap.kills }
    } else {
      settlement.value = { outcome, stars: 0, catnipGained: 0, kills: snap.kills }
    }
  },
)

function retry(): void {
  settlement.value = null
  selectedSlot.value = null
  battle.start()
}

function goHome(): void {
  router.push('/')
}
</script>

<template>
  <main class="battle-page">
    <!-- 战前编队 -->
    <section v-if="!battleStarted" class="prep card">
      <h2 class="prep-title">{{ level.name }} · 出战编队</h2>
      <LineupPicker v-model="pickedIds" :owned="profile.pets" />
      <div class="prep-actions">
        <button class="btn btn-ghost" @click="goHome">返回</button>
        <button
          class="btn btn-primary"
          :disabled="pickedIds.length === 0"
          @click="confirmLineup"
        >
          开始战斗
        </button>
      </div>
    </section>

    <template v-else-if="snapshot">
      <BattleHud
        :level-name="level.name"
        :snapshot="snapshot"
        :speed="snapshot.speed"
        :is-endless="isEndless"
        @toggle-speed="toggleSpeed"
        @call-next="callNext"
        @exit="requestExit"
      />
      <BattleCanvas
        ref="battleCanvasRef"
        :level="level"
        :snapshot="snapshot"
        :highlight="dragHighlight"
        @slot-click="onSlotClick"
      />
      <TowerMenu
        :lineup="lineupDefs"
        :snapshot="snapshot"
        :selected-slot="selectedSlot"
        :tower-stats="selectedTowerStats"
        :upgrade-cost="upgradeCost"
        :sell-value="sellValue"
        @place="placePet"
        @upgrade="upgradeSelected"
        @sell="sellSelected"
        @close="selectedSlot = null"
        @drag-start="onDragStart"
      />

      <!-- 拖拽跟随的悬浮宠物 -->
      <div
        v-if="dragGhostVisual"
        class="drag-ghost"
        :style="dragGhostStyle"
      >
        <span
          class="drag-avatar"
          :style="{ borderColor: A.rarityColor(dragGhostVisual.rarity), background: dragGhostVisual.tint }"
        >
          {{ dragGhostVisual.emoji }}
        </span>
      </div>

      <!-- 退出确认 -->
      <div v-if="confirmExit" class="confirm-mask" @click="confirmExit = false">
        <div class="confirm card" @click.stop>
          <p class="confirm-text">
            要退出战斗吗？<br />
            <strong>退出将放弃本局，不会获得任何奖励。</strong>
          </p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" @click="confirmExit = false">继续战斗</button>
            <button class="btn btn-danger" @click="confirmExitYes">退出</button>
          </div>
        </div>
      </div>

      <ResultModal
        v-if="settlement"
        v-bind="settlement"
        :is-endless="isEndless"
        @retry="retry"
        @home="goHome"
      />
    </template>
  </main>
</template>

<style scoped>
.battle-page {
  flex: 1;
  width: min(58rem, 100%);
  margin: 0 auto;
  padding: 0.4rem 0.6rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.prep {
  margin-top: 1rem;
  padding: 1rem;
}

.prep-title {
  margin: 0 0 0.8rem;
  font-size: 1.1rem;
}

.prep-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.8rem;
}

.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(74, 59, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 1rem;
}

.confirm {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: center;
}

.confirm-text {
  margin: 0;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}

/* 拖拽跟随的悬浮宠物 */
.drag-ghost {
  position: fixed;
  z-index: 80;
  pointer-events: none;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 4px 8px rgba(74, 59, 50, 0.35));
}

.drag-avatar {
  width: 3.2rem;
  height: 3.2rem;
  border-radius: 999px;
  border: 3px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  background: #fff;
  box-sizing: border-box;
}
</style>
