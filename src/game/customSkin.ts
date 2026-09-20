
/**
 * 自定义皮肤叠加层（本机自用素材，不入 git）。
 * 读取 public/assets/custom/mapping.json：
 *   petBadges: { [宠物id]: 图片相对路径 }   —— 替换塔上的 emoji 徽章
 *   enemies:   { [敌人id]: 图片相对路径 }   —— 覆盖敌人精灵
 * 缺 mapping.json / 缺图 → 全部回退默认皮肤，零报错。
 */

export interface CustomMapping {
  petBadges?: Record<string, string>
  enemies?: Record<string, string>
}

const badgeCache = new Map<string, HTMLImageElement>()
const enemyCache = new Map<string, HTMLImageElement>()
let loaded = false

function baseUrl(): string {
  return `${import.meta.env.BASE_URL ?? '/'}assets/custom/`
}

export async function loadCustomSkin(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const res = await fetch(`${baseUrl()}mapping.json`)
    if (!res.ok) return
    const mapping = (await res.json()) as CustomMapping
    const jobs: Promise<void>[] = []
    const load = (key: string, file: string, into: Map<string, HTMLImageElement>) => {
      jobs.push(
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            into.set(key, img)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = `${baseUrl()}${file}`
        }),
      )
    }
    for (const [petId, file] of Object.entries(mapping.petBadges ?? {})) {
      load(petId, file, badgeCache)
    }
    for (const [enemyId, file] of Object.entries(mapping.enemies ?? {})) {
      load(enemyId, file, enemyCache)
    }
    await Promise.all(jobs)
  } catch {
    /* mapping 不存在或格式错误 → 保持默认皮肤 */
  }
}

export function customPetBadge(petId: string): HTMLImageElement | undefined {
  return badgeCache.get(petId)
}

/** 供测试注入徽章图（结构化类型，DOM/napi 通用） */
export function installCustomBadgesForTesting(
  images: Record<string, { width: number; height: number }>,
): void {
  for (const [k, v] of Object.entries(images)) {
    badgeCache.set(k, v as unknown as HTMLImageElement)
  }
}

export function customEnemy(enemyId: string): HTMLImageElement | undefined {
  return enemyCache.get(enemyId)
}
