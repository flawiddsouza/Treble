<template>
    <div class="player-container" v-if="track">
        <div class="player-top-top">
            <div class="player-left">
                <div class="player-cover">
                    <img :src="coverSrc" @error="coverLoadFailed = true" v-if="!coverLoadFailed">
                    <div style="width: 70px; height: 62px; background-color: white; display: grid; place-items: center;" v-else>
                        <div style="text-align: center">
                            <div>No</div>
                            <div>Cover</div>
                        </div>
                    </div>
                </div>
                <div class="player-track-info">
                    <div class="player-track-info-title" :title="track.title">
                        <marquee-text
                            :repeat="3"
                            :duration="5"
                            :key="track.path"
                            :paused="!isPlaying"
                        >
                            <span style="margin-right: 1rem">{{ track.title }}</span>
                        </marquee-text>
                    </div>
                    <div class="player-track-info-artist" :title="track.artist">{{ track.artist }}</div>
                </div>
            </div>
            <div class="player-right">
                <div class="player-top">
                    <div class="player-buttons">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" @click="$emit('previous')"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M31.1 64.03c-17.67 0-31.1 14.33-31.1 32v319.9c0 17.67 14.33 32 32 32C49.67 447.1 64 433.6 64 415.1V96.03C64 78.36 49.67 64.03 31.1 64.03zM267.5 71.41l-192 159.1C67.82 237.8 64 246.9 64 256c0 9.094 3.82 18.18 11.44 24.62l192 159.1c20.63 17.12 52.51 2.75 52.51-24.62v-319.9C319.1 68.66 288.1 54.28 267.5 71.41z"/></svg>
                    </div>
                    <div class="player-buttons margin-diff">
                        <img src="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJXaW5kb3dUZXh0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxwYXRoIGQ9Ik04IDV2MTRsMTEtN3oiLz4KICAgIDxwYXRoIGQ9Ik0wIDBoMjR2MjRIMHoiIGZpbGw9Im5vbmUiLz4KPC9zdmc+" v-if="!isPlaying" @click="play">
                        <img src="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJXaW5kb3dUZXh0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIHdpZHRoPSIyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxwYXRoIGQ9Ik02IDE5aDRWNUg2djE0em04LTE0djE0aDRWNWgtNHoiLz4KICAgIDxwYXRoIGQ9Ik0wIDBoMjR2MjRIMHoiIGZpbGw9Im5vbmUiLz4KPC9zdmc+" v-else @click="pause">
                    </div>
                    <div class="player-buttons">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" @click="$emit('next')"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M287.1 447.1c17.67 0 31.1-14.33 31.1-32V96.03c0-17.67-14.33-32-32-32c-17.67 0-31.1 14.33-31.1 31.1v319.9C255.1 433.6 270.3 447.1 287.1 447.1zM52.51 440.6l192-159.1c7.625-6.436 11.43-15.53 11.43-24.62c0-9.094-3.809-18.18-11.43-24.62l-192-159.1C31.88 54.28 0 68.66 0 96.03v319.9C0 443.3 31.88 457.7 52.51 440.6z"/></svg>
                    </div>
                    <div class="player-buttons">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" @click="$emit('shuffle', false)" v-if="shuffle"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M424.1 287c-15.13-15.12-40.1-4.426-40.1 16.97V352H336L153.6 108.8C147.6 100.8 138.1 96 128 96H32C14.31 96 0 110.3 0 128s14.31 32 32 32h80l182.4 243.2C300.4 411.3 309.9 416 320 416h63.97v47.94c0 21.39 25.86 32.12 40.99 17l79.1-79.98c9.387-9.387 9.387-24.59 0-33.97L424.1 287zM336 160h47.97v48.03c0 21.39 25.87 32.09 40.1 16.97l79.1-79.98c9.387-9.391 9.385-24.59-.0013-33.97l-79.1-79.98c-15.13-15.12-40.99-4.391-40.99 17V96H320c-10.06 0-19.56 4.75-25.59 12.81L254 162.7L293.1 216L336 160zM112 352H32c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c10.06 0 19.56-4.75 25.59-12.81l40.4-53.87L154 296L112 352z"/></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="opacity: 0.3" @click="$emit('shuffle', true)" v-if="!shuffle"><!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M424.1 287c-15.13-15.12-40.1-4.426-40.1 16.97V352H336L153.6 108.8C147.6 100.8 138.1 96 128 96H32C14.31 96 0 110.3 0 128s14.31 32 32 32h80l182.4 243.2C300.4 411.3 309.9 416 320 416h63.97v47.94c0 21.39 25.86 32.12 40.99 17l79.1-79.98c9.387-9.387 9.387-24.59 0-33.97L424.1 287zM336 160h47.97v48.03c0 21.39 25.87 32.09 40.1 16.97l79.1-79.98c9.387-9.391 9.385-24.59-.0013-33.97l-79.1-79.98c-15.13-15.12-40.99-4.391-40.99 17V96H320c-10.06 0-19.56 4.75-25.59 12.81L254 162.7L293.1 216L336 160zM112 352H32c-17.69 0-32 14.31-32 32s14.31 32 32 32h96c10.06 0 19.56-4.75 25.59-12.81l40.4-53.87L154 296L112 352z"/></svg>
                    </div>
                    <div class="player-buttons" style="margin-left: 1.2rem">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            v-if="repeat === 'all'"
                            @click="$emit('repeat', 'one')"
                        >
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 014-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 01-4 4H3" />
                        </svg>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            v-if="repeat === 'one'"
                            @click="$emit('repeat', 'none')"
                        >
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 014-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 01-4 4H3" />
                            <path d="M11 10h1v4" />
                        </svg>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            color="#06060652"
                            v-if="repeat === 'none'"
                            @click="$emit('repeat', 'all')"
                        >
                            <path d="M17 2l4 4-4 4" />
                            <path d="M3 11v-1a4 4 0 014-4h14" />
                            <path d="M7 22l-4-4 4-4" />
                            <path d="M21 13v1a4 4 0 01-4 4H3" />
                        </svg>
                    </div>
                    <div style="margin-left: 2rem">Volume</div>
                    <div class="volume-bar">
                        <div class="volume-bar-fill" ref="volumebar"></div>
                    </div>
                </div>
                <div class="player-bottom">
                    <audio :src="src" autoplay @playing="isPlaying = true" @pause="isPlaying = false" @ended="$emit('ended')" ref="audioElement"></audio>
                </div>
            </div>
        </div>
        <div class="player-bottom-bottom">
            <div>{{ elapsedTime }}</div>
            <div class="seekbar">
                <div class="seekbar-fill" ref="seekbar"></div>
            </div>
            <div>{{ totalTime }}</div>
        </div>
    </div>
</template>

<script>
import MarqueeText from 'vue-marquee-text-component'
import { volumeLocalStorageKey } from '@/constants'

// From: https://stackoverflow.com/a/11234208/4932305
function formatSecondsAsTime(secs) {
    if(isNaN(secs)) {
        return '00:00'
    }

    var hr  = Math.floor(secs / 3600)
    var min = Math.floor((secs - (hr * 3600)) / 60)
    var sec = Math.floor(secs - (hr * 3600) -  (min * 60))

    if(min < 10) {
        min = '0' + min
    }
    if(sec < 10) {
        sec  = '0' + sec
    }

    return min + ':' + sec
}

export default {
    components: {
        MarqueeText
    },
    props: {
        track: Object,
        src: String,
        coverSrc: String,
        shuffle: Boolean,
        repeat: String
    },
    data() {
        return {
            isPlaying: false,
            coverLoadFailed: false,
            elapsedTime: '00:00',
            totalTime: '00:00'
        }
    },
    watch: {
        coverSrc() {
            this.coverLoadFailed = false
        }
    },
    methods: {
        play() {
            this.$refs.audioElement.play()
        },
        pause() {
            this.$refs.audioElement.pause()
        },
        updateSeekPositionStateToMediaSession() {
            navigator.mediaSession.setPositionState({
                duration: this.$refs.audioElement.duration,
                playbackRate: this.$refs.audioElement.playbackRate,
                position: this.$refs.audioElement.currentTime,
            })
        }
    },
    mounted() {
        if('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                this.play()
            })

            navigator.mediaSession.setActionHandler('pause', () => {
                this.pause()
            })

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                this.$emit('previous')
            })

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                this.$emit('next')
            })

            navigator.mediaSession.setActionHandler('seekto', details => {
                if(details.fastSeek && 'fastSeek' in this.$refs.audioElement) {
                    this.$refs.audioElement.fastSeek(details.seekTime)
                    return
                }
                this.$refs.audioElement.currentTime = details.seekTime
                this.updateSeekPositionStateToMediaSession()
            })

            this.$refs.audioElement.addEventListener('ratechange', () => {
                this.updateSeekPositionStateToMediaSession()
            })
        }

        this.$refs.audioElement.addEventListener('timeupdate', () => {
            const currentTime = this.$refs.audioElement.currentTime
            const duration = this.$refs.audioElement.duration
            this.$refs.seekbar.style.width = ((currentTime * 100) / duration) + '%'
            this.elapsedTime = formatSecondsAsTime(currentTime)
            this.totalTime = formatSecondsAsTime(duration)
        })

        this.$refs.seekbar.parentElement.addEventListener('click', e => {
            const rect = this.$refs.seekbar.parentElement.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = ((x * 100) / this.$refs.seekbar.parentElement.clientWidth)
            this.$refs.seekbar.style.width = percentage + '%'
            const duration = this.$refs.audioElement.duration
            const seekTime = (duration * percentage) / 100
            this.$refs.audioElement.currentTime = seekTime
        })

        this.$refs.volumebar.parentElement.addEventListener('click', e => {
            const rect = this.$refs.volumebar.parentElement.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = ((x * 100) / this.$refs.volumebar.parentElement.clientWidth)
            this.$refs.volumebar.style.width = percentage + '%'
            const maxVolume = 1
            const newVolume = (maxVolume * percentage) / 100
            this.$refs.audioElement.volume = newVolume
        })

        const savedVolume = localStorage.getItem(volumeLocalStorageKey)

        if(savedVolume) {
            this.$refs.audioElement.volume = savedVolume
            const maxVolume = 1
            this.$refs.volumebar.style.width = ((savedVolume * 100) / maxVolume) + '%'
        } else {
            this.$refs.volumebar.style.width = '100%'
        }

        this.$refs.audioElement.addEventListener('volumechange', () => {
            localStorage.setItem(volumeLocalStorageKey, this.$refs.audioElement.volume)
        })
    }
}
</script>

<style scoped>
.player-container {
    background-color: var(--player-background-color);
    color: var(--player-text-color);
}

.player-top-top {
    display: flex;
}

.player-left {
    display: flex;
    align-items: center;
}

.player-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.player-top, .player-bottom {
    display: flex;
    align-items: center;
}

.player-top {
    justify-content: center;
    margin-top: 0.5rem;
    height: 1.9rem;
}

.player-track-info {
    margin-left: 0.7rem;
    width: 7.5rem;
    white-space: nowrap;
}

.player-track-info > .player-track-info-title {
    font-weight: 500;
    margin-bottom: 0.1rem;
}

.player-track-info > .player-track-info-title,
.player-track-info > .player-track-info-artist {
    text-overflow: ellipsis;
    overflow: hidden;
}

.player-cover {
    margin-left: 0.5rem;
    margin-top: 5px;
}

.player-cover img {
    width: 70px;
}

.player-buttons {
    margin-left: 1.7rem;
    width: 10px;
    cursor: pointer;
    margin-top: 3px;
}

.player-buttons:first-child {
    margin-left: 0;
}

.player-buttons.margin-diff {
    margin-left: 0.8rem;
}

.player-buttons > svg {
    width: 15px;
}

.player-buttons > img {
    width: 30px;
}

.player-bottom-bottom {
    display: flex;
    align-items: center;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}

.seekbar {
    width: 100%;
    background-color: rgba(0, 0, 0, 0.397);
    height: 0.3rem;
    margin-left: 0.35rem;
    margin-right: 0.35rem;
    border-radius: 5px;
}

.seekbar-fill {
    height: 100%;
    width: 0;
    background-color: black;
    border-radius: 5px;
}

.volume-bar {
    width: 4rem;
    background-color: rgba(0, 0, 0, 0.397);
    height: 0.3rem;
    margin-left: 0.35rem;
    margin-right: 0.35rem;
    border-radius: 5px;
}

.volume-bar-fill {
    height: 100%;
    width: 0;
    background-color: black;
    border-radius: 5px;
}
</style>
