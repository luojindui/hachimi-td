import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DraftModal from '@/components/battle/DraftModal.vue'

const OPTIONS = [
  { id: 'attackPlus', name: '猫爪磨亮', desc: '全体攻击 +20%', rarity: 'common' },
  { id: 'rapidFire', name: '闪电反射', desc: '全体攻速 +18%', rarity: 'rare' },
  { id: 'longRange', name: '千里眼', desc: '全体射程 +15%', rarity: 'epic' },
] as const

describe('DraftModal', () => {
  it('渲染全部选项卡片与 dialog 语义', () => {
    const wrapper = mount(DraftModal, { props: { draft: OPTIONS } })
    const cards = wrapper.findAll('.draft-option')
    expect(cards.length).toBe(3)
    expect(wrapper.text()).toContain('猫爪磨亮')
    expect(wrapper.text()).toContain('选择一项强化')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.find('[aria-modal="true"]').exists()).toBe(true)
    // 稀有度徽章
    expect(wrapper.text()).toContain('金色')
    expect(wrapper.find('.rarity-epic').exists()).toBe(true)
    wrapper.unmount()
  })

  it('点击卡片发出 pick 事件并携带正确索引', async () => {
    const wrapper = mount(DraftModal, { props: { draft: OPTIONS } })
    const cards = wrapper.findAll('.draft-option')
    await cards[1]!.trigger('click')
    expect(wrapper.emitted('pick')).toEqual([[1]])
    await cards[2]!.trigger('click')
    expect(wrapper.emitted('pick')![1]).toEqual([2])
    wrapper.unmount()
  })
})
