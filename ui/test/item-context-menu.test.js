import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import ItemContextMenu from '../src/components/ItemContextMenu.vue'

const actions = [
    { id: 'unavailable', label: 'Unavailable', disabled: true },
    { id: 'play', label: 'Play now' },
    { id: 'next', label: 'Play next' },
    { id: 'album', label: 'Go to album' }
]
const wrappers = []
const hosts = []
function render(props = {}, component = ItemContextMenu) {
    const host = document.createElement('div')
    document.body.append(host)
    hosts.push(host)
    const wrapper = mount(component, { attachTo: host, props: component === ItemContextMenu ? { actions, visible: true, position: { x: 40, y: 50 }, ...props } : {} })
    wrappers.push(wrapper)
    return wrapper
}
const menu = () => new DOMWrapper(document.querySelector('[role="menu"]'))
const items = () => menu().findAll('[role="menuitem"]')
afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    for (const host of hosts.splice(0)) host.remove()
    vi.restoreAllMocks()
})

describe('item context menu', () => {
    it('opens from a row button without dismissing on the triggering pointer event', async () => {
        const Parent = defineComponent({
            components: { ItemContextMenu },
            data: () => ({ open: false, actions }),
            template: '<button @click="open = true">Options</button><ItemContextMenu :visible="open" :actions="actions" :position="{ x: 20, y: 30 }" @close="open = false" />'
        })
        const wrapper = render({}, Parent)
        await wrapper.get('button').trigger('pointerdown')
        await wrapper.get('button').trigger('click')
        await flushPromises()
        expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
        expect(document.activeElement.textContent.trim()).toBe('Play now')
        expect(wrapper.getComponent(ItemContextMenu).emitted('close')).toBeUndefined()
    })

    it('navigates enabled actions with arrows, Home and End, then emits the selected ID', async () => {
        const wrapper = render()
        await flushPromises()
        expect(document.activeElement).toBe(items()[1].element)
        await menu().trigger('keydown', { key: 'ArrowUp' })
        expect(document.activeElement).toBe(items()[3].element)
        await menu().trigger('keydown', { key: 'ArrowDown' })
        expect(document.activeElement).toBe(items()[1].element)
        await menu().trigger('keydown', { key: 'End' })
        expect(document.activeElement).toBe(items()[3].element)
        await menu().trigger('keydown', { key: 'Home' })
        expect(document.activeElement).toBe(items()[1].element)
        await items()[0].trigger('click')
        expect(wrapper.emitted('select')).toBeUndefined()
        await items()[2].trigger('click')
        expect(wrapper.emitted('select')).toEqual([['next']])
        expect(wrapper.emitted('close')).toEqual([[{ restoreFocus: false }]])
    })

    it('restores the opener on Escape or Tab and leaves native Tab navigation unblocked', async () => {
        const wrapper = render()
        await flushPromises()
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        menu().element.dispatchEvent(escape)
        expect(escape.defaultPrevented).toBe(true)
        expect(wrapper.emitted('close').at(-1)).toEqual([{ restoreFocus: true }])
        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        menu().element.dispatchEvent(tab)
        expect(tab.defaultPrevented).toBe(false)
        expect(wrapper.emitted('close').at(-1)).toEqual([{ restoreFocus: true }])
    })

    it('dismisses on outside pointer, viewport resize and document scroll while allowing its own scroll', async () => {
        const closed = vi.fn()
        const wrapper = render({ onClose: closed })
        await flushPromises()
        await items()[1].trigger('pointerdown')
        await menu().trigger('scroll')
        expect(wrapper.emitted('close')).toBeUndefined()
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        expect(wrapper.emitted('close')).toHaveLength(1)
        window.dispatchEvent(new Event('resize'))
        expect(wrapper.emitted('close')).toHaveLength(2)
        document.dispatchEvent(new Event('scroll'))
        expect(wrapper.emitted('close')).toHaveLength(3)
        expect(wrapper.emitted('close').at(-1)).toEqual([{ restoreFocus: false }])
        wrapper.unmount()
        wrappers.splice(wrappers.indexOf(wrapper), 1)
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        window.dispatchEvent(new Event('resize'))
        document.dispatchEvent(new Event('scroll'))
        expect(closed).toHaveBeenCalledTimes(3)
    })

    it('clamps both viewport edges and updates when another row opens the same menu', async () => {
        vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(300)
        vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(200)
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 180, height: 150 })
        const wrapper = render({ position: { x: 299, y: 199 } })
        await flushPromises()
        expect(menu().element.style.left).toBe('112px')
        expect(menu().element.style.top).toBe('42px')
        await wrapper.setProps({ position: { x: -5, y: -10 }, actions: [{ id: 'artist', label: 'Go to artist' }] })
        await flushPromises()
        expect(menu().element.style.left).toBe('8px')
        expect(menu().element.style.top).toBe('8px')
        expect(document.activeElement.textContent.trim()).toBe('Go to artist')
    })

    it('focuses a safe target when enabled actions change or none remain', async () => {
        const wrapper = render()
        await flushPromises()
        await wrapper.setProps({ actions: [{ id: 'play', label: 'Play now', disabled: true }, { id: 'next', label: 'Play next' }] })
        await flushPromises()
        expect(document.activeElement.textContent.trim()).toBe('Play next')
        await wrapper.setProps({ actions: [{ id: 'play', label: 'Play now', disabled: true }] })
        await flushPromises()
        expect(document.activeElement).toBe(menu().element)
        await menu().trigger('keydown', { key: 'ArrowDown' })
        expect(wrapper.emitted('select')).toBeUndefined()
        await wrapper.setProps({ visible: false })
        expect(document.querySelector('[role="menu"]')).toBeNull()
    })
})
