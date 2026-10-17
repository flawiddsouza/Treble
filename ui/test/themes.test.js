import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { themes, getTheme, setTheme, initializeTheme } from '../src/themes.js'

beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.theme
})

afterEach(() => {
    vi.restoreAllMocks()
    delete document.documentElement.dataset.theme
})

describe('theme preferences', () => {
    it('offers the original palettes with turquoise as the default', () => {
        expect(themes).toEqual([
            { id: 'turquoise-dreams', label: 'Turquoise Dreams' },
            { id: 'purple', label: 'Purple' },
            { id: 'royalty', label: 'Royalty' },
            { id: 'dark', label: 'Dark' }
        ])
        expect(getTheme()).toBe('turquoise-dreams')
        expect(initializeTheme()).toBe('turquoise-dreams')
        expect(document.documentElement.dataset.theme).toBe('turquoise-dreams')
        expect(window.localStorage.getItem('Treble-Theme')).toBeNull()
    })

    it.each(themes)('applies and saves $label immediately', ({ id }) => {
        expect(setTheme(id)).toBe(id)
        expect(document.documentElement.dataset.theme).toBe(id)
        expect(getTheme()).toBe(id)
        expect(window.localStorage.getItem('Treble-Theme')).toBe(id)
    })

    it('restores the saved theme without rewriting it', () => {
        window.localStorage.setItem('Treble-Theme', 'royalty')
        const write = vi.spyOn(Storage.prototype, 'setItem')
        expect(initializeTheme()).toBe('royalty')
        expect(getTheme()).toBe('royalty')
        expect(write).not.toHaveBeenCalled()
    })

    it.each(['unknown', 'dark-mode', '', 'null'])('uses the default for invalid saved value %j without replacing it', savedTheme => {
        window.localStorage.setItem('Treble-Theme', savedTheme)
        document.documentElement.dataset.theme = 'purple'
        expect(initializeTheme()).toBe('turquoise-dreams')
        expect(document.documentElement.dataset.theme).toBe('turquoise-dreams')
        expect(window.localStorage.getItem('Treble-Theme')).toBe(savedTheme)
    })

    it('ignores unsupported selections and reads an invalid DOM value as the default', () => {
        setTheme('purple')
        expect(setTheme('unknown')).toBe('purple')
        expect(document.documentElement.dataset.theme).toBe('purple')
        expect(window.localStorage.getItem('Treble-Theme')).toBe('purple')
        document.documentElement.dataset.theme = 'unknown'
        expect(getTheme()).toBe('turquoise-dreams')
    })

    it('keeps the default usable when reading storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
        expect(initializeTheme()).toBe('turquoise-dreams')
        expect(document.documentElement.dataset.theme).toBe('turquoise-dreams')
    })

    it('applies theme changes even when saving storage is blocked', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
        expect(setTheme('dark')).toBe('dark')
        expect(document.documentElement.dataset.theme).toBe('dark')
        expect(getTheme()).toBe('dark')
    })

    it('handles browsers that block the storage getter itself', () => {
        vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
        expect(initializeTheme()).toBe('turquoise-dreams')
        expect(setTheme('royalty')).toBe('royalty')
        expect(getTheme()).toBe('royalty')
    })
})
