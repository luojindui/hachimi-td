import { describe, expect, it } from 'vitest'

import {
  cellKey,
  expandPathCells,
  pointAtDistance,
  segmentLengths,
  totalPathLength,
} from '@/game/path'

describe('expandPathCells', () => {
  it('L 形路径展开正确并裁剪负坐标', () => {
    const cells = expandPathCells([
      { x: -1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 4 },
    ])
    expect(cells.has(cellKey(0, 2))).toBe(true)
    expect(cells.has(cellKey(1, 2))).toBe(true)
    expect(cells.has(cellKey(2, 2))).toBe(true)
    expect(cells.has(cellKey(2, 3))).toBe(true)
    expect(cells.has(cellKey(2, 4))).toBe(true)
    expect(cells.has(cellKey(-1, 2))).toBe(false)
    expect(cells.size).toBe(5)
  })

  it('非轴对齐线段抛错', () => {
    expect(() =>
      expandPathCells([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toThrow('轴对齐')
  })
})

describe('pointAtDistance', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 2 },
  ]

  it('总长计算', () => {
    expect(segmentLengths(path)).toEqual([3, 2])
    expect(totalPathLength(path)).toBe(5)
  })

  it('起点、中点、拐点、终点', () => {
    expect(pointAtDistance(path, 0).pos).toEqual({ x: 0, y: 0 })
    expect(pointAtDistance(path, 1.5).pos).toEqual({ x: 1.5, y: 0 })
    const corner = pointAtDistance(path, 3)
    expect(corner.pos).toEqual({ x: 3, y: 0 })
    // 段边界归下一段（半开区间语义）
    expect(corner.segment).toBe(1)
    expect(pointAtDistance(path, 4).pos).toEqual({ x: 3, y: 1 })
    const end = pointAtDistance(path, 5)
    expect(end.pos).toEqual({ x: 3, y: 2 })
    expect(end.done).toBe(true)
  })

  it('越界距离', () => {
    expect(pointAtDistance(path, -1).pos).toEqual({ x: 0, y: 0 })
    const beyond = pointAtDistance(path, 99)
    expect(beyond.done).toBe(true)
    expect(beyond.pos).toEqual({ x: 3, y: 2 })
  })

  it('路径过短抛错', () => {
    expect(() => pointAtDistance([{ x: 0, y: 0 }], 1)).toThrow()
  })
})
