import { getPet } from '@/game/data/pets'
import type { Rarity } from '@/game/types'

import { createEmojiProvider } from './emoji'
import type { AssetProvider, DrawAnim, PetVisual, ThemeTiles, UiIconName } from '../types'

/* ============================================================
 * 矢量萌宠生成器 v1（美术小样验证通过后的正式移植）
 * 平面无描边 chibi 风：大圆头 + 大眼高光 + 粉耳腮红
 * 局部坐标系：头中心 (0,0)，头半径 44，全身高约 172
 * ============================================================ */

const RARITY_SCALE: Record<Rarity, number> = { N: 0.92, R: 0.96, SR: 1, SSR: 1.08 }

interface PetSpec {
  species: 'cat' | 'dog'
  body: string
  belly?: string
  muzzle?: string
  pattern?: 'stripes' | 'patch' | 'blaze' | 'cap' | 'mask' | 'spots'
  patternColor?: string
  patternColor2?: string
  patchSpots?: [number, number, number][]
  patchSpots2?: [number, number, number][]
  bodyPatches?: [number, number, number][]
  bodyPatches2?: [number, number, number][]
  ears: 'catPointy' | 'catFold' | 'dogPointy' | 'floppy'
  earColor?: string
  eyeColor?: string
  eyes?: 'normal' | 'happy' | 'sparkle'
  nose: 'cat' | 'dog'
  mouth: 'omega' | 'smile' | 'open'
  tail: 'cat' | 'curl' | 'straight' | 'stub'
  tailColor?: string
  tailTip?: string
  acc?: string[]
  fluff?: boolean
  tufts?: boolean
  blush?: boolean
  bodyW?: number
}

/* ---------- 21 只宠物外观参数 ---------- */
const PET_SPECS: Record<string, PetSpec> = {
  'tianyuan-cat': { species: 'cat', body: '#c9cdd6', belly: '#f0f1f4', pattern: 'patch', patternColor: '#8b93a3', patchSpots: [[30, -24, 14], [42, -6, 10]], ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  'tianyuan-dog': { species: 'dog', body: '#d9a25f', belly: '#f4e3c8', ears: 'dogPointy', nose: 'dog', mouth: 'smile', tail: 'straight' },
  'orange-cat': { species: 'cat', body: '#f2a54a', belly: '#ffe8c7', pattern: 'stripes', patternColor: '#d97f26', ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat', tailTip: '#ffe8c7' },
  xiaobai: { species: 'cat', body: '#fbfaf7', ears: 'catFold', nose: 'cat', mouth: 'omega', tail: 'cat' },
  lihua: { species: 'cat', body: '#b3a08c', belly: '#e8dccd', pattern: 'stripes', patternColor: '#6f5f50', ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  spotty: { species: 'dog', body: '#f6f5f1', ears: 'floppy', earColor: '#35353c', nose: 'dog', mouth: 'smile', tail: 'straight', pattern: 'spots', patchSpots: [[-24, -20, 8], [20, -30, 6], [-8, 12, 6]], bodyPatches: [[26, 62, 9], [-30, 70, 6]] },
  shiba: { species: 'dog', body: '#eda54f', belly: '#fff3dd', muzzle: '#fff3dd', ears: 'dogPointy', nose: 'dog', mouth: 'smile', tail: 'curl' },
  corgi: { species: 'dog', body: '#f0a860', belly: '#fff6e8', muzzle: '#fff6e8', pattern: 'blaze', patternColor: '#fff6e8', ears: 'dogPointy', nose: 'dog', mouth: 'open', tail: 'stub', bodyW: 1.15 },
  'cow-cat': { species: 'cat', body: '#f7f6f2', pattern: 'patch', patternColor: '#3a3a42', patchSpots: [[-30, -26, 15], [36, -10, 12], [-40, 6, 9]], bodyPatches: [[28, 64, 14]], ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  sanhua: { species: 'cat', body: '#f7f5ef', pattern: 'patch', patternColor: '#f2a54a', patchSpots: [[-32, -28, 14], [38, -8, 11]], patchSpots2: [[36, -34, 9], [-8, -20, 7]], patternColor2: '#3a3a42', bodyPatches: [[-28, 62, 12]], bodyPatches2: [[24, 72, 8]], ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  'fortune-cat': { species: 'cat', body: '#fbfaf7', pattern: 'patch', patternColor: '#f2a54a', patchSpots: [[30, -28, 12], [-42, -2, 9]], ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat', acc: ['collar', 'bell', 'coin'] },
  bichon: { species: 'dog', body: '#fbfaf6', fluff: true, ears: 'catFold', earColor: '#eae7de', eyes: 'happy', nose: 'dog', mouth: 'smile', tail: 'straight' },
  siamese: { species: 'cat', body: '#f2e4cf', pattern: 'mask', patternColor: '#8a6b52', earColor: '#8a6b52', eyeColor: '#3f6fd6', ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  goldie: { species: 'dog', body: '#e6b352', belly: '#f7e5bd', ears: 'floppy', earColor: '#c89538', nose: 'dog', mouth: 'open', tail: 'straight', tailTip: '#f7e5bd' },
  husky: { species: 'dog', body: '#eef1f5', pattern: 'cap', patternColor: '#99a2b1', earColor: '#99a2b1', eyeColor: '#3f6fd6', ears: 'dogPointy', nose: 'dog', mouth: 'smile', tail: 'straight' },
  samoyed: { species: 'dog', body: '#f9f7f2', fluff: true, earColor: '#e8e2d4', ears: 'dogPointy', eyes: 'happy', nose: 'dog', mouth: 'smile', tail: 'straight', tailTip: '#e8e2d4' },
  ragdoll: { species: 'cat', body: '#f0e7db', pattern: 'mask', patternColor: '#9b7d68', earColor: '#9b7d68', eyeColor: '#3f6fd6', ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat' },
  border: { species: 'dog', body: '#3f3f49', belly: '#e8e8ec', pattern: 'blaze', patternColor: '#f2f2f5', earColor: '#2e2e36', ears: 'floppy', nose: 'dog', mouth: 'smile', tail: 'straight' },
  mainecoon: { species: 'cat', body: '#8a6f4d', belly: '#d8c9ae', pattern: 'stripes', patternColor: '#634c31', tufts: true, ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat', tailTip: '#d8c9ae' },
  hachimi: { species: 'cat', body: '#ffffff', eyeColor: '#3f6fd6', eyes: 'sparkle', ears: 'catPointy', nose: 'cat', mouth: 'omega', tail: 'cat', tailTip: '#ffd75e', acc: ['halo'] },
  wangcai: { species: 'dog', body: '#d9994f', belly: '#f7e3c4', muzzle: '#f7e3c4', ears: 'dogPointy', nose: 'dog', mouth: 'smile', tail: 'straight', acc: ['collar', 'tag'], bodyW: 1.18 },
}

/* ---------- 基础绘制工具 ---------- */
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill()
}
function ell(
  c: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number, rot = 0,
): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill()
}
function strokePath(
  c: CanvasRenderingContext2D,
  color: string,
  w: number,
  fn: (k: CanvasRenderingContext2D) => void,
  cap: CanvasLineCap = 'round',
): void {
  c.strokeStyle = color; c.lineWidth = w; c.lineCap = cap
  c.beginPath(); fn(c); c.stroke()
}
function clipPath(
  c: CanvasRenderingContext2D,
  path: (k: CanvasRenderingContext2D) => void,
  draw: () => void,
): void {
  c.save(); c.beginPath(); path(c); c.clip(); draw(); c.restore()
}

/* ---------- 宠物各部位 ---------- */
function drawShadow(c: CanvasRenderingContext2D): void {
  c.fillStyle = 'rgba(74,59,50,0.14)'
  ell(c, 0, 92, 44, 10)
}

function drawTail(c: CanvasRenderingContext2D, d: PetSpec): void {
  const col = d.tailColor || d.body
  if (d.tail === 'cat') {
    strokePath(c, col, 11, k => {
      k.moveTo(26, 68); k.bezierCurveTo(70, 72, 90, 46, 76, 16)
    })
    c.fillStyle = d.tailTip || d.belly || '#fff'
    circle(c, 76, 16, 6.5)
  } else if (d.tail === 'curl') {
    strokePath(c, d.belly || col, 13, k => {
      k.moveTo(30, 60); k.quadraticCurveTo(48, 30, 62, 50)
      k.quadraticCurveTo(66, 62, 52, 58)
    })
  } else if (d.tail === 'straight') {
    c.fillStyle = col
    c.beginPath()
    c.moveTo(28, 66); c.quadraticCurveTo(60, 58, 68, 34)
    c.quadraticCurveTo(70, 26, 62, 28)
    c.quadraticCurveTo(52, 46, 26, 54)
    c.closePath(); c.fill()
    c.fillStyle = d.tailTip || d.belly || d.body
    circle(c, 65, 32, 5.5)
  } else if (d.tail === 'stub') {
    c.fillStyle = col
    ell(c, 34, 60, 11, 8, 0.5)
  }
}

function drawBody(c: CanvasRenderingContext2D, d: PetSpec): void {
  const bodyW = d.bodyW || 1
  c.fillStyle = d.body
  ell(c, 0, 58, 40 * bodyW, 34)
  if (d.belly) {
    c.fillStyle = d.belly
    ell(c, 0, 66, 25 * bodyW, 21)
  }
  if (d.bodyPatches) {
    const patches = d.bodyPatches
    const patches2 = d.bodyPatches2
    clipPath(c, k => ell(k, 0, 58, 40 * bodyW, 34), () => {
      c.fillStyle = d.patternColor || d.body
      for (const [px, py, pr] of patches) circle(c, px, py, pr)
      if (patches2) {
        c.fillStyle = d.patternColor2 || d.body
        for (const [px, py, pr] of patches2) circle(c, px, py, pr)
      }
    })
  }
  c.fillStyle = d.body
  ell(c, -16 * bodyW, 86, 12, 8)
  ell(c, 16 * bodyW, 86, 12, 8)
}

function drawHead(c: CanvasRenderingContext2D, d: PetSpec): void {
  if (d.fluff) {
    c.fillStyle = d.body
    for (const a of [-150, -115, -90, -65, -30]) {
      const rad = (a * Math.PI) / 180
      circle(c, Math.cos(rad) * 38, Math.sin(rad) * 38 - 4, 13)
    }
  }
  c.fillStyle = d.body
  circle(c, 0, 0, 44)
}

function drawPattern(c: CanvasRenderingContext2D, d: PetSpec): void {
  if (!d.pattern) return
  clipPath(c, k => circle(k, 0, 0, 44), () => {
    if (d.pattern === 'stripes') {
      c.fillStyle = d.patternColor || d.body
      for (const sx of [-18, 0, 18]) {
        c.beginPath()
        c.moveTo(sx - 8, -46)
        c.quadraticCurveTo(sx - 1, -26, sx - 3, -12)
        c.lineTo(sx + 5, -12)
        c.quadraticCurveTo(sx + 7, -28, sx + 8, -46)
        c.closePath(); c.fill()
      }
    } else if (d.pattern === 'patch' || d.pattern === 'spots') {
      c.fillStyle = d.patternColor || d.body
      for (const [px, py, pr] of d.patchSpots ?? []) circle(c, px, py, pr)
      if (d.patchSpots2) {
        c.fillStyle = d.patternColor2 || d.body
        for (const [px, py, pr] of d.patchSpots2) circle(c, px, py, pr)
      }
    } else if (d.pattern === 'blaze') {
      c.fillStyle = d.patternColor || d.body
      c.beginPath()
      c.moveTo(-10, -46); c.quadraticCurveTo(-4, -14, -7, 22)
      c.lineTo(7, 22); c.quadraticCurveTo(4, -14, 10, -46)
      c.closePath(); c.fill()
    } else if (d.pattern === 'cap') {
      c.fillStyle = d.patternColor || d.body
      c.beginPath(); c.arc(0, -2, 43, Math.PI, Math.PI * 2); c.closePath(); c.fill()
      circle(c, 0, -2, 43)
    } else if (d.pattern === 'mask') {
      c.fillStyle = d.patternColor || d.body
      ell(c, 0, 3, 27, 23)
    }
  })
}

function drawFace(c: CanvasRenderingContext2D, d: PetSpec): void {
  const eyeColor = d.eyeColor || '#2b2b33'
  if (d.eyes === 'happy') {
    strokePath(c, eyeColor, 3.2, k => {
      k.arc(-17, 0, 7, Math.PI * 1.08, Math.PI * 1.92)
      k.moveTo(24, 0); k.arc(17, 0, 7, Math.PI * 1.08, Math.PI * 1.92)
    })
  } else {
    for (const sx of [-17, 17]) {
      c.fillStyle = eyeColor
      ell(c, sx, -2, 6.5, 9)
      c.fillStyle = 'rgba(255,255,255,0.95)'
      circle(c, sx + 2.2, -5, 2.8)
      c.fillStyle = 'rgba(255,255,255,0.75)'
      circle(c, sx - 1.6, 1, 1.4)
      if (d.eyes === 'sparkle') {
        c.fillStyle = '#fff'
        c.beginPath()
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 2
          const r1 = i % 2 ? 1.6 : 3.4
          c.lineTo(sx + Math.cos(a) * r1, -3 + Math.sin(a) * r1)
        }
        c.closePath(); c.fill()
      }
    }
  }
  const line = '#7a5a4a'
  if (d.nose === 'dog') {
    c.fillStyle = '#4a3f3a'
    ell(c, 0, 8, 5.5, 4)
    if (d.mouth === 'open') {
      c.fillStyle = '#5a4440'
      c.beginPath()
      c.moveTo(-8, 13); c.quadraticCurveTo(0, 26, 8, 13)
      c.quadraticCurveTo(0, 17, -8, 13); c.closePath(); c.fill()
      c.fillStyle = '#ff9db4'
      ell(c, 0, 20, 4.5, 3.5)
    } else {
      strokePath(c, line, 2.2, k => { k.arc(0, 12, 7, Math.PI * 0.15, Math.PI * 0.85) })
    }
  } else {
    c.fillStyle = '#ff9db4'
    c.beginPath()
    c.moveTo(-3.5, 7); c.lineTo(3.5, 7); c.quadraticCurveTo(0, 12.5, -3.5, 7)
    c.closePath(); c.fill()
    strokePath(c, line, 2, k => {
      k.arc(-4.5, 13, 4.2, Math.PI * 1.05, Math.PI * 1.95)
      k.moveTo(0.3, 13); k.arc(4.5, 13, 4.2, Math.PI * 1.05, Math.PI * 1.95)
    })
  }
  c.fillStyle = 'rgba(255,140,150,0.4)'
  ell(c, -27, 9, 7, 4.5)
  ell(c, 27, 9, 7, 4.5)
  if (d.species === 'cat') {
    c.strokeStyle = 'rgba(60,45,40,0.3)'; c.lineWidth = 1.4; c.lineCap = 'round'
    for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(side * 21, 7); c.lineTo(side * 39, 3); c.stroke()
      c.beginPath(); c.moveTo(side * 21, 12); c.lineTo(side * 39, 14); c.stroke()
    }
  }
}

function drawEars(c: CanvasRenderingContext2D, d: PetSpec): void {
  const base = d.earColor || d.body
  const inner = '#ffb3c0'
  for (const side of [-1, 1]) {
    if (d.ears === 'catPointy') {
      c.fillStyle = base
      c.beginPath()
      c.moveTo(side * 34, -26)
      c.quadraticCurveTo(side * 46, -72, side * 16, -60)
      c.quadraticCurveTo(side * 22, -40, side * 24, -20)
      c.closePath(); c.fill()
      c.fillStyle = inner
      c.beginPath()
      c.moveTo(side * 31, -30)
      c.quadraticCurveTo(side * 38, -58, side * 22, -51)
      c.quadraticCurveTo(side * 26, -39, side * 28, -28)
      c.closePath(); c.fill()
      if (d.tufts) {
        c.fillStyle = d.patternColor || base
        c.beginPath()
        c.moveTo(side * 38, -56); c.lineTo(side * 52, -76); c.lineTo(side * 46, -52)
        c.closePath(); c.fill()
      }
    } else if (d.ears === 'catFold') {
      c.fillStyle = base
      ell(c, side * 36, -34, 16, 12, side * 0.5)
      c.fillStyle = inner
      ell(c, side * 36, -34, 8, 5.5, side * 0.5)
    } else if (d.ears === 'dogPointy') {
      c.fillStyle = base
      c.beginPath()
      c.moveTo(side * 42, -16)
      c.quadraticCurveTo(side * 58, -54, side * 26, -58)
      c.quadraticCurveTo(side * 12, -42, side * 18, -12)
      c.closePath(); c.fill()
      c.fillStyle = inner
      c.beginPath()
      c.moveTo(side * 36, -20)
      c.quadraticCurveTo(side * 45, -46, side * 27, -48)
      c.quadraticCurveTo(side * 19, -37, side * 23, -18)
      c.closePath(); c.fill()
    }
  }
}

function drawFloppyEars(c: CanvasRenderingContext2D, d: PetSpec): void {
  const base = d.earColor || d.body
  for (const side of [-1, 1]) {
    c.fillStyle = base
    c.beginPath()
    c.ellipse(side * 41, -2, 14, 26, side * 0.18, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgba(0,0,0,0.06)'
    c.beginPath()
    c.ellipse(side * 44, 4, 8, 16, side * 0.18, 0, Math.PI * 2)
    c.fill()
  }
}

function drawAccessories(c: CanvasRenderingContext2D, d: PetSpec): void {
  if (!d.acc) return
  if (d.acc.includes('collar')) {
    strokePath(c, '#e04b4b', 9, k => {
      k.arc(0, 34, 31, Math.PI * 0.22, Math.PI * 0.78)
    }, 'butt')
  }
  if (d.acc.includes('bell')) {
    c.fillStyle = '#f5c542'
    circle(c, 0, 66, 7)
    c.fillStyle = '#b8860b'
    c.fillRect(-1, 66, 2, 5)
    circle(c, 0, 62, 1.6)
  }
  if (d.acc.includes('coin')) {
    c.fillStyle = d.body
    ell(c, -40, 10, 12, 20, 0.55)
    c.fillStyle = '#f5c542'
    circle(c, -46, -16, 11)
    c.strokeStyle = '#c9971a'; c.lineWidth = 2
    c.beginPath(); c.arc(-46, -16, 11, 0, Math.PI * 2); c.stroke()
    c.fillStyle = '#8a6508'
    c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('福', -46, -15)
  }
  if (d.acc.includes('halo')) {
    strokePath(c, '#ffd75e', 5, k => {
      k.ellipse(0, -58, 21, 6.5, 0, 0, Math.PI * 2)
    })
    c.fillStyle = '#ffd75e'
    for (const [sx, sy] of [[-54, -36], [52, -28]] as const) {
      c.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 2
        const r1 = i % 2 ? 2.2 : 6
        c.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1)
      }
      c.closePath(); c.fill()
    }
  }
  if (d.acc.includes('tag')) {
    c.fillStyle = '#f5c542'
    circle(c, 0, 68, 6)
    c.strokeStyle = '#c9971a'; c.lineWidth = 1.6
    c.beginPath(); c.arc(0, 68, 6, 0, Math.PI * 2); c.stroke()
  }
}

function drawPetSpec(
  c: CanvasRenderingContext2D,
  d: PetSpec,
  anim?: DrawAnim,
): void {
  c.save()
  // 待机呼吸（宠物轻微起伏）
  if (anim?.t !== undefined) {
    const breathe = 1 + Math.sin((anim.t ?? 0) * 2.2 + (anim.phase ?? 0)) * 0.012
    c.scale(1, breathe)
  }
  // 放置弹跳
  if (anim?.sinceSpawn !== undefined && anim.sinceSpawn < 0.35) {
    const k = anim.sinceSpawn / 0.35
    c.translate(0, -Math.sin(Math.PI * k) * 10)
    c.scale(1 + Math.sin(Math.PI * k) * 0.08, 1 - Math.sin(Math.PI * k) * 0.05)
  }
  // 攻击后坐（轻微压缩）
  if (anim?.recoil) {
    c.scale(1 - anim.recoil * 0.06, 1 + anim.recoil * 0.05)
  }
  drawShadow(c)
  drawTail(c, d)
  if (d.ears === 'floppy') drawFloppyEars(c, d)
  drawBody(c, d)
  drawHead(c, d)
  drawPattern(c, d)
  if (d.muzzle) {
    c.fillStyle = d.muzzle
    ell(c, 0, 10, 17, 13)
  }
  drawFace(c, d)
  drawEars(c, d)
  drawAccessories(c, d)
  // 受击闪白
  if (anim?.flash) {
    c.globalAlpha = 0.5
    c.fillStyle = '#fff'
    circle(c, 0, 10, 56)
    c.globalAlpha = 1
  }
  c.restore()
}

/* ============================================================
 * 敌人绘制（朝左行进；facing 朝右时水平翻转）
 * ============================================================ */
function drawMouseBase(
  c: CanvasRenderingContext2D,
  tint: string,
): void {
  c.fillStyle = 'rgba(74,59,50,0.14)'
  ell(c, 0, 34, 28, 7)
  strokePath(c, '#d9a0a6', 3.5, k => {
    k.moveTo(24, 12); k.quadraticCurveTo(44, 6, 50, -12)
  })
  c.fillStyle = tint
  circle(c, -6, -26, 12)
  circle(c, 12, -26, 12)
  c.fillStyle = '#ffb3c0'
  circle(c, -6, -26, 6.5)
  circle(c, 12, -26, 6.5)
  c.fillStyle = tint
  ell(c, 0, 4, 24, 21)
  c.fillStyle = 'rgba(255,255,255,0.55)'
  ell(c, -4, 10, 13, 11)
  c.beginPath()
  c.moveTo(-20, -2); c.lineTo(-34, 4); c.lineTo(-20, 9)
  c.closePath(); c.fill()
  c.fillStyle = '#ff9db4'
  circle(c, -33, 3, 3)
  c.fillStyle = '#2b2b33'
  circle(c, -16, -4, 2.8)
  strokePath(c, 'rgba(60,45,40,0.35)', 1.2, k => {
    k.moveTo(-28, 5); k.lineTo(-40, 2)
    k.moveTo(-28, 8); k.lineTo(-40, 10)
  })
}

function drawEnemySpec(
  c: CanvasRenderingContext2D,
  enemyId: string,
  anim?: DrawAnim,
): void {
  const boss = enemyId === 'ratking'
  c.save()
  if (boss) c.scale(1.45, 1.45)
  // 待机弹跳（行进感）
  if (anim?.t !== undefined) {
    c.translate(0, Math.abs(Math.sin(anim.t * 9 + (anim.phase ?? 0))) * -2.5)
  }
  if (enemyId === 'crow') {
    c.fillStyle = 'rgba(74,59,50,0.14)'
    ell(c, 0, 40, 26, 7)
    strokePath(c, '#3c3c44', 3.5, k => {
      k.moveTo(20, 14); k.quadraticCurveTo(38, 8, 46, -8)
    })
    c.fillStyle = '#3c3c44'
    ell(c, 0, 6, 22, 18)
    circle(c, -12, -16, 12)
    c.fillStyle = '#565660'
    ell(c, 8, 2, 12, 9, -0.5)
    c.fillStyle = '#f0a24a'
    c.beginPath()
    c.moveTo(-30, -16); c.lineTo(-44, -10); c.lineTo(-30, -6)
    c.closePath(); c.fill()
    c.fillStyle = '#fff'
    circle(c, -16, -18, 3.2)
    c.fillStyle = '#2b2b33'
    circle(c, -17, -18, 1.6)
  } else {
    if (enemyId === 'swift') {
      strokePath(c, 'rgba(126,200,227,0.8)', 3, k => {
        k.moveTo(-38, -12); k.lineTo(-56, -12)
        k.moveTo(-34, 0); k.lineTo(-58, 0)
        k.moveTo(-38, 12); k.lineTo(-52, 12)
      })
    }
    const tints: Record<string, string> = {
      mouse: '#9aa0ad',
      swift: '#7ec8e3',
      shield: '#8fa0b5',
      ratking: '#6d5548',
    }
    drawMouseBase(c, tints[enemyId] ?? '#9aa0ad')
    if (enemyId === 'shield') {
      c.fillStyle = '#7d8894'
      c.beginPath(); c.arc(2, -18, 16, Math.PI, Math.PI * 2); c.closePath(); c.fill()
      c.fillStyle = '#66707c'
      c.fillRect(-14, -20, 32, 5)
      c.fillStyle = '#a8b8c8'
      c.beginPath()
      c.moveTo(-36, -10); c.lineTo(-22, -10); c.lineTo(-22, 16)
      c.quadraticCurveTo(-29, 24, -36, 16); c.closePath(); c.fill()
      c.strokeStyle = '#7d8894'; c.lineWidth = 2.5
      c.beginPath()
      c.moveTo(-36, -10); c.lineTo(-22, -10); c.lineTo(-22, 16)
      c.quadraticCurveTo(-29, 24, -36, 16); c.closePath(); c.stroke()
    }
    if (boss) {
      c.fillStyle = '#b03a3a'
      c.beginPath()
      c.moveTo(-20, -18); c.quadraticCurveTo(-44, 10, -34, 30)
      c.lineTo(30, 30); c.quadraticCurveTo(40, 8, 20, -18)
      c.closePath(); c.fill()
      drawMouseBase(c, '#6d5548')
      c.fillStyle = '#f5c542'
      c.beginPath()
      c.moveTo(-16, -34); c.lineTo(-16, -48); c.lineTo(-8, -38); c.lineTo(0, -52)
      c.lineTo(8, -38); c.lineTo(16, -48); c.lineTo(16, -34)
      c.closePath(); c.fill()
      strokePath(c, '#2b2b33', 2.5, k => {
        k.moveTo(-22, -9); k.lineTo(-12, -5)
        k.moveTo(-8, -5); k.lineTo(0, -9)
      })
    }
  }
  // Boss 嚎叫冲击波
  if (anim?.t !== undefined && anim.sinceSpawn !== undefined && anim.sinceSpawn < 0.6) {
    const k = anim.sinceSpawn / 0.6
    c.strokeStyle = `rgba(255,215,94,${(1 - k).toFixed(2)})`
    c.lineWidth = 3
    c.beginPath(); c.arc(0, 0, 26 + k * 30, 0, Math.PI * 2); c.stroke()
  }
  // 受击闪白
  if (anim?.flash) {
    c.globalAlpha = 0.5
    c.fillStyle = '#fff'
    circle(c, 0, 0, 30)
    c.globalAlpha = 1
  }
  c.restore()
}

/* ============================================================
 * Provider
 * ============================================================ */

/** 全部拥有矢量外观的宠物 id（与 PET_LIST 一致性由测试保证） */
export const VECTOR_PET_IDS: readonly string[] = Object.keys(PET_SPECS)
/** 全身高（局部单位），用于像素高度换算 */
const PET_HEIGHT = 172
const ENEMY_HEIGHT = 84

export function createVectorProvider(): AssetProvider {
  const base = createEmojiProvider()
  return {
    id: 'vector-v1',
    petVisual: (petId): PetVisual => base.petVisual(petId),
    enemyVisual: (enemyId) => base.enemyVisual(enemyId),
    projectileOf: (petId) => base.projectileOf(petId),
    rarityColor: (r: Rarity) => base.rarityColor(r),
    icon: (name: UiIconName) => base.icon(name),
    tiles: (theme): ThemeTiles => base.tiles(theme),

    drawPet(
      c: CanvasRenderingContext2D,
      petId: string,
      cx: number,
      cy: number,
      heightPx: number,
      anim?: DrawAnim,
    ): void {
      const spec = PET_SPECS[petId]
      if (!spec) throw new Error(`矢量生成器未知宠物: ${petId}`)
      const pet = getPet(petId)
      const s = (heightPx / PET_HEIGHT) * RARITY_SCALE[pet.rarity]
      c.save()
      c.translate(cx, cy)
      c.scale(s, s)
      c.translate(0, -10) // 包围盒中心对齐锚点
      drawPetSpec(c, spec, anim)
      c.restore()
    },

    drawEnemy(
      c: CanvasRenderingContext2D,
      enemyId: string,
      cx: number,
      cy: number,
      heightPx: number,
      anim?: DrawAnim,
    ): void {
      const s = heightPx / ENEMY_HEIGHT
      c.save()
      c.translate(cx, cy)
      // 敌人素材默认朝左；移动方向朝右时水平翻转
      if (anim?.facing !== undefined && Math.cos(anim.facing) > 0.05) {
        c.scale(-1, 1)
      }
      c.scale(s, s)
      c.translate(0, -ENEMY_HEIGHT / 2)
      drawEnemySpec(c, enemyId, anim)
      c.restore()
    },
  }
}
