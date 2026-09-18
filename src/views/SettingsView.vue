<script setup lang="ts">
import { ref } from 'vue'

import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()

const exportText = ref('')
const showExport = ref(false)
const importText = ref('')
const importMsg = ref<string | null>(null)
const confirmReset = ref(false)

function doExport(): void {
  exportText.value = profile.exportSave()
  showExport.value = true
  importMsg.value = null
}

async function copyExport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportText.value)
    importMsg.value = '已复制到剪贴板'
  } catch {
    // 剪贴板不可用时退化为手动选择文本
    importMsg.value = '请手动全选复制上方文本'
  }
}

function doImport(): void {
  if (profile.importSave(importText.value.trim())) {
    importMsg.value = '导入成功！'
    importText.value = ''
    showExport.value = false
  } else {
    importMsg.value = '导入失败：存档文本不合法'
  }
}

function doReset(): void {
  profile.resetSave()
  confirmReset.value = false
  importMsg.value = '存档已重置'
}
</script>

<template>
  <main class="settings">
    <header class="head">
      <RouterLink to="/" class="btn btn-ghost back">‹ 主页</RouterLink>
      <h1 class="title">设置</h1>
      <span class="placeholder"></span>
    </header>

    <section class="card block">
      <h2 class="block-title">战绩</h2>
      <p class="line">累计击杀 {{ profile.stats.totalKills }} 只鼠贼 · 胜场 {{ profile.stats.battlesWon }}</p>
      <p class="line" v-if="!profile.persistent">⚠️ 当前环境无法保存进度</p>
    </section>

    <section class="card block">
      <h2 class="block-title">存档管理</h2>
      <div class="row">
        <button class="btn btn-ghost" @click="doExport">导出存档</button>
        <button class="btn btn-ghost" @click="confirmReset = true">重置存档</button>
      </div>

      <textarea
        v-if="showExport"
        class="save-text"
        readonly
        :value="exportText"
        @focus="($event) => ($event.target as HTMLTextAreaElement).select()"
      ></textarea>
      <div v-if="showExport" class="row">
        <button class="btn btn-ghost" @click="copyExport">复制存档文本</button>
      </div>

      <h3 class="sub-title">导入存档</h3>
      <textarea
        v-model="importText"
        class="save-text"
        placeholder="粘贴之前导出的存档文本…"
      ></textarea>
      <div class="row">
        <button class="btn btn-primary" :disabled="!importText.trim()" @click="doImport">
          导入
        </button>
      </div>

      <p v-if="importMsg" class="msg" :class="{ ok: importMsg.includes('成功') || importMsg.includes('复制') }">
        {{ importMsg }}
      </p>

      <!-- 重置二次确认 -->
      <div v-if="confirmReset" class="confirm-mask" @click="confirmReset = false">
        <div class="confirm card" @click.stop>
          <p class="confirm-text">
            确定要重置存档吗？<br />
            <strong>所有宠物、进度与猫薄荷都会清空！</strong>
          </p>
          <div class="row center">
            <button class="btn btn-ghost" @click="confirmReset = false">取消</button>
            <button class="btn btn-danger" @click="doReset">确认重置</button>
          </div>
        </div>
      </div>
    </section>

    <p class="version">哈基米塔防 v0.1.0</p>
  </main>
</template>

<style scoped>
.settings {
  flex: 1;
  width: min(40rem, 100%);
  margin: 0 auto;
  padding: 0.8rem 0.7rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.title {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
  text-align: center;
}

.placeholder {
  min-width: 4.2rem;
}

.block {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.block-title {
  margin: 0;
  font-size: 1rem;
}

.sub-title {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
}

.line {
  margin: 0;
  color: var(--c-ink-soft);
  font-size: 0.9rem;
}

.row {
  display: flex;
  gap: 0.6rem;
}

.row.center {
  justify-content: center;
}

.save-text {
  width: 100%;
  height: 6rem;
  border: 2px solid var(--c-line);
  border-radius: var(--radius-sm);
  padding: 0.5rem;
  font-size: 0.75rem;
  font-family: monospace;
  resize: vertical;
  box-sizing: border-box;
  background: var(--c-bg-sunken);
}

.msg {
  margin: 0;
  font-size: 0.85rem;
  color: var(--c-danger);
}

.msg.ok {
  color: var(--c-success);
}

.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(74, 59, 50, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 1rem;
}

.confirm {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: center;
}

.confirm-text {
  margin: 0;
  line-height: 1.6;
}

.version {
  text-align: center;
  color: var(--c-ink-soft);
  font-size: 0.75rem;
}
</style>
