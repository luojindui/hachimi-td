import { mulberry32, hashString } from '../rng'

/**
 * 词缀系统：为波次附加确定性修饰，缝合无尽爬坡/每日挑战/波次情报。
 * 全部词缀对玩家而言 = 更强的敌人 + 更高的赏金/挑战性。
 */

export interface AffixDef {
  id: string
  name: string
  desc: string
  /** 敌人移速乘数 */
  speedMul?: number
  /** 敌人护甲加值 */
  armorAdd?: number
  /** 敌人最大生命乘数 */
  hpMul?: number
  /** 每秒回复最大生命的比例 */
  regenPct?: number
  /** 击杀赏金乘数 */
  bountyMul?: number
  /** 减速效果减半 */
  frostResist?: boolean
}

export const AFFIX_LIST: readonly AffixDef[] = [
  { id: 'swift', name: '迅捷', desc: '敌人移速 +30%', speedMul: 1.3 },
  { id: 'steel', name: '钢壳', desc: '敌人护甲 +30', armorAdd: 30 },
  { id: 'regen', name: '再生', desc: '敌人每秒回复 1% 最大生命', regenPct: 0.01 },
  { id: 'rich', name: '财源', desc: '敌人赏金 +50%', bountyMul: 1.5 },
  { id: 'frostward', name: '冰抗', desc: '受到的减速效果减半', frostResist: true },
  { id: 'titan', name: '巨体', desc: '敌人生命 +20%', hpMul: 1.2 },
]

export function getAffix(id: string): AffixDef {
  const affix = AFFIX_LIST.find((a) => a.id === id)
  if (!affix) throw new Error(`未知词缀: ${id}`)
  return affix
}

/** 从池中确定性抽取 n 个不重复词缀 */
export function pickAffixes(seed: string, n: number): string[] {
  if (n <= 0) return []
  const rand = mulberry32(hashString(seed))
  const pool = [...AFFIX_LIST.map((a) => a.id)]
  const out: string[] = []
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rand() * pool.length) % pool.length
    out.push(pool.splice(idx, 1)[0]!)
  }
  return out
}
