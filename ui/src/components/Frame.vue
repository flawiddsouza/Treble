<template>
    <main>
        <div class="search-bar">
            <input type="search" placeholder="Search..." v-model="search">
            <div class="settings">
                <i class="fas fa-sliders-h"></i>
            </div>
        </div>
        <div class="tabs">
            <div class="tab" v-for="tab in tabs" @click="activeTab = tab" :class="{ 'tab-active': tab === activeTab }">{{ tab }}</div>
        </div>
        <div class="list">
            <div class="list-item" v-if="dataNavigationStack.length > 1" @click="navigateUp">
                <i class="fas fa-arrow-left"></i>
                <span style="margin-left: 0.5rem">Go back</span>
            </div>
            <div v-for="item in computedData" class="list-item" @click="handleClick(item)" :class="{ 'list-item-active': selectedTrack && item.path === selectedTrack.path }">
                <template v-if="activeTab === 'Folders'">
                    <i class="fas fa-folder" v-if="item.children.length > 0"></i>
                    <i class="fas fa-music" v-else></i>
                    <span style="margin-left: 0.5rem">{{ generateTrackTitle(item) }}</span>
                </template>
                <template v-if="activeTab === 'Albums'">
                    <template v-if="'id' in item === false">
                        <i class="fas fa-folder"></i>
                        <span style="margin-left: 0.5rem">{{ generateAlbumTitle(item) }}</span>
                    </template>
                    <template v-else>
                        <i class="fas fa-music"></i>
                        <span style="margin-left: 0.5rem">{{ generateTrackTitle(item) }}</span>
                    </template>
                </template>
                <template v-if="activeTab === 'Artists'">
                    <template v-if="'id' in item === false">
                        <i class="fas fa-user"></i>
                        <span style="margin-left: 0.5rem">{{ item.artist }}</span>
                    </template>
                    <template v-else>
                        <i class="fas fa-music"></i>
                        <span style="margin-left: 0.5rem">{{ generateTrackTitle(item) }}</span>
                    </template>
                </template>
            </div>
        </div>
        <div class="player" v-if="selectedTrack">
            <AudioPlayer
                :src="`${API_URL}/track?path=${encodeURIComponent(selectedTrack.path)}`"
                :cover-src="`${API_URL}/track-cover?path=${encodeURIComponent(selectedTrack.path)}`"
                @ended="handleEnd"
                @previous="handlePrevious"
                @next="handleNext"
            ></AudioPlayer>
        </div>
        <footer class="nav-bar">
            <div class="nav-bar-item" v-for="navItem in navItems" @click="activeNavItem = navItem.name" :class="{ 'nav-bar-item-active': navItem.name === activeNavItem }">
                <i :class="navItem.icon"></i>
                <span style="margin-left: 0.5rem">{{ navItem.name }}</span>
            </div>
        </footer>
    </main>
</template>

<script>
import AudioPlayer from '@/components/AudioPlayer.vue'
import { API_URL, fetchFolders, fetchAlbums, fetchArtists, fetchAlbum, fetchArtist } from '@/api'

export default {
    components: {
        AudioPlayer
    },
    data() {
        return {
            tabs: [
                'Folders',
                'Albums',
                'Artists'
            ],
            activeTab: 'Folders',
            navItems: [
                {
                    name: 'Your Library',
                    icon: 'fas fa-music'
                },
                {
                    name: 'Browse',
                    icon: 'fas fa-search'
                }
            ],
            activeNavItem: 'Your Library',
            currentData: null,
            dataNavigationStack: [],
            selectedTrack: null,
            search: ''
        }
    },
    computed: {
        computedData() {
            if(this.activeTab === 'Folders') {
                let data = this.currentData

                if(this.search) {
                    data = data.filter(item => item.name.toLowerCase().includes(this.search.toLowerCase()))
                }

                return data
            }

            if(this.activeTab === 'Albums') {
                let data = this.currentData

                if(this.search) {
                    data = data.filter(item => {
                        if('id' in item === false) {
                            return this.generateAlbumTitle(item).toLowerCase().includes(this.search.toLowerCase())
                        } else {
                            return this.generateTrackTitle(item).toLowerCase().includes(this.search.toLowerCase())
                        }
                    })
                }

                return data
            }

            if(this.activeTab === 'Artists') {
                let data = this.currentData

                if(this.search) {
                    data = data.filter(item => {
                        if('id' in item === false) {
                            return item.artist && item.artist.toLowerCase().includes(this.search.toLowerCase())
                        } else {
                            return this.generateTrackTitle(item).toLowerCase().includes(this.search.toLowerCase())
                        }
                    })
                }

                return data
            }
        },
        API_URL() {
            return API_URL
        }
    },
    watch: {
        activeTab() {
            switch(this.activeTab) {
                case 'Folders':
                    this.fetchFolders()
                    break
                case 'Albums':
                    this.fetchAlbums()
                    break
                case 'Artists':
                    this.fetchArtists()
                    break
            }
        }
    },
    methods: {
        async fetchFolders() {
            this.currentData = await fetchFolders()
            this.dataNavigationStack = []
            this.dataNavigationStack.push(this.currentData)
        },
        async fetchAlbums() {
            this.currentData = await fetchAlbums()
            this.dataNavigationStack = []
            this.dataNavigationStack.push(this.currentData)
        },
        async fetchArtists() {
            this.currentData = await fetchArtists()
            this.dataNavigationStack = []
            this.dataNavigationStack.push(this.currentData)
        },
        handleClick(item) {
            switch(this.activeTab) {
                case 'Folders':
                    this.handleFolderClick(item)
                    break
                case 'Albums':
                    this.handleAlbumClick(item)
                    break
                case 'Artists':
                    this.handleArtistClick(item)
                    break
            }
        },
        handleFolderClick(item) {
            if(item.children.length === 0) {
                this.playTrack(item)
                return
            }
            this.dataNavigationStack.push(item.children)
            this.currentData = item.children
        },
        async handleAlbumClick(item) {
            if('id' in item) {
                this.playTrack(item)
                return
            }
            this.currentData = await fetchAlbum(item.artist, item.album)
            this.dataNavigationStack.push(this.currentData)
            this.search = ''
        },
        async handleArtistClick(item) {
            if('id' in item) {
                this.playTrack(item)
                return
            }
            this.currentData = await fetchArtist(item.artist)
            this.dataNavigationStack.push(this.currentData)
            this.search = ''
        },
        navigateUp() {
            this.dataNavigationStack.pop()
            this.currentData = this.dataNavigationStack[this.dataNavigationStack.length - 1]
        },
        encodeURIComponent,
        handleEnd() {
            this.handleNext()
        },
        handlePrevious() {
            const selectedTrackIndex = this.currentData.findIndex(item => item.path === this.selectedTrack.path)
            let previousTrackIndex = selectedTrackIndex - 1
            if(previousTrackIndex > -1) {
                this.playTrack(this.currentData[previousTrackIndex])
            }
        },
        handleNext() {
            const selectedTrackIndex = this.currentData.findIndex(item => item.path === this.selectedTrack.path)
            let nextTrackIndex = selectedTrackIndex + 1
            if(nextTrackIndex < this.currentData.length) {
                this.playTrack(this.currentData[nextTrackIndex])
            }
        },
        playTrack(track) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist ?? undefined,
                album: track.album ?? undefined,
                artwork: [
                    { src: `${API_URL}/track-cover?path=${this.encodeURIComponent(track.path)}` }
                ]
            })

            this.selectedTrack = track
        },
        generateAlbumTitle(item) {
            let albumTitle = ''

            if(item.artist) {
                albumTitle += `${item.artist} - `
            }

            albumTitle += `${item.album}`

            if(item.year) {
                albumTitle += ` (${item.year})`
            }

            return albumTitle
        },
        generateTrackTitle(item) {
            let trackTitle = ''

            if(this.activeTab === 'Folders') {
                trackTitle = item.name
            }

            if(this.activeTab === 'Albums') {
                if(item.track_no) {
                    trackTitle += `${item.track_no} - `
                }

                if(item.artist) {
                    trackTitle += `${item.artist} - `
                }

                trackTitle += item.title
            }

            if(this.activeTab === 'Artists') {
                if(item.artist) {
                    trackTitle += `${item.artist} - `
                }

                trackTitle += item.title
            }

            return trackTitle
        }
    },
    created() {
        this.fetchFolders()
    }
}
</script>

<style scoped>
main {
    height: 100%;

    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto auto;
    grid-template-areas:
        'search-bar'
        'tabs'
        'list'
        'player'
        'nav-bar'
    ;

    background: var(--background-color);
    color: var(--text-color);
}

main > .search-bar {
  grid-area: search-bar;
}

main > .tabs {
  grid-area: tabs;
}

main > .list {
  grid-area: list;
}

main > .player {
  grid-area: player;
}

main > .nav-bar {
  grid-area: nav-bar;
}

.search-bar {
    display: flex;
    padding: 1rem;
}

.search-bar > input {
    outline: 0;
    border: 0;
    border-bottom: 1px solid var(--default-border-color);
    padding: 0.5rem;
    background-color: var(--search-background-color);
    color: var(--tab-active-text-color);
    font-weight: 500;
    width: 100%;
    border-radius: 3px;
}

.settings {
    font-size: 1.2rem;
    margin-left: 1rem;
    display: flex;
    align-items: center;
}

.tabs {
    display: flex;
    padding-top: 0.5rem;
    padding-left: 1rem;
    padding-bottom: 0.5rem;
    /* border-bottom: 1px solid var(--default-border-color); */
    justify-content: center;
}

.tab {
    border-top: 1px solid var(--default-border-color);
    border-bottom: 1px solid var(--default-border-color);
    border-right: 1px solid var(--default-border-color);
    padding: 0.5rem 1rem;
}

.tab:first-child {
    border-left: 1px solid var(--default-border-color);
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
}

.tab:last-child {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
}

.tab-active {
    background-color: var(--tab-active-background-color);
    color: var(--tab-active-text-color);
    font-weight: 500;
    border: 1px solid transparent;
}

.list {
    overflow-y: auto;
    padding-top: 0.5rem;
    padding-bottom: 1rem;
}

.list-item {
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
}

.list-item-active {
    background-color: #ffffff17;
}

.nav-bar {
    display: flex;
    border-top: 1px solid var(--default-border-color);
}

.nav-bar-item {
    border-right: 1px solid var(--default-border-color);
    padding: 1rem;
    width: 100%;
    text-align: center;
}

.nav-bar-item-active {
    background-color: var(--nav-item-active-background-color);
    font-weight: 500;
}
</style>
