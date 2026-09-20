<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getPet } from '@/game/data/pets'
import { getEnemy } from '@/game/data/enemies'
import { getAffix } from '@/game/data/affixes'
import { LINEUP_SIZE } from '@/game/data/balance'
import { getLevel } from '@/game/data/levels'
import { getDailyChallenge, todayStr } from '@/game/daily'
import { starsFor } from '@/game/engine/GameEngine'
import type { LevelDef } from '@/game/types'
import { useProfileStore } from '@/stores/profile'
import { useBattleEngine } from '@/composables/useBattleEngine'
import { useTowerDrag } from '@/composables/useTowerDrag'
import { assets } from '@/render/registry'
import BattleCanvas from '@/components/battle/BattleCanvas.vue'
import BattleHud from '@/components/battle/BattleHud.vue'
import DraftModal from '@/components/battle/DraftModal.vue'
import LineupPicker from '@/components/battle/LineupPicker.vue'
import ResultModal from '@/components/battle/ResultModal.vue'
import TowerMenu from '@/components/battle/TowerMenu.vue'

const route = useRoute()
const router = useRouter()
const profile = useProfileStore()
const A = assets()

/* ---------- 关卡解析（路由参数在挂载期固定） ---------- */

const isDaily =
  route.params.levelId === 'daily' || route.query.daily === '1'
const challenge = isDaily ? getDailyChallenge(todayStr()) : null

/** 战前情报：本关敌人构成（去重聚合） */
const enemyPreview = computed(() => {
  const A = assets()
  const counter = new Map<string, { emoji: string; name: string; count: number; boss: boolean }>()
  for (const wave of level.waves) {
    for (const entry of wave.entries) {
      const def = getEnemy(entry.enemyId)
      const cur = counter.get(entry.enemyId) ?? {
        emoji: A.enemyVisual(entry.enemyId).emoji,
        name: def.name,
        count: 0,
        boss: def.name.includes('鼠王'),
      }
      cur.count += entry.count
      counter.set(entry.enemyId, cur)
    }
  }
  return [...counter.values()]
})

function resolveLevel(): LevelDef {
  try {
    if (isDaily && challenge) {
      // 每日挑战：在原关卡上叠加血量与初始资金修正
      const base = getLevel(challenge.levelId)
      return {
        ...base,
        hpMul: base.hpMul * challenge.hpMul,
        startGold: challenge.startGold,
      }
    }
    return getLevel(String(route.params.levelId ?? '1'))
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
  if (isDaily && challenge?.commonOnly) {
    const pet = pickedIds.value.map((id) => getPet(id))
    if (pet.some((p) => p.rarity === 'SR' || p.rarity === 'SSR')) return
  }
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

/** 每日挑战 N/R 限定（规则公示与执行一致） */
const dailyRarities = computed(() =>
  isDaily && challenge?.commonOnly ? (['N', 'R'] as const) : undefined,
)

const battle = useBattleEngine(() => ({
  level,
  lineup: lineupPetDefs(),
  starLevels: starLevels(),
  talentBonus: profile.talentBonus,
  bondBonus: profile.bondBonus,
  affixes: isDaily ? challenge?.affixes : undefined,
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

/** 点击宝箱：开启并获得小鱼干 */
function onCrateClick(cell: { x: number; y: number } | null): void {
  if (!cell || !engine.value) return
  const id = engine.value.crateAt(cell.x, cell.y)
  if (id !== null) engine.value.openCrate(id)
}

function placePet(petId: string): void {
  const e = engine.value
  if (!e || selectedSlot.value === null) return
  try {
    e.placeTower(selectedSlot.value, petId)
  } catch (err) {
    console.warn('[battle] 放置失败', err)
  }
  selectedSlot.value = null
}

function upgradeSelected(branch?: 'quick' | 'heavy'): void {
  const e = engine.value
  if (!e || selectedSlot.value === null) return
  try {
    e.upgradeTower(selectedSlot.value, branch)
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

/** 三选一：选择一项强化 */
function pickDraftOption(index: number): void {
  try {
    engine.value?.pickDraft(index)
  } catch (err) {
    console.warn('[draft] 选择失败', err)
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

const selectedRangeRing = computed(() => {
  void snapshot.value
  if (selectedSlot.value === null || !engine.value) return null
  const tower = snapshot.value?.towers.find((t) => t.slotIndex === selectedSlot.value)
  const stats = engine.value.towerStats(selectedSlot.value)
  if (!tower || !stats) return null
  return { x: tower.x * 64 + 32, y: tower.y * 64 + 32, r: stats.range * 64 }
})

const selectedTowerStats = computed(() => {
  // 依赖快照：升级/出售/金币变化都会触发重算（引擎内部变更 Vue 无法追踪）
  void snapshot.value
  if (selectedSlot.value === null || !engine.value) return null
  return engine.value.towerStats(selectedSlot.value)
})

const upgradeCost = computed(() => {
  void snapshot.value
  if (selectedSlot.value === null || !engine.value) return null
  return engine.value.upgradeCost(selectedSlot.value)
})

const sellValue = computed(() => {
  void snapshot.value
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
  /** 通关奖励部分（首通/重复） */
  clearReward?: number
  /** 星数里程碑部分 */
  milestoneReward?: number
  /** 每日任务完成情况 */
  tasksDone?: { clear: boolean; noLeak: boolean; fullLineup: boolean }
  /** 解锁庆祝文案 */
  celebrate?: string
  /** 失败针对性建议 */
  tip?: string
} | null>(null)

const nextLevelLabel = computed(() => {
  if (isDaily || isEndless) return ''
  const unlocked = profile.unlockedLevelIds
  const idx = unlocked.indexOf(String(route.params.levelId))
  if (idx >= 0 && idx + 1 < unlocked.length) return '下一关'
  return ''
})

/** 任一模态弹层打开时，战斗主体转为 inert（阻断键盘穿透）。
 * 三选一排除：战斗冻结期间允许继续放塔/调整阵型（策略性等待） */
const anyModalOpen = computed(
  () => settlement.value !== null || confirmExit.value,
)

watch(
  () => snapshot.value?.outcome,
  (outcome) => {
    if (!outcome || outcome === 'ongoing' || settlement.value) return
    const snap = snapshot.value!
    let catnipGained = 0

    if (isDaily) {
      // 每日挑战：胜利才算完成并领取奖励（一天一次）
      if (outcome === 'victory') {
        catnipGained = profile.claimDaily(todayStr(), challenge?.catnipReward ?? 150)
        const noLeak = snap.baseHp === snap.baseMaxHp
        const fullLineup = pickedIds.value.length === LINEUP_SIZE
        const taskBonus = (noLeak ? 30 : 0) + (fullLineup ? 30 : 0)
        if (taskBonus > 0) {
          profile.addCatnip(taskBonus)
          catnipGained += taskBonus
        }
      }
      // 任务评估：无漏怪 / 满编队
      const noLeak = snap.baseHp === snap.baseMaxHp
      const fullLineup = pickedIds.value.length === LINEUP_SIZE
      settlement.value = {
        outcome,
        stars: 0,
        catnipGained,
        kills: snap.kills,
        tasksDone: { clear: outcome === 'victory', noLeak, fullLineup },
      }
    } else if (isEndless) {
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
      const endlessWasLocked = !profile.endlessUnlocked
      const result = profile.completeLevel(level.id, stars, snap.kills)
      catnipGained = result.catnipGained
      settlement.value = {
        outcome,
        stars,
        catnipGained,
        kills: snap.kills,
        clearReward: result.clearReward,
        milestoneReward: result.milestoneReward,
        celebrate:
          level.id === '8' && endlessWasLocked ? '🔓 无尽模式已解锁！' : undefined,
      }
    } else {
      // 失败建议：按本关敌人构成给出针对性提示
      const hasFlying = level.waves.some((w) =>
        w.entries.some((e) => getEnemy(e.enemyId).flying),
      )
      const hasArmored = level.waves.some((w) =>
        w.entries.some((e) => getEnemy(e.enemyId).armor >= 30),
      )
      let tip = '尝试把核心宠物升到 Lv3，并合理利用三选一强化'
      if (hasFlying && !lineupPetDefs().some((p) => p.targets !== 'ground')) {
        tip = '本关有飞行单位——编队中加入对空宠物（如狸花猫）'
      } else if (hasArmored) {
        tip = '本关装甲较高——重击分支或破甲类强化更有效'
      } else if (snap.baseHp <= 3) {
        tip = '差一点点！尝试在路径前段布置减速宠物争取输出时间'
      }
      settlement.value = { outcome, stars: 0, catnipGained: 0, kills: snap.kills, tip }
    }
  },
)

function retry(): void {
  settlement.value = null
  selectedSlot.value = null
  battle.start()
}

function goNextLevel(): void {
  const unlocked = profile.unlockedLevelIds
  const idx = unlocked.indexOf(String(route.params.levelId))
  if (idx >= 0 && idx + 1 < unlocked.length) {
    router.push(`/battle/${unlocked[idx + 1]}`)
  } else {
    router.push('/')
  }
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
      <!-- 战前情报：本关敌人构成 -->
      <div v-if="enemyPreview.length" class="card intel">
        <h3 class="intel-title">🔎 本关敌人情报</h3>
        <div v-if="isDaily && challenge" class="intel-affixes">
          <span v-for="a in challenge.affixes" :key="a" class="affix-tag">{{ getAffix(a).name }}：{{ getAffix(a).desc }}</span>
        </div>
        <div class="intel-row">
          <span v-for="e in enemyPreview" :key="e.name" class="intel-item">
            <span class="intel-emoji">{{ e.emoji }}</span>
            {{ e.name }} ×{{ e.count }}
            <span v-if="e.boss" class="intel-boss">BOSS</span>
          </span>
        </div>
      </div>

      <LineupPicker
        v-model="pickedIds"
        :owned="profile.pets"
        :allowed-rarities="dailyRarities"
      />
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
      <div class="battle-body" :inert="anyModalOpen || undefined">
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
        :range-ring="selectedRangeRing"
        @slot-click="onSlotClick"
        @crate-click="onCrateClick"
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

      </div>

      <!-- 三选一强化（战斗暂停） -->
      <DraftModal
        v-if="snapshot.draft"
        :draft="snapshot.draft"
        @pick="pickDraftOption"
      />

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
        :next-label="nextLevelLabel"
        @retry="retry"
        @home="goHome"
        @next="goNextLevel"
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

.battle-body {
  display: contents;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}

/* 三选一强化 */
.draft-mask {
  position: fixed;
  inset: 0;
  background: rgba(58, 44, 90, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
  padding: 1rem;
}

.draft {
  width: min(34rem, 100%);
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  border: 2px solid var(--c-rarity-sr);
}

.draft-title {
  margin: 0;
  text-align: center;
  font-size: 1.2rem;
  color: var(--c-rarity-sr);
}

.draft-tip {
  margin: 0;
  text-align: center;
  color: var(--c-ink-soft);
  font-size: 0.85rem;
}

.draft-cards {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
}

.draft-option {
  flex: 1 1 8rem;
  max-width: 10rem;
  min-height: 6.4rem;
  border-radius: var(--radius-md);
  border: 2px solid var(--c-rarity-sr);
  background: linear-gradient(180deg, #f6efff, #fffdf8);
  padding: 0.7rem 0.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  animation: draft-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: transform 0.1s ease;
}

.draft-option:hover {
  transform: translateY(-3px);
}

.draft-option:active {
  transform: scale(0.96);
}

@keyframes draft-pop {
  from {
    transform: translateY(14px) scale(0.85);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.draft-opt-name {
  font-weight: 800;
  font-size: 0.95rem;
  color: var(--c-primary-deep);
}

.draft-opt-desc {
  font-size: 0.8rem;
  color: var(--c-ink);
  text-align: center;
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

.affix-tag {
  display: inline-block;
  margin: 0 0.4rem 0.2rem 0;
  padding: 1px 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #b0567a;
  background: rgba(176, 86, 122, 0.1);
  border-radius: 4px;
}
</style>
<style scoped>
.intel {
  padding: 0.6rem 0.8rem;
}

.intel-title {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
}

.intel-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.intel-item {
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.intel-emoji {
  font-size: 1rem;
}

.intel-boss {
  font-size: 0.62rem;
  font-weight: 800;
  color: #e04b4b;
  border: 1px solid #e04b4b;
  border-radius: 4px;
  padding: 0 3px;
}

.affix-tag {
  display: inline-block;
  margin: 0 0.4rem 0.2rem 0;
  padding: 1px 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #b0567a;
  background: rgba(176, 86, 122, 0.1);
  border-radius: 4px;
}
</style>