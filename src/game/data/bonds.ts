import type { PetDef } from '../../game/types'

/**
 * 图鉴收集羁绊：按"已拥有宠物"自动激活的全局加成。
 * 纯数据驱动 —— 新增羁绊只需追加条目。
 */

export type BondRequirement =
  | { kind: 'species'; value: PetDef['species']; count: number }
  | { kind: 'role'; value: PetDef['role']; count: number }
  | { kind: 'rarity'; value: PetDef['rarity']; count: number }
  | { kind: 'all'; count: number }

export interface BondDef {
  id: string
  name: string
  desc: string
  require: BondRequirement
  effect: {
    /** 全体攻击加成（比例） */
    globalAttack?: number
    /** 击杀赏金加成（比例） */
    gold?: number
    /** 粮仓上限加值 */
    baseHp?: number
    /** 冰系宠物攻击加成（比例，仅 role==='ice' 生效） */
    iceAttack?: number
  }
}

export const BOND_LIST: readonly BondDef[] = [
  {
    id: 'cat-family',
    name: '猫猫家族',
    desc: '拥有 8 只猫：全体攻击 +3%',
    require: { kind: 'species', value: 'cat', count: 8 },
    effect: { globalAttack: 0.03 },
  },
  {
    id: 'dog-legion',
    name: '狗狗军团',
    desc: '拥有 6 只狗：全体攻击 +3%',
    require: { kind: 'species', value: 'dog', count: 6 },
    effect: { globalAttack: 0.03 },
  },
  {
    id: 'n-rookie',
    name: '新兵连',
    desc: '拥有 6 只 N 宠：粮仓上限 +2',
    require: { kind: 'rarity', value: 'N', count: 6 },
    effect: { baseHp: 2 },
  },
  {
    id: 'ice-squad',
    name: '冰雪小队',
    desc: '拥有 4 只冰系：冰系攻击 +12%',
    require: { kind: 'role', value: 'ice', count: 4 },
    effect: { iceAttack: 0.12 },
  },
  {
    id: 'antiair-wing',
    name: '防空分队',
    desc: '拥有 3 只对空：全体攻击 +2%',
    require: { kind: 'role', value: 'antiair', count: 3 },
    effect: { globalAttack: 0.02 },
  },
  {
    id: 'collector',
    name: '哈基米收藏家',
    desc: '集齐全部宠物：击杀赏金 +10%',
    require: { kind: 'all', count: 21 },
    effect: { gold: 0.1 },
  },
]

export interface BondBonus {
  globalAttack: number
  gold: number
  baseHp: number
  iceAttack: number
  /** 已激活的羁绊 id */
  active: string[]
}

function meet(require: BondRequirement, owned: PetDef[]): boolean {
  if (require.kind === 'all') return owned.length >= require.count
  const count = owned.filter((p) => {
    if (require.kind === 'species') return p.species === require.value
    if (require.kind === 'role') return p.role === require.value
    return p.rarity === require.value
  }).length
  return count >= require.count
}

/** 评估当前拥有集合下激活的羁绊与聚合加成 */
export function evaluateBonds(ownedPets: PetDef[]): BondBonus {
  const bonus: BondBonus = {
    globalAttack: 0,
    gold: 0,
    baseHp: 0,
    iceAttack: 0,
    active: [],
  }
  for (const bond of BOND_LIST) {
    if (!meet(bond.require, ownedPets)) continue
    bonus.active.push(bond.id)
    if (bond.effect.globalAttack) bonus.globalAttack += bond.effect.globalAttack
    if (bond.effect.gold) bonus.gold += bond.effect.gold
    if (bond.effect.baseHp) bonus.baseHp += bond.effect.baseHp
    if (bond.effect.iceAttack) bonus.iceAttack += bond.effect.iceAttack
  }
  return bonus
}
