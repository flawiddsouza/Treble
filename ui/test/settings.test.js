import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Settings from '../src/components/Settings.vue'
import { initializeTheme } from '../src/themes.js'

let wrapper

beforeEach(() => {
    localStorage.clear()
    initializeTheme()
    wrapper = mount(Settings, { attachTo: document.body })
})

afterEach(() => {
    wrapper.unmount()
    document.body.replaceChildren()
    document.documentElement.removeAttribute('data-theme')
})

describe('theme settings', () => {
    it('keeps Settings compact and applies a theme through the separate chooser', async () => {
        const trigger = wrapper.get('button[aria-label="Settings"]')
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        await trigger.trigger('click')
        expect(trigger.attributes('aria-expanded')).toBe('true')
        expect(document.activeElement).toBe(wrapper.get('.theme-summary').element)
        expect(wrapper.get('.theme-summary').text()).toContain('Turquoise Dreams')
        expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
        await wrapper.get('.theme-summary').trigger('click')
        const choices = wrapper.findAll('[role="radio"]')
        expect(choices.map(choice => choice.text())).toEqual(['Turquoise Dreams', 'Purple', 'Royalty', 'Dark'])
        expect(document.activeElement).toBe(choices[0].element)
        await choices[2].trigger('click')
        expect(document.documentElement.dataset.theme).toBe('royalty')
        expect(localStorage.getItem('Treble-Theme')).toBe('royalty')
        expect(wrapper.get('[aria-checked="true"]').text()).toBe('Royalty')
        await wrapper.get('[aria-label="Back to settings"]').trigger('click')
        expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
        expect(wrapper.get('.theme-summary').text()).toContain('Royalty')
        expect(document.activeElement).toBe(wrapper.get('.theme-summary').element)
        await wrapper.get('[aria-label="Close settings"]').trigger('click')
        await trigger.trigger('click')
        expect(wrapper.get('.theme-summary').text()).toContain('Royalty')
        await wrapper.get('.theme-summary').trigger('click')
        expect(document.activeElement).toBe(wrapper.get('[aria-checked="true"]').element)
    })

    it('closes with Escape, Close and the icon, returning focus to the icon', async () => {
        const trigger = wrapper.get('button[aria-label="Settings"]')
        for (const action of ['escape', 'close', 'toggle']) {
            await trigger.trigger('click')
            if (action === 'escape') await wrapper.get('.theme-summary').trigger('keydown', { key: 'Escape' })
            else if (action === 'close') await wrapper.get('[aria-label="Close settings"]').trigger('click')
            else await trigger.trigger('click')
            expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
            expect(trigger.attributes('aria-expanded')).toBe('false')
            expect(document.activeElement).toBe(trigger.element)
        }
    })

    it('returns from the chooser with Escape before closing Settings', async () => {
        await wrapper.get('.settings-trigger').trigger('click')
        await wrapper.get('.theme-summary').trigger('click')
        await wrapper.get('[aria-checked="true"]').trigger('keydown', { key: 'Escape' })
        expect(wrapper.get('h2').text()).toBe('Settings')
        expect(document.activeElement).toBe(wrapper.get('.theme-summary').element)
        await wrapper.get('.theme-summary').trigger('keydown', { key: 'Escape' })
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        expect(document.activeElement).toBe(wrapper.get('.settings-trigger').element)
    })

    it('supports radio keys, wraps at both ends and keeps the selected theme visible', async () => {
        await wrapper.get('.settings-trigger').trigger('click')
        await wrapper.get('.theme-summary').trigger('click')
        const choices = wrapper.findAll('[role="radio"]')
        const scroll = vi.fn()
        choices[3].element.scrollIntoView = scroll
        await choices[0].trigger('keydown', { key: 'End' })
        expect(wrapper.get('[aria-checked="true"]').text()).toBe('Dark')
        expect(document.activeElement).toBe(choices[3].element)
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })
        await choices[3].trigger('keydown', { key: 'ArrowRight' })
        expect(document.activeElement).toBe(choices[0].element)
        await choices[0].trigger('keydown', { key: 'ArrowUp' })
        expect(document.activeElement).toBe(choices[3].element)
        await choices[3].trigger('keydown', { key: 'Home' })
        expect(document.activeElement).toBe(choices[0].element)
        expect(wrapper.findAll('[tabindex="0"]')).toHaveLength(1)
        expect(localStorage.getItem('Treble-Theme')).toBe('turquoise-dreams')
    })

    it('closes on an outside press or leaving with Tab without taking focus back', async () => {
        const outside = document.createElement('input')
        document.body.append(outside)
        await wrapper.get('.settings-trigger').trigger('click')
        await wrapper.get('.theme-summary').trigger('click')
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        await wrapper.get('.settings-trigger').trigger('click')
        expect(wrapper.get('.theme-summary').exists()).toBe(true)
        await wrapper.get('.theme-summary').trigger('click')
        outside.focus()
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        expect(document.activeElement).toBe(outside)
    })
})
