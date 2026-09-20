import { listLevels } from './data/levels'
import { mulberry32 } from './rng'
import { getAffix, pickAffixes } from './data/affixes'

export interface DailyChallenge {
  /** YYYY-MM-DD */
  date: string
  levelId: string
  /** 敌人血量乘数（叠加在关卡自身之上） */
  hpMul: number
  startGold: number
  /** 限定规则：只能 N/R 宠物出战 */
  commonOnly: boolean
  catnipReward: number
  /** 当日词缀（全部波次生效） */
  affixes: string[]
  /** 当日任务（完成后各 +30） */
  tasks: { id: string; desc: string; reward: number }[]
  notes: string[]
}

/** 本地日期字符串（YYYY-MM-DD） */
export function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 每日挑战：按日期派生确定性规则（同一日期全玩家同一关）。
 */
export function getDailyChallenge(date: string): DailyChallenge {
  const seed = Number(date.replaceAll('-', ''))
  const rand = mulberry32(seed)
  const levels = listLevels()
  const levelId = levels[Math.floor(rand() * levels.length)]!.id
  const hpMul = 1.2 + Math.round(rand() * 30) / 100
  const startGold = 300 + Math.floor(rand() * 5) * 20
  const commonOnly = rand() < 0.5
  const affixes = pickAffixes(`${date}:affix`, commonOnly ? 2 : 1)

  const notes = [`敌人血量 ×${hpMul.toFixed(2)}`]
  if (commonOnly) notes.push('只能出战 N/R 宠物')
  for (const id of affixes) {
    notes.push(getAffix(id).desc)
  }
  notes.push(`初始资金 ${startGold}`)

  // 奖励随关卡分档：L1=100 ... L8=205
  const catnipReward = 100 + (Number(levelId) - 1) * 15

  // 任务制：3 条固定任务（通关/无漏怪/满编队），各 +30
  const tasks = [
    { id: 'clear', desc: '完成每日挑战', reward: 30 },
    { id: 'noLeak', desc: '全程不漏怪', reward: 30 },
    { id: 'fullLineup', desc: '编队 6 只宠物出战', reward: 30 },
  ]

  return {
    date,
    levelId,
    hpMul,
    startGold,
    commonOnly,
    affixes,
    catnipReward,
    tasks,
    notes,
  }
}
