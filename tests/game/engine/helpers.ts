import { GameEngine } from '@/game/engine/GameEngine'
import type { LevelDef, PetDef, WaveDef } from '@/game/types'

export const STEP = 1 / 30

export function makePet(overrides: Partial<PetDef> = {}): PetDef {
  return {
    id: 't-pet',
    name: '测试宠',
    species: 'cat',
    rarity: 'N',
    role: 'shooter',
    targets: 'ground',
    cost: 100,
    attack: 30,
    attackInterval: 1,
    range: 1.9,
    desc: '',
    emoji: '🐱',
    tint: '#ffffff',
    projectile: '🐾',
    ...overrides,
  }
}

export function makeWave(entries: WaveDef['entries'], reward = 40): WaveDef {
  return { entries, reward }
}

export function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    name: '测试关',
    theme: 'yard',
    grid: { cols: 10, rows: 6 },
    // 直线路径：(-1,2) → (9,2)，长 10 格
    path: [
      { x: -1, y: 2 },
      { x: 9, y: 2 },
    ],
    buildSlots: [
      { x: 2, y: 1 },
      { x: 5, y: 1 },
      { x: 3, y: 3 },
    ],
    baseHp: 5,
    startGold: 500,
    hpMul: 1,
    speedMul: 1,
    waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }])],
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    ...overrides,
  }
}

export interface EngineFixture {
  level?: Partial<LevelDef>
  waves?: WaveDef[]
  lineup: PetDef[]
  starLevels?: Record<string, number>
  firstWaveCountdown?: number
  waveBreakSeconds?: number
  /** 随机源注入（三选一/暴击测试用） */
  rng?: () => number
  /** 是否启用波次开始的三选一（默认关闭，保持既有测试确定性） */
  drafts?: boolean
}

export function makeEngine(fixture: EngineFixture): GameEngine {
  const { level: levelOverrides, waves, rng, drafts, ...rest } = fixture
  const base = makeLevel(levelOverrides)
  const level: LevelDef = waves ? { ...base, waves } : base
  return new GameEngine({
    level,
    lineup: rest.lineup,
    starLevels: rest.starLevels,
    firstWaveCountdown: rest.firstWaveCountdown ?? 0.5,
    waveBreakSeconds: rest.waveBreakSeconds ?? 2,
    rng,
    draftsEnabled: drafts ?? false,
  })
}

/** 按固定逻辑步长推进引擎 */
export function advance(engine: GameEngine, seconds: number): void {
  const steps = Math.round(seconds / STEP)
  for (let i = 0; i < steps; i++) {
    engine.update(STEP)
  }
}
