<template>
    <section v-if="track" class="player-container" aria-label="Audio player">
        <div class="player-top-top">
            <div class="player-left">
                <div class="player-cover">
                    <img v-if="coverSrc && !coverLoadFailed" :src="coverSrc" alt="Album cover" @error="coverLoadFailed = true">
                    <div v-else class="player-cover-fallback" aria-label="No album cover"><span>No<br>Cover</span></div>
                </div>
                <div class="player-track-info">
                    <div ref="titleContainer" class="player-track-info-title" :title="trackTitle">
                        <span ref="titleText" class="player-title-readable" :class="{ 'player-title-offscreen': titleOverflows }">{{ trackTitle }}</span>
                        <marquee-text v-if="titleOverflows" class="player-title-animation" aria-hidden="true" :repeat="3" :duration="5" :key="src" :paused="!isPlaying">
                            <span class="marquee-title">{{ trackTitle }}</span>
                        </marquee-text>
                    </div>
                    <div class="player-track-info-artist" :title="track.artist">{{ track.artist }}</div>
                </div>
            </div>
            <div class="player-controls">
                <div class="playback-controls">
                    <button type="button" class="player-button" aria-label="Previous track" title="Previous track" :disabled="!canPrevious" @click="previous">
                        <svg viewBox="0 0 320 512" aria-hidden="true"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M31.1 64.03c-17.67 0-31.1 14.33-31.1 32v319.9c0 17.67 14.33 32 32 32C49.67 447.1 64 433.6 64 415.1V96.03C64 78.36 49.67 64.03 31.1 64.03zM267.5 71.41l-192 159.1C67.82 237.8 64 246.9 64 256c0 9.094 3.82 18.18 11.44 24.62l192 159.1c20.63 17.12 52.51 2.75 52.51-24.62v-319.9C319.1 68.66 288.1 54.28 267.5 71.41z" /></svg>
                    </button>
                    <button type="button" class="player-button play-button" :aria-label="isPlaying ? 'Pause' : 'Play'" :title="isPlaying ? 'Pause' : 'Play'" @click="isPlaying ? pause() : play()">
                        <svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    <button type="button" class="player-button" aria-label="Next track" title="Next track" :disabled="!canNext" @click="next">
                        <svg viewBox="0 0 320 512" aria-hidden="true"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M287.1 447.1c17.67 0 31.1-14.33 31.1-32V96.03c0-17.67-14.33-32-32-32c-17.67 0-31.1 14.33-31.1 31.1v319.9C255.1 433.6 270.3 447.1 287.1 447.1zM52.51 440.6l192-159.1c7.625-6.436 11.43-15.53 11.43-24.62c0-9.094-3.809-18.18-11.43-24.62l-192-159.1C31.88 54.28 0 68.66 0 96.03v319.9C0 443.3 31.88 457.7 52.51 440.6z" /></svg>
                    </button>
                    <button type="button" class="player-button toggle-button" aria-label="Shuffle" title="Shuffle" :aria-pressed="shuffle" @click="$emit('shuffle', !shuffle)">
                        <svg viewBox="0 0 512 512" aria-hidden="true"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M424.1 287c-15.13-15.12-40.1-4.426-40.1 16.97V352H336L153.6 108.8C147.6 100.8 138.1 96 128 96H32C14.31 96 0 110.3 0 128s14.31 32 32 32h80l182.4 243.2C300.4 411.3 309.9 416 320 416h63.97v47.94c0 21.39 25.86 32.12 40.99 17l79.1-79.98c9.387-9.387 9.387-24.59 0-33.97L424.1 287zM336 160h47.97v48.03c0 21.39 25.87 32.09 40.1 16.97l79.1-79.98c9.387-9.391 9.385-24.59-.0013-33.97l-79.1-79.98c-15.13-15.12-40.99-4.391-40.99 17V96H320c-10.06 0-19.56 4.75-25.59 12.81L254 162.7L293.1 216L336 160zM112 352H32c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c10.06 0 19.56-4.75 25.59-12.81l40.4-53.87L154 296L112 352z" /></svg>
                    </button>
                    <button type="button" class="player-button toggle-button" :aria-label="repeatLabel" :title="repeatLabel" :aria-pressed="repeat !== 'none'" @click="cycleRepeat">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 014-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 01-4 4H3" />
                            <path v-if="repeat === 'one'" d="M11 10h1v4" />
                        </svg>
                    </button>
                </div>
                <label class="volume-control">
                    <span>Volume</span>
                    <input type="range" aria-label="Volume" min="0" max="1" step="0.01" :value="volume" :style="{ '--range-progress': `${volume * 100}%` }" :aria-valuetext="`${Math.round(volume * 100)}%`" @input="setVolume($event.target.value)">
                </label>
            </div>
        </div>
        <div class="player-progress">
            <span>{{ elapsedTime }}</span>
            <input type="range" aria-label="Seek" min="0" :max="duration || 1" step="0.1" :value="currentTime" :style="{ '--range-progress': `${duration > 0 ? Math.min(currentTime / duration, 1) * 100 : 0}%` }" :disabled="duration === 0" :aria-valuetext="`${elapsedTime} of ${totalTime}`" @input="seekTo($event.target.value)">
            <span>{{ totalTime }}</span>
        </div>
        <p v-if="playbackError" class="player-error" role="status">{{ playbackError }}</p>
        <audio ref="audioElement" :src="src" preload="metadata"
            @playing="onPlaying" @pause="onPause" @ended="onEnded" @error="onMediaError"
            @loadedmetadata="onMetadata" @durationchange="onMetadata" @timeupdate="updateProgress"
            @volumechange="onVolumeChange" @ratechange="updateSeekPositionStateToMediaSession"></audio>
    </section>
</template>

<script>
import MarqueeText from 'vue-marquee-text-component'
import { markRaw } from 'vue'
import { volumeLocalStorageKey } from '@/constants'
import { formatSecondsAsTime, savedVolume } from '@/audio'

export default {
    components: { MarqueeText },
    props: {
        track: Object,
        src: String,
        coverSrc: String,
        shuffle: Boolean,
        canPrevious: { type: Boolean, default: true },
        canNext: { type: Boolean, default: true },
        repeat: { type: String, default: 'none' },
        autoplay: { type: Boolean, default: true },
        initialPosition: { type: Number, default: 0 }
    },
    emits: ['ended', 'previous', 'next', 'shuffle', 'repeat', 'position'],
    data() {
        let volume = 1
        try {
            volume = savedVolume(localStorage.getItem(volumeLocalStorageKey))
        } catch {
            // Storage can be unavailable in private or embedded browsers.
        }
        return {
            isPlaying: false,
            titleOverflows: false,
            titleResizeObserver: null,
            coverLoadFailed: false,
            currentTime: 0,
            duration: 0,
            volume,
            playbackError: '',
            pendingInitialPosition: 0,
            playAttempt: 0,
            mediaSessionActions: []
        }
    },
    computed: {
        trackTitle() { return this.track?.title || this.track?.name || '' },
        elapsedTime() { return formatSecondsAsTime(this.currentTime) },
        totalTime() { return formatSecondsAsTime(this.duration) },
        repeatLabel() {
            return this.repeat === 'one' ? 'Repeat one track' : this.repeat === 'all' ? 'Repeat all tracks' : 'Repeat off'
        }
    },
    watch: {
        trackTitle() { this.$nextTick(this.updateTitleOverflow) },
        coverSrc() { this.coverLoadFailed = false },
        async src() {
            this.playAttempt++
            this.isPlaying = false
            this.playbackError = ''
            this.currentTime = 0
            this.duration = 0
            this.updateSeekPositionStateToMediaSession()
            await this.$nextTick()
            this.prepareTrack()
        }
    },
    methods: {
        updateTitleOverflow() {
            const container = this.$refs.titleContainer
            const text = this.$refs.titleText
            this.titleOverflows = !!(container && text && text.scrollWidth > container.clientWidth)
        },
        observeTitle() {
            this.updateTitleOverflow()
            if (typeof ResizeObserver === 'function') {
                this.titleResizeObserver = markRaw(new ResizeObserver(() => this.updateTitleOverflow()))
                if (this.$refs.titleContainer) this.titleResizeObserver.observe(this.$refs.titleContainer)
                if (this.$refs.titleText) this.titleResizeObserver.observe(this.$refs.titleText)
            } else {
                window.addEventListener('resize', this.updateTitleOverflow)
            }
        },
        prepareTrack() {
            const audio = this.$refs.audioElement
            if (!audio) return
            this.pendingInitialPosition = Number.isFinite(this.initialPosition) && this.initialPosition >= 0 ? this.initialPosition : 0
            audio.volume = this.volume
            if (audio.readyState >= 1) this.onMetadata()
            if (this.autoplay) this.play()
        },
        async play() {
            const audio = this.$refs.audioElement
            if (!audio) return
            const attempt = ++this.playAttempt
            this.playbackError = ''
            try {
                if (audio.error) {
                    this.pendingInitialPosition = this.pendingInitialPosition ?? this.currentTime
                    audio.load()
                }
                await audio.play()
            } catch (error) {
                if (attempt !== this.playAttempt) return
                this.isPlaying = false
                this.playbackError = error?.name === 'NotAllowedError'
                    ? 'Playback was blocked. Press Play to start.'
                    : 'This track could not play. Check your connection and press Play to retry.'
            }
        },
        pause() {
            this.playAttempt++
            this.$refs.audioElement?.pause()
            this.onPause()
        },
        replay() {
            const audio = this.$refs.audioElement
            if (!audio) return
            this.pendingInitialPosition = 0
            if (this.seekTo(0)) this.pendingInitialPosition = null
            return this.play()
        },
        onPlaying() {
            this.isPlaying = true
            this.playbackError = ''
            this.setMediaPlaybackState('playing')
        },
        onPause() {
            this.isPlaying = false
            this.setMediaPlaybackState('paused')
        },
        onEnded() {
            this.onPause()
            this.$emit('ended')
        },
        onMediaError() {
            this.playAttempt++
            this.onPause()
            const errorCode = this.$refs.audioElement?.error?.code
            this.playbackError = errorCode === 3
                ? 'This track could not be decoded. Try Play again or choose another track.'
                : 'This track could not load. Check your connection and press Play to retry.'
        },
        onMetadata() {
            const audio = this.$refs.audioElement
            if (!audio) return
            this.duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
            if (this.pendingInitialPosition !== null && this.duration > 0) {
                if (this.seekTo(this.pendingInitialPosition)) this.pendingInitialPosition = null
            }
            this.updateSeekPositionStateToMediaSession()
        },
        updateProgress() {
            const audio = this.$refs.audioElement
            if (!audio || this.pendingInitialPosition > 0) return
            this.currentTime = Number.isFinite(audio.currentTime) && audio.currentTime >= 0 ? audio.currentTime : 0
            this.$emit('position', this.currentTime)
            this.updateSeekPositionStateToMediaSession()
        },
        seekTo(value, fastSeek = false) {
            const audio = this.$refs.audioElement
            const position = Number(value)
            if (!audio || this.duration === 0 || !Number.isFinite(position)) return false
            const seekTime = Math.max(0, Math.min(position, this.duration))
            try {
                if (fastSeek && typeof audio.fastSeek === 'function') audio.fastSeek(seekTime)
                else audio.currentTime = seekTime
                this.pendingInitialPosition = null
                this.updateProgress()
                return true
            } catch {
                return false
            }
        },
        setVolume(value) {
            const audio = this.$refs.audioElement
            const volume = Number(value)
            if (!audio || !Number.isFinite(volume)) return
            audio.volume = Math.min(1, Math.max(0, volume))
            this.onVolumeChange()
        },
        onVolumeChange() {
            const audio = this.$refs.audioElement
            if (!audio) return
            this.volume = audio.volume
            try {
                localStorage.setItem(volumeLocalStorageKey, String(this.volume))
            } catch {
                // Playback still works when storage is unavailable.
            }
        },
        cycleRepeat() {
            this.$emit('repeat', this.repeat === 'none' ? 'all' : this.repeat === 'all' ? 'one' : 'none')
        },
        previous() {
            if (this.canPrevious) this.$emit('previous')
        },
        next() {
            if (this.canNext) this.$emit('next')
        },
        setMediaPlaybackState(state) {
            try {
                if (navigator.mediaSession) navigator.mediaSession.playbackState = state
            } catch {
                // Media session support differs between browsers.
            }
        },
        updateSeekPositionStateToMediaSession() {
            const audio = this.$refs.audioElement
            const session = navigator.mediaSession
            if (!audio || typeof session?.setPositionState !== 'function') return
            if (this.duration === 0) {
                try { session.setPositionState() } catch { /* Optional browser API. */ }
                return
            }
            const playbackRate = audio.playbackRate
            if (!Number.isFinite(playbackRate) || playbackRate <= 0) return
            try {
                session.setPositionState({
                    duration: this.duration,
                    playbackRate,
                    position: Math.max(0, Math.min(this.currentTime, this.duration))
                })
            } catch {
                // An unsupported media session method must not stop playback controls.
            }
        },
        registerMediaSession() {
            const session = navigator.mediaSession
            if (typeof session?.setActionHandler !== 'function') return
            const actions = {
                play: () => this.play(),
                pause: () => this.pause(),
                previoustrack: () => this.previous(),
                nexttrack: () => this.next(),
                seekto: details => this.seekTo(details.seekTime, details.fastSeek)
            }
            for (const [action, handler] of Object.entries(actions)) {
                try {
                    session.setActionHandler(action, handler)
                    this.mediaSessionActions.push(action)
                } catch {
                    // A browser may support only some media actions.
                }
            }
        }
    },
    mounted() {
        this.observeTitle()
        this.registerMediaSession()
        this.prepareTrack()
    },
    beforeUnmount() {
        this.titleResizeObserver?.disconnect()
        window.removeEventListener('resize', this.updateTitleOverflow)
        this.pause()
        const session = navigator.mediaSession
        for (const action of this.mediaSessionActions) {
            try { session?.setActionHandler(action, null) } catch { /* Optional browser API. */ }
        }
        this.setMediaPlaybackState('none')
        try { session?.setPositionState?.() } catch { /* Optional browser API. */ }
    }
}
</script>

<style scoped>
.player-container {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.5rem;
    background-color: var(--player-background-color);
    color: var(--player-text-color);
}
.player-top-top {
    display: grid;
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    gap: 0.5rem 1rem;
    align-items: center;
}
.player-left {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 0.7rem;
}
.player-cover { flex: 0 0 70px; }
.player-cover img {
    display: block;
    width: 70px;
    height: auto;
}
.player-cover-fallback {
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 70px;
    height: 62px;
    background-color: white;
    text-align: center;
}
.player-track-info { min-width: 0; flex: 1; white-space: nowrap; }
.player-track-info-title { position: relative; font-weight: 500; margin-bottom: 0.1rem; }
.player-track-info-title, .player-track-info-artist { overflow: hidden; text-overflow: ellipsis; }
.player-title-readable {
    display: inline-block;
    width: max-content;
    max-width: none;
}
.player-title-offscreen {
    position: absolute;
    top: 0;
    left: 0;
    height: 1px;
    padding: 0;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
}
.marquee-title { margin-right: 1rem; }
.player-controls, .playback-controls, .volume-control { display: flex; align-items: center; }
.player-controls { min-width: 0; justify-content: center; flex-wrap: wrap; gap: 0.25rem 0.75rem; }
.playback-controls { gap: 0.25rem; }
.player-button {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.5rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    cursor: pointer;
}
.player-button svg { width: 15px; fill: currentColor; }
.player-button svg[fill="none"] { fill: none; }
.play-button svg { width: 30px; }
.player-button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 12%, transparent); }
.player-button:disabled { opacity: 0.5; cursor: default; }
.player-button:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.toggle-button { color: color-mix(in srgb, var(--player-text-color) 60%, transparent); }
.toggle-button[aria-pressed="true"], .toggle-button[aria-pressed="true"]:hover {
    color: var(--player-text-color);
    background: color-mix(in srgb, currentColor 16%, transparent);
}
.volume-control { min-width: 0; gap: 0.35rem; font-size: 0.9rem; }
.volume-control input { width: 5rem; min-width: 0; }
.player-progress { display: flex; align-items: center; gap: 0.35rem; margin-top: 0.4rem; font-variant-numeric: tabular-nums; }
.player-progress span { flex: 0 0 auto; font-size: 0.85rem; }
.player-progress input { flex: 1; width: 0; min-width: 0; }
input[type="range"] {
    --range-fill: var(--background-color);
    --range-track: color-mix(in srgb, var(--background-color) 25%, transparent);
    appearance: none;
    margin: 0;
    padding: 0;
    height: 1.5rem;
    min-height: 1.5rem;
    border: 0;
    background: transparent;
    cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
    height: 0.25rem;
    border-radius: 1rem;
    background: linear-gradient(to right, var(--range-fill) var(--range-progress), var(--range-track) var(--range-progress));
}
input[type="range"]::-moz-range-track {
    height: 0.25rem;
    border-radius: 1rem;
    background: var(--range-track);
}
input[type="range"]::-moz-range-progress { height: 0.25rem; border-radius: 1rem; background: var(--range-fill); }
input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 0.625rem;
    height: 0.625rem;
    margin-top: -0.1875rem;
    border: 0;
    border-radius: 50%;
    background: var(--range-fill);
}
input[type="range"]::-moz-range-thumb {
    width: 0.625rem;
    height: 0.625rem;
    border: 0;
    border-radius: 50%;
    background: var(--range-fill);
}
input[type="range"]:hover:not(:disabled)::-webkit-slider-thumb { transform: scale(1.2); }
input[type="range"]:hover:not(:disabled)::-moz-range-thumb { transform: scale(1.2); }
input[type="range"]:focus-visible { outline: none; }
input[type="range"]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--range-fill) 25%, transparent); }
input[type="range"]:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--range-fill) 25%, transparent); }
input[type="range"]:disabled { cursor: default; opacity: 0.5; }
@media (forced-colors: active) {
    input[type="range"] { forced-color-adjust: none; --range-fill: CanvasText; --range-track: GrayText; }
    input[type="range"]:focus-visible { outline: 2px solid Highlight; }
}
.player-error { margin: 0.3rem 0 0; font-size: 0.85rem; overflow-wrap: anywhere; }
@media (max-width: 650px) {
    .player-top-top { grid-template-columns: minmax(0, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
    .player-title-animation :deep(*) { animation: none !important; }
}
</style>
