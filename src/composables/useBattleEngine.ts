import { onBeforeUnmount, shallowRef } from 'vue'

import { ENGINE } from '@/game/data/balance'
import { GameEngine } from '@/game/engine/GameEngine'
import type { EngineOptions } from '@/game/engine/GameEngine'
import type { BattleSnapshot } from '@/game/types'

/**
 * 战斗循环组合式函数：
 * - 引擎实例为不透明对象，用 shallowRef 持有（不深度代理）
 * - rAF 驱动引擎 update，并把最新快照写入 shallowRef 供渲染层读取
 * - 游戏结束后停止推进，但保留最终快照供结算界面使用
 * - createOptions 工厂在每次 start 时调用（重开一局拿全新引擎）
 */
export function useBattleEngine(createOptions: () => EngineOptions) {
  const engine = shallowRef<GameEngine | null>(null)
  const snapshot = shallowRef<BattleSnapshot | null>(null)

  let rafId = 0
  let lastTs = 0

  function frame(ts: number): void {
    const e = engine.value
    if (!e) return
    if (lastTs === 0) lastTs = ts
    const dt = Math.min((ts - lastTs) / 1000, ENGINE.MAX_FRAME_DT)
    lastTs = ts

    e.update(dt)
    snapshot.value = e.getSnapshot()

    if (e.getOutcome() === 'ongoing') {
      rafId = requestAnimationFrame(frame)
    }
  }

  function start(): void {
    stop()
    const e = new GameEngine(createOptions())
    engine.value = e
    snapshot.value = e.getSnapshot()
    lastTs = 0
    rafId = requestAnimationFrame(frame)
  }

  function stop(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    lastTs = 0
    engine.value = null
    snapshot.value = null
  }

  onBeforeUnmount(stop)

  return { engine, snapshot, start, stop }
}
