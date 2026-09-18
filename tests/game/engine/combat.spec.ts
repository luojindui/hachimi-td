import { describe, expect, it } from 'vitest'

import { makeEngine, makePet, makeWave, advance } from './helpers'

/** 单发测试炮：攻击 30、间隔 10s、射程 2.5，验证护甲公式 */
const sniper30 = makePet({ id: 't-armor', attack: 30, attackInterval: 10, range: 2.5 })

/** 单发冰系测试炮：减速 0.5 / 1.5s */
const iceGun = makePet({
  id: 't-ice',
  attack: 5,
  attackInterval: 10,
  range: 2.5,
  slow: { factor: 0.5, duration: 1.5 },
})

/** 单发溅射测试炮：攻击 60、溅射 1.1 */
const cannon = makePet({
  id: 't-cannon',
  attack: 60,
  attackInterval: 10,
  range: 2.5,
  splash: 1.1,
})

/** 一击必杀测试射手（攻击 100） */
const sniper100 = makePet({ id: 't-sniper', attack: 100, attackInterval: 100, range: 2.5 })

describe('伤害与护甲', () => {
  it('护甲减伤：30 攻击打 50 护甲 → 实伤 20', () => {
    const engine = makeEngine({
      lineup: [sniper30],
      waves: [makeWave([{ enemyId: 'shield', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, sniper30.id) // slot (5,1)
    // 盾甲鼠 95hp；命中一次后 95 - 30*100/150 = 75
    advance(engine, 5)
    const snap = engine.getSnapshot()
    expect(snap.enemies.length).toBe(1)
    expect(snap.enemies[0]!.hp).toBeCloseTo(75, 0)
    expect(snap.kills).toBe(0)
  })
})

describe('减速效果', () => {
  it('命中施加减速标记，超时后解除', () => {
    const engine = makeEngine({
      lineup: [iceGun],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, iceGun.id)
    advance(engine, 4)
    expect(engine.getSnapshot().enemies[0]!.slowed).toBe(true)
    advance(engine, 2) // 1.5s 减速已过期，间隔 10s 不会补减速
    expect(engine.getSnapshot().enemies[0]!.slowed).toBe(false)
  })

  it('减速期间移动速度按 factor 降低', () => {
    const engine = makeEngine({
      lineup: [iceGun],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, iceGun.id)
    advance(engine, 3) // 命中发生在约 2.6s，此时处于减速中
    const p1 = engine.getSnapshot().enemies[0]!.x
    advance(engine, 1) // 窗口 [3.0, 4.0] 完全在减速期（约 2.6~4.1s）内
    const p2 = engine.getSnapshot().enemies[0]!.x
    expect(p2 - p1).toBeGreaterThan(0.55)
    expect(p2 - p1).toBeLessThan(0.95)
  })
})

describe('溅射伤害', () => {
  it('主目标全额、溅射目标 60%', () => {
    const engine = makeEngine({
      lineup: [cannon],
      waves: [
        // 间隔 0.5s → 两鼠相距 0.75 格，同在溅射半径内
        makeWave([{ enemyId: 'mouse', count: 2, interval: 0.5 }], 0),
      ],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, cannon.id)
    advance(engine, 5.5)
    const snap = engine.getSnapshot()
    // 主目标 55hp 被 60 攻击直接击杀；副目标 55 - 60*0.6 = 19
    expect(snap.enemies.length).toBe(1)
    expect(snap.enemies[0]!.hp).toBeCloseTo(19, 1)
    expect(snap.kills).toBe(1)
  })
})

describe('赏金结算', () => {
  it('赏金光环 ×1.3 + 固定加成 +2', () => {
    const fortune = makePet({
      id: 't-fortune',
      attack: 18,
      attackInterval: 100,
      range: 2.0,
      aura: { kind: 'gold', value: 0.3, radius: 2.5 },
    })
    const spotty = makePet({
      id: 't-spotty',
      attack: 14,
      attackInterval: 100,
      range: 2.0,
      passive: { kind: 'bountyFlat', value: 2 },
    })
    const engine = makeEngine({
      lineup: [sniper100, fortune, spotty],
      level: {
        startGold: 500,
        buildSlots: [
          { x: 5, y: 1 },
          { x: 4, y: 3 },
          { x: 0, y: 0 },
        ],
      },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(0, sniper100.id)
    engine.placeTower(1, fortune.id)
    engine.placeTower(2, spotty.id)
    const before = engine.getGold()
    // 击杀点约 (3.4, 2)，距光环塔 (4,3) 约 1.3 < 2.5 → 8×1.3=10.4→10，+2 = 12
    advance(engine, 5)
    expect(engine.getGold()).toBe(before + 12)
  })

  it('光晕外击杀不吃赏金光环', () => {
    const fortune = makePet({
      id: 't-fortune-far',
      attack: 18,
      attackInterval: 100,
      range: 2.0,
      aura: { kind: 'gold', value: 0.3, radius: 2.5 },
    })
    const engine = makeEngine({
      lineup: [sniper100, fortune],
      level: {
        startGold: 500,
        buildSlots: [
          { x: 5, y: 1 },
          { x: 0, y: 5 },
        ],
      },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(0, sniper100.id)
    engine.placeTower(1, fortune.id)
    const before = engine.getGold()
    advance(engine, 5)
    // 击杀点距光环塔 > 2.5 → 只吃基础赏金 8
    expect(engine.getGold()).toBe(before + 8)
  })
})

describe('鼠王嚎叫', () => {
  it('嚎叫后小怪获得加速标记', () => {
    const engine = makeEngine({
      lineup: [sniper30],
      level: { baseHp: 100 },
      waves: [
        makeWave(
          [
            { enemyId: 'ratking', count: 1, interval: 1 },
            { enemyId: 'mouse', count: 6, interval: 5, delay: 1 },
          ],
          0,
        ),
      ],
      firstWaveCountdown: 0.1,
    })
    // 无塔（不放置），全部漏怪；baseHp 100 撑得住
    advance(engine, 10)
    const snap = engine.getSnapshot()
    expect(snap.enemies.some((e) => !e.boss && e.howled)).toBe(true)
  })
})

describe('PRD 硬规则补充覆盖', () => {
  it('地面炮的溅射不打飞行敌人', () => {
    // 乌鸦与鼠同波出生（乌鸦快 0.4 格/秒），地面炮打鼠时乌鸦在溅射半径内
    const engine = makeEngine({
      lineup: [cannon],
      level: { baseHp: 100 },
      waves: [
        makeWave(
          [
            { enemyId: 'mouse', count: 1, interval: 1 },
            { enemyId: 'crow', count: 1, interval: 1 },
          ],
          0,
        ),
      ],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(1, cannon.id)
    advance(engine, 5)
    const snap = engine.getSnapshot()
    // 鼠被主目标击杀；乌鸦若被溅射到会掉血/死亡 —— 必须满血
    expect(snap.kills).toBe(1)
    const crows = snap.enemies.filter((e) => e.flying)
    expect(crows.length).toBe(1)
    expect(crows[0]!.hp).toBe(crows[0]!.maxHp)
    expect(crows[0]!.slowed).toBe(false)
  })

  it('减速不叠加：取最强减速', () => {
    const weakIce = makePet({
      id: 't-ice-weak',
      attack: 0,
      attackInterval: 100,
      range: 2.5,
      slow: { factor: 0.7, duration: 30 },
    })
    const strongIce = makePet({
      id: 't-ice-strong',
      attack: 0,
      attackInterval: 100,
      range: 2.5,
      slow: { factor: 0.4, duration: 30 },
    })
    const engine = makeEngine({
      lineup: [weakIce, strongIce],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.placeTower(0, weakIce.id) // slot (2,1) 更早命中（弱减速 0.7 先生效）
    engine.placeTower(1, strongIce.id) // slot (5,1) 后命中（强减速 0.4 应接管）
    advance(engine, 6)

    const enemies = engine.getSnapshot().enemies
    expect(enemies.length).toBe(1) // 双塔攻击均为 0，敌人不会死
    const p1 = enemies[0]!.x
    advance(engine, 1)
    const p2 = engine.getSnapshot().enemies[0]!.x
    // 命中后 1 秒位移 ≈ 1.5 × 0.4 = 0.6 格（若被弱减速覆盖则是 1.05）
    expect(p2 - p1).toBeGreaterThan(0.45)
    expect(p2 - p1).toBeLessThan(0.75)
  })

  it('同类光环不叠加：取最大加成', () => {
    const auraPet20 = makePet({
      id: 't-aura-20',
      attack: 10,
      attackInterval: 100,
      range: 1,
      aura: { kind: 'attackSpeed', value: 0.2, radius: 3 },
    })
    const auraPet40 = makePet({
      id: 't-aura-40',
      attack: 10,
      attackInterval: 100,
      range: 1,
      aura: { kind: 'attackSpeed', value: 0.4, radius: 3 },
    })
    const shooter = makePet({ id: 't-shooter', attack: 30, attackInterval: 1, range: 2 })
    const engine = makeEngine({
      lineup: [auraPet20, auraPet40, shooter],
      level: { startGold: 900 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 100, // 不开战，纯查属性
    })
    // 默认槽位 (2,1)/(5,1)/(3,3)：两座光环塔都在射手半径 3 内
    engine.placeTower(0, auraPet20.id)
    engine.placeTower(1, auraPet40.id)
    engine.placeTower(2, shooter.id)
    // 若叠加应为 1/1.6，取最大才是 1/1.4
    expect(engine.towerStats(2)!.interval).toBeCloseTo(1 / 1.4, 6)
    // 光环塔自身也吃同类最大光环（含自己在内的取最大语义）
    expect(engine.towerStats(0)!.interval).toBeCloseTo(100 / 1.4, 6)
  })

  it('2x 速度下敌人移动更快（setSpeed/getSpeed）', () => {
    const engine = makeEngine({
      lineup: [sniper30],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    expect(engine.getSpeed()).toBe(1)
    engine.setSpeed(2)
    expect(engine.getSpeed()).toBe(2)
    advance(engine, 1) // 1 真实秒 = 2 逻辑秒 → 位移 ≈ 1.5×2
    const snap = engine.getSnapshot()
    expect(snap.speed).toBe(2)
    expect(snap.enemies[0]!.x).toBeGreaterThan(-1 + 1.5)
  })

  it('MAX_FRAME_DT 钳制：超大 dt 只推进有限时间', () => {
    const engine = makeEngine({
      lineup: [sniper30],
      level: { baseHp: 100 },
      waves: [makeWave([{ enemyId: 'mouse', count: 1, interval: 1 }], 0)],
      firstWaveCountdown: 0.1,
    })
    engine.update(9999) // 单帧钳制到 0.5s → 鼠几乎没动
    const snap = engine.getSnapshot()
    if (snap.enemies.length > 0) {
      expect(snap.enemies[0]!.x).toBeLessThan(0.5)
    }
  })
})
