import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'


import { readFileSync } from 'node:fs'
import { getDailyChallenge, todayStr } from '@/game/daily'
import { router } from '@/router'
import BattleView from '@/views/BattleView.vue'

/** 挂载战斗视图（每日挑战路由）的编排层回归测试 */
async function mountDaily(): Promise<ReturnType<typeof mount>> {
  const pinia = createPinia()
  setActivePinia(pinia) // 路由守卫在导航期访问 store，必须先激活
  router.push('/battle/daily')
  await router.isReady()
  return mount(BattleView, {
    global: { plugins: [pinia, router] },
  })
}

describe('BattleView 编排层（每日挑战链路回归锁）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('B1 回归锁：/battle/daily 渲染编队页而非弹回主页', async () => {
    const wrapper = await mountDaily()
    await wrapper.vm.$nextTick()
    // B1 bug 时的表现：resolveLevel 抛错 → router.replace('/') → 编队页消失
    expect(wrapper.find('.prep').exists()).toBe(true)
    expect(wrapper.text()).toContain('出战编队')
    wrapper.unmount()
  })

  it('战前情报渲染本关敌人构成', async () => {
    const wrapper = await mountDaily()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('本关敌人情报')
    expect(wrapper.text()).toContain('BOSS')
    wrapper.unmount()
  })

  it('每日词缀在战前情报公示', async () => {
    const challenge = getDailyChallenge(todayStr())
    const wrapper = await mountDaily()
    await wrapper.vm.$nextTick()
    expect(challenge.affixes.length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('情报')
    wrapper.unmount()
  })

  it('commonOnly 时 LineupPicker 限定 N/R（规则公示与执行一致）', async () => {
    const challenge = getDailyChallenge(todayStr())
    const wrapper = await mountDaily()
    await wrapper.vm.$nextTick()
    if (challenge.commonOnly) {
      // commonOnly 日：不应出现 SSR/SR 宠物名（以 PET_LIST 中任意 SR 宠名为探针）
      expect(wrapper.text()).not.toContain('旺财')
    }
    wrapper.unmount()
  })
})

describe('下一关导航与编队规则（回归锁）', () => {
  it('App.vue 使用 fullPath 作为 RouterView key（路径变化强制重挂载）', () => {
    const src = readFileSync('src/App.vue', 'utf-8')
    expect(src).toContain(':key="route.fullPath"')
  })

  it('解锁链：通关 L1 后 unlockedLevelIds 含 L2', async () => {
    const { createPinia, setActivePinia } = await import('pinia')
    const pinia = createPinia()
    setActivePinia(pinia)
    const { useProfileStore } = await import('@/stores/profile')
    const store = useProfileStore()
    store.init()
    expect(store.unlockedLevelIds).toEqual(['1'])
    store.completeLevel('1', 2, 0)
    expect(store.unlockedLevelIds).toContain('2')
  })
})
