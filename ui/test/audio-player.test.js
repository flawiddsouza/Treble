import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AudioPlayer from '../src/components/AudioPlayer.vue'
import Frame from '../src/components/Frame.vue'
import { API_URL } from '../src/api.js'
import { formatSecondsAsTime, savedVolume } from '../src/audio.js'
import { volumeLocalStorageKey } from '../src/constants.js'

let wrappers = []
let play
let pause
let load

function player(props = {}, { realMarquee = false } = {}) {
    const wrapper = mount(AudioPlayer, {
        props: { track: { id: 1, path: '/music/song.mp3', title: 'Song', artist: 'Artist' }, src: '/api/track?id=1', autoplay: false, ...props },
        global: { stubs: realMarquee ? {} : { MarqueeText: { template: '<div><slot /></div>' } } }
    })
    wrappers.push(wrapper)
    return wrapper
}

function mediaValues(wrapper, values) {
    const audio = wrapper.get('audio').element
    for (const [property, value] of Object.entries(values)) {
        Object.defineProperty(audio, property, { value, configurable: true, writable: true })
    }
    return audio
}

beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: undefined })
})

afterEach(() => {
    for (const wrapper of wrappers) wrapper.unmount()
    wrappers = []
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('audio settings and time formatting', () => {
    it('keeps mute and rejects corrupt persisted volume', () => {
        expect(savedVolume('0')).toBe(0)
        expect(savedVolume('0.35')).toBe(0.35)
        for (const value of [null, '', '  ', 'loud', '-0.1', '1.1', 'Infinity', 'NaN']) {
            expect(savedVolume(value)).toBe(1)
        }
        localStorage.setItem(volumeLocalStorageKey, '0')
        const wrapper = player()
        expect(wrapper.get('audio').element.volume).toBe(0)
        expect(wrapper.get('input[aria-label="Volume"]').element.value).toBe('0')
    })

    it('formats hours and handles unknown or invalid durations', () => {
        expect(formatSecondsAsTime(61.7)).toBe('01:01')
        expect(formatSecondsAsTime(3661)).toBe('1:01:01')
        for (const value of [NaN, Infinity, -1, undefined]) expect(formatSecondsAsTime(value)).toBe('00:00')
    })

    it('ignores storage failures and still plays or changes volume', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage blocked') })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage blocked') })
        const wrapper = player()
        await wrapper.get('input[aria-label="Volume"]').setValue('0.25')
        expect(wrapper.get('audio').element.volume).toBe(0.25)
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        expect(play).toHaveBeenCalledOnce()
    })
})

describe('audio player controls', () => {
    it('shows one static title when it fits, and scrolls only when resizing makes it overflow', async () => {
        const layout = { containerWidth: 200, textWidth: 80 }
        const observers = []
        vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function () {
            return this.classList.contains('player-track-info-title') ? layout.containerWidth : 0
        })
        vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function () {
            return this.classList.contains('player-title-readable') ? layout.textWidth : 0
        })
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback) { this.callback = callback; this.observe = vi.fn(); this.disconnect = vi.fn(); observers.push(this) }
        })
        const wrapper = player({}, { realMarquee: true })
        await wrapper.vm.$nextTick()
        const title = wrapper.get('.player-track-info-title')
        expect(title.text()).toBe('Song')
        expect(title.find('.player-title-animation').exists()).toBe(false)
        expect(observers[0].observe).toHaveBeenCalledTimes(2)
        layout.containerWidth = 60
        observers[0].callback()
        await wrapper.vm.$nextTick()
        expect(title.findAll('.marquee-title')).toHaveLength(3)
        layout.containerWidth = 200
        observers[0].callback()
        await wrapper.vm.$nextTick()
        expect(title.text()).toBe('Song')
        expect(title.find('.player-title-animation').exists()).toBe(false)
        wrapper.unmount()
        wrappers = []
        expect(observers[0].disconnect).toHaveBeenCalledOnce()
    })

    it('exposes the title once while keeping overflowing animated copies hidden from screen readers', async () => {
        vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(80)
        vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(200)
        const wrapper = player({}, { realMarquee: true })
        await wrapper.vm.$nextTick()
        const title = wrapper.get('.player-track-info-title')
        expect(title.findAll('.marquee-title')).toHaveLength(3)
        const accessibleTitle = title.element.cloneNode(true)
        for (const hidden of accessibleTitle.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
        expect(accessibleTitle.textContent.trim()).toBe('Song')
    })

    it('disables unavailable queue directions for native and media session controls', async () => {
        const handlers = new Map()
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: {
            setActionHandler: (action, handler) => handlers.set(action, handler)
        } })
        const wrapper = player({ canPrevious: false, canNext: false })
        const previous = wrapper.get('button[aria-label="Previous track"]')
        const next = wrapper.get('button[aria-label="Next track"]')
        expect(previous.element.disabled).toBe(true)
        expect(next.element.disabled).toBe(true)
        await previous.trigger('click')
        await next.trigger('click')
        handlers.get('previoustrack')()
        handlers.get('nexttrack')()
        expect(wrapper.emitted('previous')).toBeUndefined()
        expect(wrapper.emitted('next')).toBeUndefined()
        await wrapper.setProps({ canNext: true })
        expect(previous.element.disabled).toBe(true)
        expect(next.element.disabled).toBe(false)
        await next.trigger('click')
        expect(wrapper.emitted('next')).toHaveLength(1)
    })

    it('autoplays new selections, while restored playback remains paused', async () => {
        const restored = player({ initialPosition: 42 })
        expect(play).not.toHaveBeenCalled()
        const restoredAudio = mediaValues(restored, { duration: 100, readyState: 1 })
        await restored.get('audio').trigger('loadedmetadata')
        expect(restoredAudio.currentTime).toBe(42)
        expect(play).not.toHaveBeenCalled()
        restoredAudio.currentTime = 70
        await restored.get('audio').trigger('timeupdate')
        await restored.get('audio').trigger('durationchange')
        expect(restoredAudio.currentTime).toBe(70)
        expect(restored.emitted('position').at(-1)).toEqual([70])

        const selected = player({ autoplay: true })
        expect(play).toHaveBeenCalledOnce()
        await selected.setProps({ src: '/api/track?id=2' })
        await flushPromises()
        expect(play).toHaveBeenCalledTimes(2)
    })

    it('keeps the saved position when a resource reset arrives before restored metadata', async () => {
        const wrapper = player({ initialPosition: 42 })
        const audio = mediaValues(wrapper, { currentTime: 0, duration: NaN, error: { code: 2 } })
        await wrapper.get('audio').trigger('timeupdate')
        expect(wrapper.emitted('position')).toBeUndefined()
        await wrapper.get('audio').trigger('error')
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        await wrapper.get('audio').trigger('timeupdate')
        expect(wrapper.emitted('position')).toBeUndefined()
        audio.error = null
        audio.duration = 100
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(audio.currentTime).toBe(42)
        expect(wrapper.emitted('position').at(-1)).toEqual([42])
        audio.currentTime = 50
        await wrapper.get('audio').trigger('timeupdate')
        expect(wrapper.emitted('position').at(-1)).toEqual([50])
    })

    it('keeps the previous position during a failed reload and permits a new manual seek', async () => {
        const wrapper = player()
        const audio = mediaValues(wrapper, { currentTime: 0, duration: 100, error: null })
        await wrapper.get('audio').trigger('loadedmetadata')
        audio.currentTime = 30
        await wrapper.get('audio').trigger('timeupdate')
        audio.error = { code: 2 }
        await wrapper.get('audio').trigger('error')
        load.mockImplementationOnce(function () { this.currentTime = 0; this.duration = NaN })
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        await wrapper.get('audio').trigger('timeupdate')
        await wrapper.get('audio').trigger('error')
        expect(wrapper.emitted('position').at(-1)).toEqual([30])
        audio.error = null
        audio.duration = 100
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(audio.currentTime).toBe(30)
        expect(wrapper.emitted('position').at(-1)).toEqual([30])
        await wrapper.get('input[aria-label="Seek"]').setValue('12')
        expect(audio.currentTime).toBe(12)
        expect(wrapper.emitted('position').at(-1)).toEqual([12])
        await wrapper.get('audio').trigger('durationchange')
        expect(audio.currentTime).toBe(12)
    })

    it('lets an explicit seek replace a restored position that could not yet be applied', async () => {
        const wrapper = player({ initialPosition: 42 })
        const audio = mediaValues(wrapper, { duration: 100 })
        let currentTime = 0
        let rejectSeek = true
        Object.defineProperty(audio, 'currentTime', {
            configurable: true,
            get: () => currentTime,
            set: value => {
                if (rejectSeek) throw new DOMException('Seek unavailable', 'InvalidStateError')
                currentTime = value
            }
        })
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(wrapper.get('input[aria-label="Seek"]').element.disabled).toBe(false)
        await wrapper.get('audio').trigger('timeupdate')
        expect(wrapper.emitted('position')).toBeUndefined()
        rejectSeek = false
        await wrapper.get('input[aria-label="Seek"]').setValue('12')
        expect(audio.currentTime).toBe(12)
        expect(wrapper.emitted('position').at(-1)).toEqual([12])
        await wrapper.get('audio').trigger('durationchange')
        expect(audio.currentTime).toBe(12)
    })

    it('preserves the paused resume position in browser storage through a failed resource load', async () => {
        const track = { id: 1, path: 'Song.mp3', title: 'Song', name: 'Song.mp3', children: [] }
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [track] }))
        const storageKey = `Treble-Resume:${API_URL}`
        sessionStorage.setItem(storageKey, JSON.stringify({
            playback: { paths: [track.path], order: [track.path], selectedPath: track.path, position: 42 }
        }))
        const wrapper = mount(Frame, { global: { stubs: { MarqueeText: { template: '<div><slot /></div>' } } } })
        wrappers.push(wrapper)
        await flushPromises()
        const audio = mediaValues(wrapper, { currentTime: 0, duration: NaN, error: { code: 2 } })
        await wrapper.get('audio').trigger('error')
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        await wrapper.get('audio').trigger('timeupdate')
        expect(JSON.parse(sessionStorage.getItem(storageKey)).playback.position).toBe(42)
        audio.error = null
        audio.duration = 100
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(audio.currentTime).toBe(42)
        audio.currentTime = 48
        await wrapper.get('audio').trigger('timeupdate')
        expect(JSON.parse(sessionStorage.getItem(storageKey)).playback.position).toBe(48)
    })

    it('uses native named buttons and sliders and emits queue actions', async () => {
        const wrapper = player()
        await wrapper.get('button[aria-label="Previous track"]').trigger('click')
        await wrapper.get('button[aria-label="Next track"]').trigger('click')
        await wrapper.get('button[aria-label="Shuffle"]').trigger('click')
        await wrapper.get('button[aria-label="Repeat off"]').trigger('click')
        expect(wrapper.emitted('previous')).toHaveLength(1)
        expect(wrapper.emitted('next')).toHaveLength(1)
        expect(wrapper.emitted('shuffle')).toEqual([[true]])
        expect(wrapper.emitted('repeat')).toEqual([['all']])
        await wrapper.setProps({ repeat: 'all', shuffle: true })
        expect(wrapper.get('button[aria-label="Shuffle"]').attributes('aria-pressed')).toBe('true')
        await wrapper.get('button[aria-label="Repeat all tracks"]').trigger('click')
        await wrapper.setProps({ repeat: 'one' })
        await wrapper.get('button[aria-label="Repeat one track"]').trigger('click')
        expect(wrapper.emitted('repeat')).toEqual([['all'], ['one'], ['none']])
        await wrapper.get('audio').trigger('playing')
        await wrapper.get('button[aria-label="Pause"]').trigger('click')
        expect(pause).toHaveBeenCalledOnce()
        await wrapper.get('input[aria-label="Volume"]').setValue('0.45')
        expect(localStorage.getItem(volumeLocalStorageKey)).toBe('0.45')
    })

    it('disables unknown seeking, rejects nonfinite times and clamps seek bounds', async () => {
        const wrapper = player()
        const audio = mediaValues(wrapper, { duration: Infinity })
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(wrapper.get('input[aria-label="Seek"]').element.disabled).toBe(true)
        expect(wrapper.vm.seekTo(10)).toBe(false)
        expect(wrapper.text()).not.toContain('Infinity')
        audio.duration = 120
        await wrapper.get('audio').trigger('durationchange')
        expect(wrapper.get('input[aria-label="Seek"]').element.disabled).toBe(false)
        expect(wrapper.vm.seekTo(Infinity)).toBe(false)
        wrapper.vm.seekTo(200)
        expect(audio.currentTime).toBe(120)
        wrapper.vm.seekTo(-10)
        expect(audio.currentTime).toBe(0)
        await wrapper.get('input[aria-label="Seek"]').setValue('30')
        expect(audio.currentTime).toBe(30)
    })

    it('replays the same audio element without remounting', async () => {
        const wrapper = player()
        const audio = mediaValues(wrapper, { duration: 100 })
        await wrapper.get('audio').trigger('loadedmetadata')
        audio.currentTime = 100
        await wrapper.get('audio').trigger('ended')
        expect(wrapper.emitted('ended')).toHaveLength(1)
        await wrapper.vm.replay()
        expect(wrapper.get('audio').element).toBe(audio)
        expect(audio.currentTime).toBe(0)
        expect(play).toHaveBeenCalledOnce()
        audio.currentTime = 20
        await wrapper.get('audio').trigger('durationchange')
        expect(audio.currentTime).toBe(20)
    })

    it('shows rejected play and load failures and permits retry', async () => {
        play.mockRejectedValueOnce(new DOMException('autoplay denied', 'NotAllowedError'))
        const wrapper = player({ autoplay: true })
        await flushPromises()
        expect(wrapper.get('[role="status"]').text()).toContain('Playback was blocked')
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        await wrapper.get('audio').trigger('playing')
        expect(wrapper.find('[role="status"]').exists()).toBe(false)
        mediaValues(wrapper, { error: { code: 2 } })
        await wrapper.get('audio').trigger('error')
        expect(wrapper.get('[role="status"]').text()).toContain('could not load')
        await wrapper.get('button[aria-label="Play"]').trigger('click')
        expect(load).toHaveBeenCalledOnce()
        expect(play).toHaveBeenCalledTimes(3)
    })

    it.each([
        [3, 'could not be decoded'],
        [4, 'could not load']
    ])('reports media error %i without mislabeling failed sources as decode errors', async (code, message) => {
        const wrapper = player()
        mediaValues(wrapper, { error: { code } })
        await wrapper.get('audio').trigger('error')
        expect(wrapper.get('[role="status"]').text()).toContain(message)
    })

    it('ignores an old play rejection after switching tracks', async () => {
        let rejectOldPlay
        play.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectOldPlay = reject }))
        const wrapper = player({ autoplay: true })
        await wrapper.setProps({ src: '/api/track?id=2' })
        await flushPromises()
        rejectOldPlay(new Error('old request'))
        await flushPromises()
        expect(wrapper.find('[role="status"]').exists()).toBe(false)
    })
})

describe('optional media session controls', () => {
    it('clears the previous track position while a new track has no usable metadata', async () => {
        let systemPosition
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: {
            setPositionState: position => { systemPosition = position }
        } })
        const wrapper = player()
        const audio = mediaValues(wrapper, { duration: 100, currentTime: 0 })
        await wrapper.get('audio').trigger('loadedmetadata')
        audio.currentTime = 45
        await wrapper.get('audio').trigger('timeupdate')
        expect(systemPosition).toEqual({ duration: 100, playbackRate: 1, position: 45 })
        await wrapper.setProps({ src: '/api/track?id=2' })
        expect(systemPosition).toBeUndefined()
        audio.duration = NaN
        await wrapper.get('audio').trigger('durationchange')
        expect(systemPosition).toBeUndefined()
        expect(wrapper.get('input[aria-label="Seek"]').element.disabled).toBe(true)
        audio.duration = 200
        audio.currentTime = 0
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(systemPosition).toEqual({ duration: 200, playbackRate: 1, position: 0 })
        expect(wrapper.get('input[aria-label="Seek"]').element.disabled).toBe(false)
    })

    it('tolerates missing methods and unsupported actions, then clears its handlers', async () => {
        const handlers = new Map()
        const setActionHandler = vi.fn((action, handler) => {
            if (action === 'seekto') throw new Error('unsupported action')
            handlers.set(action, handler)
        })
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: { setActionHandler } })
        const wrapper = player()
        mediaValues(wrapper, { duration: 100 })
        await wrapper.get('audio').trigger('loadedmetadata')
        await wrapper.get('audio').trigger('timeupdate')
        handlers.get('nexttrack')()
        expect(wrapper.emitted('next')).toHaveLength(1)
        await handlers.get('play')()
        expect(play).toHaveBeenCalledOnce()
        wrapper.unmount()
        wrappers = []
        for (const action of ['play', 'pause', 'previoustrack', 'nexttrack']) expect(handlers.get(action)).toBeNull()
    })

    it('publishes only valid positions and keeps controls working if the browser throws', async () => {
        const handlers = new Map()
        const setPositionState = vi.fn()
        Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: {
            setActionHandler: (action, handler) => handlers.set(action, handler), setPositionState
        } })
        const wrapper = player()
        const audio = mediaValues(wrapper, { duration: NaN })
        await wrapper.get('audio').trigger('loadedmetadata')
        expect(setPositionState).toHaveBeenLastCalledWith()
        audio.duration = 60
        await wrapper.get('audio').trigger('durationchange')
        audio.currentTime = 70
        await wrapper.get('audio').trigger('timeupdate')
        expect(setPositionState).toHaveBeenLastCalledWith({ duration: 60, playbackRate: 1, position: 60 })
        handlers.get('seekto')({ seekTime: 12, fastSeek: true })
        expect(audio.currentTime).toBe(12)
        setPositionState.mockImplementation(() => { throw new Error('unsupported') })
        expect(() => wrapper.vm.seekTo(20)).not.toThrow()
        expect(audio.currentTime).toBe(20)
    })
})
