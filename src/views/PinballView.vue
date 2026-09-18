<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import { PINBALL } from '@/game/pinball'
import { PinballMachine } from '@/game/pinball'
import { useProfileStore } from '@/stores/profile'
import { assets } from '@/render/registry'

const profile = useProfileStore()
const A = assets()

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvas')
const launchX = ref(PINBALL.WIDTH / 2)
const rolling = ref(false)
const rewardBanner = ref<{ total: number; jackpot: boolean } | null>(null)
const history = ref<number[]>([])

const canPlay = computed(() => profile.catnip >= PINBALL.COST && !rolling.value)

const machine = new PinballMachine(Date.now() >>> 0)
let rafId = 0
let lastTs = 0

function loop(ts: number): void {
  if (lastTs === 0) lastTs = ts
  const dt = Math.min((ts - lastTs) / 1000, 0.25)
  lastTs = ts
  machine.step(dt)
  draw()
  if (machine.rolling) {
    rafId = requestAnimationFrame(loop)
  } else if (machine.landed && machine.landedSlot !== null) {
    // 结算奖励
    const total = machine.totalReward ?? 0
    profile.addCatnip(total)
    history.value.unshift(total)
    history.value = history.value.slice(0, 5)
    const slot = machine.slots[machine.landedSlot]!
    rewardBanner.value = { total, jackpot: slot.jackpot }
    rolling.value = false
  } else {
    draw()
  }
}

function startRoll(): void {
  if (!canPlay.value) return
  profile.addCatnip(-PINBALL.COST)
  rolling.value = true
  rewardBanner.value = null
  machine.setLaunchX(launchX.value)
  machine.launch()
  lastTs = 0
  rafId = requestAnimationFrame(loop)
}

function draw(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== PINBALL.WIDTH * dpr) {
    canvas.width = PINBALL.WIDTH * dpr
    canvas.height = PINBALL.HEIGHT * dpr
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 背景
  const bgGrad = ctx.createLinearGradient(0, 0, 0, PINBALL.HEIGHT)
  bgGrad.addColorStop(0, '#32284a')
  bgGrad.addColorStop(1, '#1f1f30')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, PINBALL.WIDTH, PINBALL.HEIGHT)

  // 发射位置指示
  ctx.fillStyle = 'rgba(245,158,66,0.9)'
  ctx.beginPath()
  ctx.moveTo(launchX.value - 10, 8)
  ctx.lineTo(launchX.value + 10, 8)
  ctx.lineTo(launchX.value, 20)
  ctx.closePath()
  ctx.fill()

  // 钉子
  for (const peg of machine.pegs) {
    ctx.fillStyle = peg.gold ? '#ffd75e' : '#9aa3ad'
    ctx.beginPath()
    ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2)
    ctx.fill()
    if (peg.gold) {
      ctx.strokeStyle = 'rgba(255,215,94,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(peg.x, peg.y, peg.r + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // 奖励槽
  machine.slots.forEach((slot) => {
    const w = slot.x1 - slot.x0
    ctx.fillStyle = slot.jackpot ? '#e6a817' : '#4a5a8a'
    rr(ctx, slot.x0 + 2, PINBALL.SLOT_Y, w - 4, PINBALL.HEIGHT - PINBALL.SLOT_Y - 8, 6)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(slot.catnip), (slot.x0 + slot.x1) / 2, PINBALL.SLOT_Y + 20)
  })

  // 球（毛线球）
  const ball = machine.ball
  if (ball) {
    ctx.fillStyle = '#e07b7b'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, PINBALL.BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#c95f5f'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, PINBALL.BALL_R - 2, 0.4, 2.2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, PINBALL.BALL_R - 2, 3.4, 5.2)
    ctx.stroke()
  }
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* 发射位置选择：在画布顶部区域按下/拖动 */
const canvasEl = useTemplateRef<HTMLCanvasElement>('canvas')
let selecting = false

function onSelect(e: PointerEvent): void {
  const canvas = canvasEl.value
  if (!canvas || rolling.value) return
  const rect = canvas.getBoundingClientRect()
  const scale = PINBALL.WIDTH / rect.width
  const x = (e.clientX - rect.left) * scale
  if (e.clientY - rect.top < 70) {
    selecting = true
    launchX.value = Math.max(
      PINBALL.WALL + PINBALL.BALL_R,
      Math.min(PINBALL.WIDTH - PINBALL.WALL - PINBALL.BALL_R, x),
    )
    machine.setLaunchX(launchX.value)
  }
}

function onSelectMove(e: PointerEvent): void {
  if (!selecting) return
  onSelect(e)
}

function onSelectEnd(): void {
  selecting = false
}

onMounted(() => {
  draw() // 初始帧：让玩家进场就能看到钉板与奖励槽
  window.addEventListener('pointermove', onSelectMove)
  window.addEventListener('pointerup', onSelectEnd)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onSelectMove)
  window.removeEventListener('pointerup', onSelectEnd)
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <main class="pinball">
    <header class="head">
      <RouterLink to="/" class="btn btn-ghost back">‹ 主页</RouterLink>
      <h1 class="title">🎰 哈基米弹珠屋</h1>
      <span class="wallet">{{ A.icon('catnip') }} {{ profile.catnip }}</span>
    </header>

    <section class="machine card">
      <p class="tip">在顶部左右拖动选择发射位置 → 投球（{{ PINBALL.COST }}{{ A.icon('catnip') }}/球）</p>
      <div class="canvas-wrap">
        <canvas
          ref="canvas"
          class="pinball-canvas"
          @pointerdown="onSelect"
        ></canvas>
      </div>
      <div class="controls">
        <button class="btn btn-primary" :disabled="!canPlay" @click="startRoll">
          🎯 投球（{{ PINBALL.COST }}{{ A.icon('catnip') }}）
        </button>
      </div>
    </section>

    <section class="card info">
      <h2 class="block-title">奖励一览</h2>
      <p class="line">边缘窄槽 = 大奖 {{ PINBALL.JACKPOT_CATNIP }}{{ A.icon('catnip') }} · 中间槽 25~100 · 金钉 +{{ PINBALL.GOLD_PEG_BONUS }}</p>
      <p v-if="history.length" class="line">近期收获：{{ history.join(' / ') }} 🌿</p>
    </section>

    <!-- 奖励结算 -->
    <div v-if="rewardBanner" class="reward-mask" role="dialog" aria-modal="true">
      <div class="reward card" :class="{ jackpot: rewardBanner.jackpot }">
        <p class="reward-label">{{ rewardBanner.jackpot ? '🌟 大奖！' : '落入奖励槽' }}</p>
        <p class="reward-num">+{{ rewardBanner.total }} {{ A.icon('catnip') }}</p>
        <button class="btn btn-primary" @click="rewardBanner = null">继续</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.pinball {
  flex: 1;
  width: min(30rem, 100%);
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

.machine {
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.tip {
  margin: 0;
  font-size: 0.82rem;
  color: var(--c-ink-soft);
  text-align: center;
}

.canvas-wrap {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pinball-canvas {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
}

.controls {
  display: flex;
  justify-content: center;
}

.info {
  padding: 0.9rem;
}

.block-title {
  margin: 0 0 0.4rem;
  font-size: 1rem;
}

.line {
  margin: 0.2rem 0;
  font-size: 0.85rem;
  color: var(--c-ink-soft);
}

.reward-mask {
  position: fixed;
  inset: 0;
  background: rgba(30, 24, 48, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
  padding: 1rem;
}

.reward {
  padding: 1.4rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  align-items: center;
}

.reward.jackpot {
  border: 3px solid var(--c-rarity-ssr);
}

.reward-label {
  margin: 0;
  font-weight: 800;
  font-size: 1.1rem;
}

.reward-num {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--c-primary-deep);
}
</style>
