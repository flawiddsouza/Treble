<template>
    <div class="player-container">
        <div class="player-cover" v-if="!coverLoadFailed">
            <img :src="coverSrc" @error="coverLoadFailed = true">
        </div>
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
        <audio :src="src" controls autoplay @playing="isPlaying = true" @pause="isPlaying = false" @ended="$emit('ended')" ref="audioElement"></audio>
    </div>
</template>

<script>
export default {
    props: {
        src: String,
        coverSrc: String
    },
    data() {
        return {
            isPlaying: false,
            coverLoadFailed: false
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

        const volumeLocalStorageKey = 'Treble-Volume'

        const savedVolume = localStorage.getItem(volumeLocalStorageKey)

        if(savedVolume) {
            this.$refs.audioElement.volume = savedVolume
        }

        this.$refs.audioElement.addEventListener('volumechange', () => {
            localStorage.setItem(volumeLocalStorageKey, this.$refs.audioElement.volume)
        })
    }
}
</script>

<style scoped>
.player-container {
    display: flex;
    background-color: var(--player-background-color);
    color: var(--player-text-color);
    align-items: center;
}

.player-cover {
    margin-left: 0.5rem;
    margin-top: 5px;
}

.player-cover img {
    width: 100px;
}

.player-buttons {
    margin-left: 1.2rem;
    width: 10px;
    cursor: pointer;
    margin-top: 3px;
}

.player-buttons.margin-diff {
    margin-left: 0.4rem;
}

audio {
    width: 100%;
    background-color: var(--player-background-color);
}

audio::-webkit-media-controls-panel {
    background-color: var(--player-background-color);
    border-radius: 0;
    border: 0;
}

audio::-webkit-media-controls-current-time-display,
audio::-webkit-media-controls-time-remaining-display {
    color: var(--player-text-color);
    text-shadow: none;
}

audio::-webkit-media-controls-play-button {
    display: none;
}

audio:-webkit-media-controls-enclosure {
    border-radius: 0;
}
</style>
