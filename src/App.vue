<script setup lang="ts">
import { useProfileStore } from '@/stores/profile'

// 应用外壳：初始化存档 + 路由出口
const profile = useProfileStore()
profile.init()
</script>

<template>
  <div class="app-shell">
    <div v-if="!profile.persistent" class="storage-warn">
      当前浏览器环境无法保存进度（如无痕模式），关闭页面后进度将丢失
    </div>
    <div v-else-if="profile.recoveredFromCorruption" class="storage-warn warn">
      检测到存档损坏，已自动开启新档（损坏档已备份）
    </div>
    <RouterView />
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
