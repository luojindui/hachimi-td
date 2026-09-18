/** 存档与养成相关的数据形状（store 层） */

export interface OwnedPet {
  id: string
  stars: number
  shards: number
}

export interface LevelRecord {
  stars: number
  cleared: boolean
}

export interface SaveDataV1 {
  version: number
  currencies: { catnip: number }
  pets: OwnedPet[]
  lineup: string[]
  levels: Record<string, LevelRecord>
  endless: { bestWave: number; claimedMilestones: number[] }
  gacha: {
    totalDraws: number
    srPity: number
    ssrPity: number
    firstTenDone: boolean
  }
  starMilestones: number[]
  /** 已购买的天赋节点 id */
  talents: string[]
  daily: { lastClaimDate: string }
  stats: { totalKills: number; battlesWon: number }
}
