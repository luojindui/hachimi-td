import type { LevelDef, WaveDef } from '../types'

import { ENDLESS } from './balance'

/* ===================== 普通关卡（1~8） ===================== */

const LEVEL_LIST: readonly LevelDef[] = [
  {
    id: '1',
    name: '后院保卫战',
    theme: 'yard',
    grid: { cols: 13, rows: 8 },
    path: [
      { x: -1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 6 },
      { x: 13, y: 6 },
    ],
    buildSlots: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 3 },
      { x: 2, y: 5 },
      { x: 6, y: 4 },
      { x: 6, y: 7 },
      { x: 8, y: 5 },
      { x: 10, y: 5 },
      { x: 7, y: 7 },
      { x: 9, y: 7 },
      { x: 11, y: 4 },
      { x: 11, y: 7 },
    ],
    baseHp: 20,
    startGold: 220,
    hpMul: 1,
    speedMul: 1,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      { entries: [{ enemyId: 'mouse', count: 5, interval: 1.3 }], reward: 40 },
      { entries: [{ enemyId: 'mouse', count: 8, interval: 1.1 }], reward: 42 },
      {
        entries: [
          { enemyId: 'mouse', count: 6, interval: 1.0 },
          { enemyId: 'swift', count: 2, interval: 1.0, delay: 4 },
        ],
        reward: 44,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 8, interval: 0.9 },
          { enemyId: 'swift', count: 3, interval: 1.2, delay: 3 },
        ],
        reward: 46,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 6, interval: 0.9 },
          { enemyId: 'swift', count: 4, interval: 1.0, delay: 3 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 7 },
        ],
        reward: 60,
      },
    ],
  },
  {
    id: '2',
    name: '楼道迷踪',
    theme: 'hall',
    grid: { cols: 13, rows: 9 },
    path: [
      { x: -1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 4 },
      { x: 7, y: 4 },
      { x: 7, y: 7 },
      { x: 13, y: 7 },
    ],
    buildSlots: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 2 },
      { x: 5, y: 3 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
      { x: 4, y: 7 },
      { x: 2, y: 5 },
      { x: 1, y: 7 },
      { x: 8, y: 6 },
      { x: 9, y: 5 },
      { x: 11, y: 6 },
      { x: 10, y: 8 },
      { x: 8, y: 3 },
    ],
    baseHp: 20,
    startGold: 250,
    hpMul: 1.15,
    speedMul: 1,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      { entries: [{ enemyId: 'mouse', count: 6, interval: 1.2 }], reward: 42 },
      {
        entries: [
          { enemyId: 'mouse', count: 6, interval: 1.0 },
          { enemyId: 'swift', count: 2, interval: 1.2, delay: 3 },
        ],
        reward: 44,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 6, interval: 1.0 },
          { enemyId: 'shield', count: 2, interval: 1.5, delay: 4 },
        ],
        reward: 46,
      },
      {
        entries: [
          { enemyId: 'swift', count: 6, interval: 0.9 },
          { enemyId: 'shield', count: 2, interval: 1.5, delay: 3 },
        ],
        reward: 48,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 8, interval: 0.9 },
          { enemyId: 'shield', count: 3, interval: 1.4, delay: 4 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 8 },
        ],
        reward: 62,
      },
    ],
  },
  {
    id: '3',
    name: '小区花园',
    theme: 'garden',
    grid: { cols: 14, rows: 9 },
    path: [
      { x: -1, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 1 },
      { x: 9, y: 1 },
      { x: 9, y: 7 },
      { x: 14, y: 7 },
    ],
    buildSlots: [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
      { x: 6, y: 3 },
      { x: 7, y: 2 },
      { x: 8, y: 3 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
      { x: 7, y: 6 },
      { x: 10, y: 5 },
      { x: 11, y: 3 },
      { x: 12, y: 6 },
      { x: 8, y: 8 },
    ],
    baseHp: 20,
    startGold: 280,
    hpMul: 1.3,
    speedMul: 1,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      { entries: [{ enemyId: 'mouse', count: 6, interval: 1.1 }], reward: 44 },
      {
        entries: [
          { enemyId: 'swift', count: 4, interval: 1.0 },
          { enemyId: 'mouse', count: 4, interval: 1.0, delay: 3 },
        ],
        reward: 46,
      },
      {
        entries: [
          { enemyId: 'shield', count: 3, interval: 1.4 },
          { enemyId: 'mouse', count: 4, interval: 1.0, delay: 3 },
        ],
        reward: 48,
      },
      {
        entries: [
          { enemyId: 'swift', count: 5, interval: 0.9 },
          { enemyId: 'shield', count: 2, interval: 1.5, delay: 4 },
        ],
        reward: 50,
      },
      {
        entries: [{ enemyId: 'mouse', count: 10, interval: 0.8 }],
        reward: 52,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 6, interval: 0.9 },
          { enemyId: 'shield', count: 3, interval: 1.4, delay: 4 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 8 },
        ],
        reward: 70,
      },
    ],
  },
  {
    id: '4',
    name: '街心公园',
    theme: 'park',
    grid: { cols: 14, rows: 9 },
    path: [
      { x: -1, y: 7 },
      { x: 3, y: 7 },
      { x: 3, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 6 },
      { x: 12, y: 6 },
      { x: 12, y: 3 },
      { x: 14, y: 3 },
    ],
    buildSlots: [
      { x: 1, y: 6 },
      { x: 2, y: 4 },
      { x: 4, y: 3 },
      { x: 5, y: 4 },
      { x: 6, y: 1 },
      { x: 7, y: 3 },
      { x: 9, y: 4 },
      { x: 10, y: 5 },
      { x: 9, y: 7 },
      { x: 11, y: 7 },
      { x: 13, y: 4 },
      { x: 10, y: 2 },
      { x: 4, y: 5 },
    ],
    baseHp: 20,
    startGold: 320,
    hpMul: 1.5,
    speedMul: 1,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      { entries: [{ enemyId: 'mouse', count: 6, interval: 1.1 }], reward: 46 },
      {
        entries: [{ enemyId: 'swift', count: 4, interval: 1.0 }],
        reward: 48,
      },
      {
        entries: [
          { enemyId: 'crow', count: 2, interval: 2.0 },
          { enemyId: 'mouse', count: 4, interval: 1.0, delay: 3 },
        ],
        reward: 50,
      },
      {
        entries: [
          { enemyId: 'crow', count: 3, interval: 1.8, elite: true },
          { enemyId: 'shield', count: 2, interval: 1.5, delay: 4 },
        ],
        reward: 52,
      },
      {
        entries: [
          { enemyId: 'swift', count: 6, interval: 0.8 },
          { enemyId: 'mouse', count: 6, interval: 0.9, delay: 3 },
        ],
        reward: 54,
      },
      {
        entries: [
          { enemyId: 'crow', count: 3, interval: 1.6 },
          { enemyId: 'shield', count: 2, interval: 1.5, delay: 4 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 9 },
        ],
        reward: 74,
      },
    ],
  },
  {
    id: '5',
    name: '夜晚小巷',
    theme: 'night',
    grid: { cols: 14, rows: 8 },
    path: [
      { x: -1, y: 1 },
      { x: 11, y: 1 },
      { x: 11, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 6 },
      { x: 13, y: 6 },
    ],
    buildSlots: [
      { x: 2, y: 2 },
      { x: 5, y: 2 },
      { x: 8, y: 2 },
      { x: 11, y: 4 },
      { x: 3, y: 4 },
      { x: 5, y: 4 },
      { x: 7, y: 4 },
      { x: 9, y: 4 },
      { x: 2, y: 5 },
      { x: 4, y: 5 },
      { x: 8, y: 5 },
      { x: 3, y: 7 },
      { x: 7, y: 7 },
      { x: 12, y: 2 },
    ],
    baseHp: 20,
    startGold: 360,
    hpMul: 1.65,
    speedMul: 1.05,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      {
        entries: [{ enemyId: 'swift', count: 5, interval: 1.0 }],
        reward: 48,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 8, interval: 0.9 },
          { enemyId: 'swift', count: 3, interval: 1.0, delay: 4 },
        ],
        reward: 50,
      },
      {
        entries: [{ enemyId: 'swift', count: 8, interval: 0.7 }],
        reward: 52,
      },
      {
        entries: [
          { enemyId: 'shield', count: 3, interval: 1.4, elite: true },
          { enemyId: 'swift', count: 4, interval: 0.9, delay: 4 },
        ],
        reward: 54,
      },
      {
        entries: [
          { enemyId: 'crow', count: 3, interval: 1.7 },
          { enemyId: 'swift', count: 4, interval: 0.9, delay: 4 },
        ],
        reward: 56,
      },
      {
        entries: [{ enemyId: 'mouse', count: 12, interval: 0.6 }],
        reward: 58,
      },
      {
        entries: [
          { enemyId: 'swift', count: 8, interval: 0.7 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 8 },
        ],
        reward: 76,
      },
    ],
  },
  {
    id: '6',
    name: '天台花园',
    theme: 'rooftop',
    grid: { cols: 13, rows: 9 },
    path: [
      { x: -1, y: 4 },
      { x: 2, y: 4 },
      { x: 2, y: 1 },
      { x: 10, y: 1 },
      { x: 10, y: 4 },
      { x: 5, y: 4 },
    ],
    buildSlots: [
      { x: 1, y: 3 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
      { x: 7, y: 2 },
      { x: 9, y: 2 },
      { x: 11, y: 2 },
      { x: 5, y: 3 },
      { x: 8, y: 3 },
      { x: 11, y: 4 },
      { x: 3, y: 5 },
      { x: 5, y: 5 },
      { x: 7, y: 5 },
      { x: 9, y: 5 },
      { x: 4, y: 6 },
      { x: 6, y: 7 },
    ],
    baseHp: 20,
    startGold: 400,
    hpMul: 1.7,
    speedMul: 1.05,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      {
        entries: [
          { enemyId: 'crow', count: 3, interval: 1.8 },
          { enemyId: 'mouse', count: 4, interval: 1.0, delay: 4 },
        ],
        reward: 50,
      },
      {
        entries: [{ enemyId: 'crow', count: 4, interval: 1.5 }],
        reward: 52,
      },
      {
        entries: [
          { enemyId: 'shield', count: 3, interval: 1.4 },
          { enemyId: 'crow', count: 3, interval: 1.6, delay: 4 },
        ],
        reward: 54,
      },
      {
        entries: [
          { enemyId: 'swift', count: 6, interval: 0.8 },
          { enemyId: 'crow', count: 3, interval: 1.6, delay: 4 },
        ],
        reward: 56,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 10, interval: 0.7 },
          { enemyId: 'crow', count: 4, interval: 1.5, delay: 4, elite: true },
        ],
        reward: 58,
      },
      {
        entries: [
          { enemyId: 'shield', count: 4, interval: 1.3 },
          { enemyId: 'crow', count: 4, interval: 1.5, delay: 4 },
        ],
        reward: 60,
      },
      {
        entries: [
          { enemyId: 'crow', count: 6, interval: 1.2 },
          { enemyId: 'shield', count: 2, interval: 1.4, delay: 4 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 9 },
        ],
        reward: 78,
      },
    ],
  },
  {
    id: '7',
    name: '粮仓外围',
    theme: 'granaryOut',
    grid: { cols: 14, rows: 9 },
    path: [
      { x: -1, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 8 },
      { x: 1, y: 8 },
    ],
    buildSlots: [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 5, y: 3 },
      { x: 4, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 4 },
      { x: 9, y: 4 },
      { x: 8, y: 6 },
      { x: 9, y: 7 },
      { x: 11, y: 7 },
      { x: 11, y: 5 },
      { x: 2, y: 7 },
      { x: 3, y: 6 },
      { x: 7, y: 7 },
    ],
    baseHp: 20,
    startGold: 450,
    hpMul: 2.15,
    speedMul: 1.05,
    firstClearCatnip: 300,
    repeatClearCatnip: 60,
    waves: [
      {
        entries: [
          { enemyId: 'shield', count: 4, interval: 1.3 },
          { enemyId: 'mouse', count: 4, interval: 1.0, delay: 4 },
        ],
        reward: 52,
      },
      {
        entries: [{ enemyId: 'shield', count: 6, interval: 1.2 }],
        reward: 54,
      },
      {
        entries: [
          { enemyId: 'swift', count: 6, interval: 0.8 },
          { enemyId: 'shield', count: 3, interval: 1.3, delay: 4 },
        ],
        reward: 56,
      },
      {
        entries: [
          { enemyId: 'crow', count: 4, interval: 1.5 },
          { enemyId: 'shield', count: 3, interval: 1.3, delay: 4, elite: true },
        ],
        reward: 58,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 12, interval: 0.6 },
          { enemyId: 'shield', count: 2, interval: 1.3, delay: 5 },
        ],
        reward: 60,
      },
      {
        entries: [
          { enemyId: 'swift', count: 8, interval: 0.7 },
          { enemyId: 'shield', count: 4, interval: 1.2, delay: 4 },
        ],
        reward: 62,
      },
      {
        entries: [
          { enemyId: 'shield', count: 6, interval: 1.1 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 9 },
        ],
        reward: 80,
      },
    ],
  },
  {
    id: '8',
    name: '粮仓大殿',
    theme: 'granary',
    grid: { cols: 15, rows: 10 },
    path: [
      { x: -1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 4 },
      { x: 9, y: 4 },
      { x: 9, y: 1 },
      { x: 13, y: 1 },
      { x: 13, y: 8 },
      { x: 1, y: 8 },
    ],
    buildSlots: [
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 5 },
      { x: 5, y: 3 },
      { x: 6, y: 2 },
      { x: 7, y: 3 },
      { x: 8, y: 2 },
      { x: 10, y: 2 },
      { x: 11, y: 3 },
      { x: 12, y: 2 },
      { x: 11, y: 5 },
      { x: 12, y: 6 },
      { x: 11, y: 7 },
      { x: 8, y: 7 },
      { x: 6, y: 7 },
      { x: 4, y: 6 },
      { x: 2, y: 6 },
      { x: 3, y: 7 },
      { x: 14, y: 3 },
    ],
    baseHp: 15,
    startGold: 500,
    hpMul: 2.25,
    speedMul: 1.1,
    firstClearCatnip: 500,
    repeatClearCatnip: 100,
    waves: [
      {
        entries: [{ enemyId: 'mouse', count: 8, interval: 0.8 }],
        reward: 54,
      },
      {
        entries: [
          { enemyId: 'swift', count: 6, interval: 0.8 },
          { enemyId: 'crow', count: 3, interval: 1.6, delay: 4 },
        ],
        reward: 56,
      },
      {
        entries: [{ enemyId: 'shield', count: 5, interval: 1.2 }],
        reward: 58,
      },
      {
        entries: [
          { enemyId: 'mouse', count: 12, interval: 0.6 },
          { enemyId: 'crow', count: 4, interval: 1.5, delay: 4 },
        ],
        reward: 60,
      },
      {
        entries: [{ enemyId: 'swift', count: 10, interval: 0.6 }],
        reward: 62,
      },
      {
        entries: [
          { enemyId: 'shield', count: 5, interval: 1.2, elite: true },
          { enemyId: 'crow', count: 5, interval: 1.4, delay: 4 },
        ],
        reward: 64,
      },
      {
        entries: [{ enemyId: 'mouse', count: 15, interval: 0.5 }],
        reward: 66,
      },
      {
        entries: [
          { enemyId: 'shield', count: 4, interval: 1.2 },
          { enemyId: 'swift', count: 6, interval: 0.7, delay: 3, elite: true },
          { enemyId: 'crow', count: 4, interval: 1.4, delay: 5 },
          { enemyId: 'ratking', count: 1, interval: 1, delay: 10 },
        ],
        reward: 90,
      },
    ],
  },
]

/* ===================== 无尽模式 ===================== */

const ENDLESS_LEVEL: LevelDef = {
  id: 'endless',
  name: '星空粮仓',
  theme: 'endless',
  endless: true,
  grid: { cols: 16, rows: 10 },
  path: [
    { x: -1, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 8 },
    { x: 12, y: 8 },
    { x: 12, y: 4 },
    { x: 16, y: 4 },
  ],
  buildSlots: [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 3 },
    { x: 6, y: 4 },
    { x: 7, y: 5 },
    { x: 8, y: 6 },
    { x: 10, y: 6 },
    { x: 9, y: 7 },
    { x: 11, y: 7 },
    { x: 13, y: 5 },
    { x: 14, y: 3 },
    { x: 13, y: 7 },
    { x: 15, y: 5 },
    { x: 2, y: 3 },
    { x: 3, y: 5 },
    { x: 2, y: 7 },
    { x: 1, y: 6 },
  ],
  baseHp: 20,
  startGold: 400,
  hpMul: 1,
  speedMul: 1,
  firstClearCatnip: 0,
  repeatClearCatnip: 0,
  waves: [],
}

/** 无尽模式按波数生成波次（纯函数，引擎每波调用） */
export function getEndlessWave(wave: number): WaveDef {
  if (!Number.isInteger(wave) || wave < 1) {
    throw new Error(`无尽波次非法: ${wave}`)
  }
  const interval = Math.max(0.45, 1.2 - wave * 0.03)
  const elite = wave >= 12
  const entries: WaveDef['entries'] = [
    {
      enemyId: 'mouse',
      count: Math.min(60, 5 + Math.floor(wave * 1.1)),
      interval,
      elite: elite && wave % 2 === 0,
    },
  ]
  if (wave >= 2) {
    entries.push({
      enemyId: 'swift',
      count: Math.min(25, Math.floor(wave * 0.8)),
      interval: interval + 0.1,
      delay: 3,
      elite: elite,
    })
  }
  if (wave >= 3) {
    entries.push({
      enemyId: 'crow',
      count: Math.min(20, Math.floor(wave * 0.5)),
      interval: interval + 0.2,
      delay: 5,
    })
  }
  if (wave >= 4) {
    entries.push({
      enemyId: 'shield',
      count: Math.min(20, Math.floor(wave * 0.45)),
      interval: interval + 0.3,
      delay: 4,
      elite: elite,
    })
  }
  if (wave % ENDLESS.RAMP_EVERY === 0) {
    entries.push({
      enemyId: 'ratking',
      count: 1 + Math.floor(wave / 20),
      interval: 3,
      delay: 6,
    })
  }
  const jumps = Math.floor((wave - 1) / ENDLESS.RAMP_EVERY)
  return {
    entries,
    // 奖励随难度跳同步放大，保证后期收入能补塔
    reward: Math.round((40 + wave * 2) * Math.pow(1.22, jumps)),
    hpMul: Math.pow(ENDLESS.RAMP_HP_MULT, jumps),
    speedMul: 1 + ENDLESS.RAMP_SPEED_PER_JUMP * jumps,
  }
}

/* ===================== 查询 ===================== */

const LEVEL_MAP: ReadonlyMap<string, LevelDef> = new Map(
  LEVEL_LIST.map((lv) => [lv.id, lv]),
)

/** 普通关卡列表（顺序） */
export function listLevels(): readonly LevelDef[] {
  return LEVEL_LIST
}

/** 无尽关卡定义 */
export function getEndlessLevel(): LevelDef {
  return ENDLESS_LEVEL
}

/** 按 id 取关卡（'1'..'8' 或 'endless'），未知 id 抛错 */
export function getLevel(id: string): LevelDef {
  if (id === 'endless') return ENDLESS_LEVEL
  const level = LEVEL_MAP.get(id)
  if (!level) throw new Error(`未知关卡 id: ${id}`)
  return level
}
