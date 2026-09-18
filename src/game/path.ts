import type { Vec2 } from './types'

/** 格子坐标的唯一键 */
export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * 把轴对齐路点序列展开成路径占用的格子集合（裁剪到非负象限，用于建造格碰撞检查）。
 * 遇到非轴对齐线段直接抛错（数据问题应在测试期暴露）。
 */
export function expandPathCells(path: readonly Vec2[]): Set<string> {
  const cells = new Set<string>()
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    if (a.x !== b.x && a.y !== b.y) {
      throw new Error(
        `path segment ${i} (${a.x},${a.y})->(${b.x},${b.y}) 不是轴对齐`,
      )
    }
    const x0 = Math.min(a.x, b.x)
    const x1 = Math.max(a.x, b.x)
    const y0 = Math.min(a.y, b.y)
    const y1 = Math.max(a.y, b.y)
    for (let x = Math.max(0, x0); x <= x1; x++) {
      for (let y = Math.max(0, y0); y <= y1; y++) {
        cells.add(cellKey(x, y))
      }
    }
  }
  return cells
}

/** 各段长度（格） */
export function segmentLengths(path: readonly Vec2[]): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    out.push(Math.abs(b.x - a.x) + Math.abs(b.y - a.y))
  }
  return out
}

/** 路径总长（格） */
export function totalPathLength(path: readonly Vec2[]): number {
  return segmentLengths(path).reduce((s, n) => s + n, 0)
}

export interface PathPosition {
  pos: Vec2
  /** 当前所在段索引（若已完成则为最后一段） */
  segment: number
  /** 是否已到达终点 */
  done: boolean
}

/**
 * 求路径上距起点弧长 dist 处的坐标（线性插值）。
 * dist <= 0 返回起点；dist >= 总长返回终点且 done = true。
 */
export function pointAtDistance(
  path: readonly Vec2[],
  dist: number,
): PathPosition {
  if (path.length < 2) {
    throw new Error('path 至少需要两个路点')
  }
  if (dist <= 0) {
    return { pos: { ...path[0]! }, segment: 0, done: false }
  }
  const segs = segmentLengths(path)
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    const len = segs[i]!
    if (dist < acc + len) {
      const a = path[i]!
      const b = path[i + 1]!
      const t = (dist - acc) / len
      return {
        pos: {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        },
        segment: i,
        done: false,
      }
    }
    acc += len
  }
  return {
    pos: { ...path[path.length - 1]! },
    segment: segs.length - 1,
    done: true,
  }
}
