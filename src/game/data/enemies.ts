import type { EnemyDef } from '../types'

/**
 * 鼠贼军团（5 种）。
 * 基础数值按第 1 关尺度；各关通过 hpMul / speedMul 缩放。
 */
export const ENEMY_LIST: readonly EnemyDef[] = [
  {
    id: 'mouse',
    name: '鼠小兵',
    kind: 'normal',
    hp: 55,
    speed: 1.5,
    armor: 0,
    bounty: 8,
    leakDamage: 1,
    flying: false,
    boss: false,
    emoji: '🐭',
    tint: '#9aa0ad',
  },
  {
    id: 'swift',
    name: '疾风鼠',
    kind: 'fast',
    hp: 40,
    speed: 2.6,
    armor: 0,
    bounty: 10,
    leakDamage: 1,
    flying: false,
    boss: false,
    emoji: '🐭',
    tint: '#7ec8e3',
  },
  {
    id: 'shield',
    name: '盾甲鼠',
    kind: 'armored',
    hp: 95,
    speed: 1.1,
    armor: 50,
    bounty: 14,
    leakDamage: 1,
    flying: false,
    boss: false,
    emoji: '🐭',
    tint: '#8fa0b5',
  },
  {
    id: 'crow',
    name: '飞贼乌鸦',
    kind: 'air',
    hp: 55,
    speed: 1.9,
    armor: 0,
    bounty: 12,
    leakDamage: 1,
    flying: true,
    boss: false,
    emoji: '🐦‍⬛',
    tint: '#3c3c44',
  },
  {
    id: 'ratking',
    name: '鼠王',
    kind: 'boss',
    hp: 1250,
    speed: 0.9,
    armor: 12,
    bounty: 150,
    leakDamage: 5,
    flying: false,
    boss: true,
    emoji: '🐀',
    tint: '#6d5548',
  },
]

const ENEMY_MAP: ReadonlyMap<string, EnemyDef> = new Map(
  ENEMY_LIST.map((e) => [e.id, e]),
)

/** 按 id 取敌人定义，未知 id 抛错 */
export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMY_MAP.get(id)
  if (!enemy) throw new Error(`未知敌人 id: ${id}`)
  return enemy
}
