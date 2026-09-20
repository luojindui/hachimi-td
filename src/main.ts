import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { assets, setAssetProvider } from './render/registry'
import {
  createKenneyProvider,
  kenneySpritesReady,
  preloadKenneySprites,
} from './render/providers/sprite'
import { router } from './router'
import './assets/main.css'

const app = createApp(App)

// 素材皮肤：Kenney CC0 精灵包全部就绪才切换（加载期间/失败用矢量皮肤兜底）
void preloadKenneySprites().then(() => {
  if (kenneySpritesReady()) setAssetProvider(createKenneyProvider(assets()))
})

app.use(createPinia())
app.use(router)

app.mount('#app')
