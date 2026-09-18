import type { AssetProvider } from './types'
import { createEmojiProvider } from './providers/emoji'

let active: AssetProvider = createEmojiProvider()

/** 获取当前素材提供方（渲染层一律经此访问视觉资源） */
export function assets(): AssetProvider {
  return active
}

/** 整体替换素材提供方（换美术 = 注册新 provider，游戏逻辑零改动） */
export function setAssetProvider(provider: AssetProvider): void {
  active = provider
}
