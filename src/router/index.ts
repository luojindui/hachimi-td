import { createRouter, createWebHashHistory } from 'vue-router'

import { useProfileStore } from '@/stores/profile'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/battle/:levelId',
      name: 'battle',
      component: () => import('@/views/BattleView.vue'),
    },
    {
      path: '/dex',
      name: 'dex',
      component: () => import('@/views/DexView.vue'),
    },
    {
      path: '/hatch',
      name: 'hatch',
      component: () => import('@/views/HatchView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

/** 关卡解锁守卫：防止 URL 越权进入未解锁关卡 */
router.beforeEach((to) => {
  if (to.name !== 'battle') return true
  const profile = useProfileStore()
  if (!profile.initialized) profile.init()
  const id = String(to.params.levelId ?? '1')
  if (id === 'endless') {
    return profile.endlessUnlocked ? true : { name: 'home' }
  }
  return profile.unlockedLevelIds.includes(id) ? true : { name: 'home' }
})

export { router }
