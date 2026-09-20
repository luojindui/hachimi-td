<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useProfileStore } from '@/stores/profile'

// 应用外壳：初始化存档 + 路由出口
const profile = useProfileStore()
profile.init()
// 路径全量作为 key：同路由不同参数（如 /battle/1 → /battle/2）强制重挂载，
// 保证 BattleView 等在挂载期固化路由参数的视图完整重建
const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <div v-if="!profile.persistent" class="storage-warn">
      当前浏览器环境无法保存进度（如无痕模式），关闭页面后进度将丢失
    </div>
    <div v-else-if="profile.recoveredFromCorruption" class="storage-warn warn">
      检测到存档损坏，已自动开启新档（损坏档已备份）
    </div>
    <RouterView :key="route.fullPath" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.storage-warn {
  background: #fff3cd;
  color: #8a6d1a;
  font-size: 0.8rem;
  text-align: center;
  padding: 0.3rem 0.6rem;
}

.storage-warn.warn {
  background: #ffe2e2;
  color: var(--c-danger);
}
</style>
