<template>
    <main>
        <div class="search-bar">
            <input type="search" placeholder="Search all music..." aria-label="Search all music" :value="search" @input="searchChanged($event.target.value)" @keydown.esc.prevent="searchChanged('')">
            <Settings />
        </div>
        <nav class="tabs" aria-label="Library views">
            <button class="tab" type="button" v-for="tab in tabs" :key="tab" @click="switchTab(tab)" @keydown="handleTabKey($event, tab)"
                :aria-pressed="!isSearching && tab === activeTab" :class="{ 'tab-active': !isSearching && tab === activeTab }">{{ tab }}</button>
        </nav>
        <div class="list" ref="list" @scroll="saveScroll" :aria-busy="displayView.loading">
            <div v-if="refreshError" class="status error" role="alert">
                <span>{{ refreshError }}</span>
                <button type="button" @click="refresh">Try refresh again</button>
            </div>
            <p v-if="refreshMessage" class="status" role="status">{{ refreshMessage }}</p>
            <button class="list-item back-button" type="button" v-if="!isSearching && activeView.route.length" @click="navigateUp">
                <i class="fas fa-arrow-left" aria-hidden="true"></i><span>Go back</span>
            </button>
            <div v-if="displayView.error" class="status error" role="alert">
                <span>{{ displayView.error }}</span>
                <button type="button" @click="loadTab(isSearching ? 'Folders' : activeTab, true)">Try again</button>
            </div>
            <p v-if="displayView.loading" class="status" role="status">Loading library...</p>
            <div v-else-if="!displayView.error && computedData.length === 0" class="status empty-state">
                <p>{{ isSearching ? 'No matches.' : 'No music here.' }}</p>
                <button v-if="!isSearching && !activeView.route.length && !refreshError" class="rescan-button" type="button" @click="refresh" :disabled="refreshing">
                    {{ refreshing ? 'Rescanning...' : 'Rescan music folder' }}
                </button>
            </div>
            <LibraryList v-else-if="computedData.length > 0" ref="libraryList" :items="computedData" :virtual="isSearching"
                :scroll-element="$refs.list" :item-key="itemKey" :aria-label="isSearching ? 'Search results' : 'Library items'">
                <template #default="{ item }">
                    <div class="list-item-row" @contextmenu.prevent.stop="openItemMenu(item, $event)">
                    <button class="list-item" type="button" :data-path="item.path" @click="handleClick(item)"
                        :class="{ 'list-item-active': isTrack(item) && selectedTrack?.path === item.path }"
                        :aria-current="isTrack(item) && selectedTrack?.path === item.path ? 'true' : undefined">
                        <i :class="itemIcon(item)" aria-hidden="true"></i>
                        <span v-if="isSearching" class="search-result-text"><span class="search-result-title">{{ itemTitle(item) }}</span><span class="search-result-details">{{ searchDetails(item) }}</span></span>
                        <span v-else>{{ itemTitle(item) }}</span>
                    </button>
                    <button class="item-options" type="button" :aria-label="`Options for ${itemTitle(item)}`"
                        aria-haspopup="menu" :aria-expanded="contextMenu?.item === item"
                        @click.stop="openItemMenu(item, $event, true)"><span aria-hidden="true">⋮</span></button>
                    </div>
                </template>
            </LibraryList>
        </div>
        <div class="player" v-if="selectedTrack">
            <AudioPlayer ref="audioPlayer" :track="selectedTrack" :src="trackUrl(selectedTrack)"
                :cover-src="trackUrl(selectedTrack, true)" :shuffle="shuffle" :repeat="repeat"
                :can-previous="canPrevious" :can-next="canNext"
                :autoplay="autoplay" :initial-position="playbackPosition"
                @shuffle="setShuffle" @repeat="setRepeat" @position="savePlaybackPosition"
                @ended="handleEnd" @previous="handlePrevious" @next="handleNext" />
        </div>
        <footer class="nav-bar"><span class="nav-bar-item"><i class="fas fa-music" aria-hidden="true"></i> Your Library</span></footer>
        <ItemContextMenu :visible="!!contextMenu" :actions="contextActions" :opener="contextMenu?.opener" :position="contextMenu?.position || { x: 0, y: 0 }"
            @select="navigateFromMenu" @close="closeItemMenu" />
    </main>
</template>

<script>
import AudioPlayer from '@/components/AudioPlayer.vue'
import Settings from '@/components/Settings.vue'
import LibraryList from '@/components/LibraryList.vue'
import ItemContextMenu from '@/components/ItemContextMenu.vue'
import { API_URL, fetchFolders, fetchAlbums, fetchArtists, fetchAlbum, fetchArtist, refreshLibrary, trackUrl } from '@/api'
import { markRaw, nextTick } from 'vue'
import { shuffleLocalStorageKey, repeatLocalStorageKey } from '@/constants'
import { isTrack, flattenTracks, playbackOrder, adjacentTrackPath } from '@/playback'
import { createSearchIndex, searchTracks } from '@/search'

const tabs = ['Folders', 'Albums', 'Artists']
const resumeStorageKey = `Treble-Resume:${API_URL}`

function readStorage(storageName, key) {
    try { return window[storageName].getItem(key) } catch { return null }
}
function writeStorage(storageName, key, value) {
    try { window[storageName].setItem(key, value) } catch { /* Playback still works if storage is unavailable. */ }
}
function readResume() {
    try { return JSON.parse(readStorage('sessionStorage', resumeStorageKey)) || {} } catch { return {} }
}
function createView(saved = {}) {
    if (!saved || typeof saved !== 'object') saved = {}
    return {
        root: [], stack: [], route: Array.isArray(saved.route) ? saved.route.filter(item => item && typeof item === 'object') : [],
        scroll: Number.isFinite(saved.scroll) ? Math.max(0, saved.scroll) : 0,
        loaded: false, loading: false, error: '', request: 0
    }
}

export default {
    components: { AudioPlayer, Settings, LibraryList, ItemContextMenu },
    data() {
        const saved = readResume()
        return {
            tabs, activeTab: tabs.includes(saved.activeTab) ? saved.activeTab : 'Folders',
            views: Object.fromEntries(tabs.map(tab => [tab, createView(saved.views?.[tab])])),
            search: typeof saved.search === 'string' ? saved.search : '',
            searchIndex: markRaw([]),
            contextMenu: null,
            searchScroll: Number.isFinite(saved.searchScroll) ? Math.max(0, saved.searchScroll) : 0,
            searchAnchor: typeof saved.searchAnchor?.key === 'string' && Number.isFinite(saved.searchAnchor.offset)
                ? { key: saved.searchAnchor.key, offset: saved.searchAnchor.offset } : null,
            selectedTrack: null, queue: [], queueOrder: [], playbackPosition: 0, autoplay: false,
            shuffle: readStorage('localStorage', shuffleLocalStorageKey) === 'true',
            repeat: ['none', 'one', 'all'].includes(readStorage('localStorage', repeatLocalStorageKey))
                ? readStorage('localStorage', repeatLocalStorageKey) : 'none',
            savedPlayback: saved.playback, resumeRestored: false,
            refreshing: false, refreshError: '', refreshMessage: '', disposed: false
        }
    },
    computed: {
        activeView() { return this.views[this.activeTab] },
        isSearching() { return this.search.trim().length > 0 },
        displayView() { return this.isSearching ? this.views.Folders : this.activeView },
        currentData() { return this.activeView.stack.at(-1) || [] },
        canPrevious() { return adjacentTrackPath(this.queueOrder, this.selectedTrack?.path, -1, this.repeat) !== null },
        canNext() { return adjacentTrackPath(this.queueOrder, this.selectedTrack?.path, 1, this.repeat) !== null },
        computedData() {
            return this.isSearching ? searchTracks(this.searchIndex, this.search) : this.currentData
        },
        contextActions() {
            if (!this.contextMenu) return []
            const { item, tab } = this.contextMenu
            if (isTrack(item)) return [
                ...(item.album ? [{ id: 'album', label: 'Go to album' }] : []),
                ...(item.artist ? [{ id: 'artist', label: 'Go to artist' }] : []),
                { id: 'folder', label: 'Show in folder' }
            ]
            return [{ id: { Folders: 'folder', Albums: 'album', Artists: 'artist' }[tab],
                label: { Folders: 'Open folder', Albums: 'Open album', Artists: 'Open artist' }[tab] }]
        }
    },
    methods: {
        isTrack, trackUrl,
        itemKey(item, index) { return isTrack(item) ? item.path : `${item.path || this.itemTitle(item)}:${index}` },
        itemIcon(item) { return isTrack(item) ? 'fas fa-music' : this.activeTab === 'Artists' ? 'fas fa-user' : 'fas fa-folder' },
        itemTitle(item) {
            if (this.isSearching) return item.title || item.name || item.path.split(/[\\/]/).pop()
            if (this.activeTab === 'Folders') return item.name || item.title || item.path
            if (isTrack(item)) return this.generateTrackTitle(item)
            if (this.activeTab === 'Artists') return item.artist || 'Unknown artist'
            return this.generateAlbumTitle(item)
        },
        searchDetails(item) { return [item.artist || item.album_artist, item.album].filter(Boolean).join(' · ') || item.path },
        generateAlbumTitle(item) {
            const artist = item.album_artist ?? item.artist
            return `${artist ? `${artist} - ` : ''}${item.album || 'Unknown album'}${item.year ? ` (${item.year})` : ''}`
        },
        generateTrackTitle(item) {
            return `${this.activeTab === 'Albums' && item.track_no ? `${item.track_no} - ` : ''}${item.artist ? `${item.artist} - ` : ''}${item.title || item.name || item.path?.split(/[\\/]/).pop() || 'Unknown track'}`
        },
        openItemMenu(item, event, fromButton = false) {
            const row = event.currentTarget.closest('.list-item-row')
            const opener = row.querySelector('.item-options')
            if (fromButton && this.contextMenu?.opener === opener) {
                this.closeItemMenu({ restoreFocus: true })
                return
            }
            const bounds = opener.getBoundingClientRect()
            const position = fromButton || (!event.clientX && !event.clientY)
                ? { x: bounds.right, y: bounds.bottom } : { x: event.clientX, y: event.clientY }
            this.contextMenu = markRaw({ item, tab: this.activeTab, opener, position })
        },
        closeItemMenu({ restoreFocus = false } = {}) {
            const opener = this.contextMenu?.opener
            this.contextMenu = null
            if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true })
        },
        async navigateFromMenu(action) {
            const item = this.contextMenu?.item
            if (!item) return
            this.closeItemMenu()
            this.saveScroll()
            this.search = ''
            this.searchScroll = 0
            this.searchAnchor = null
            const tab = { album: 'Albums', artist: 'Artists', folder: 'Folders' }[action]
            if (!tab) return
            this.activeTab = tab
            const view = this.views[tab]
            view.scroll = 0
            if (action === 'folder') {
                await this.loadTab('Folders')
                if (this.disposed || this.activeTab !== tab || this.isSearching || !view.loaded) return
                ++view.request
                const parts = item.path.replace(/\\/g, '/').split('/')
                if (isTrack(item)) parts.pop()
                let data = view.root
                const route = [], stack = [data]
                for (const name of parts) {
                    const folder = data.find(entry => !isTrack(entry) && entry.name === name)
                    if (!folder) {
                        view.error = 'That folder is no longer in the library. Refresh and try again.'
                        return
                    }
                    route.push({ path: folder.path, name: folder.name })
                    data = folder.children
                    stack.push(data)
                }
                view.route = route
                view.stack = stack
                view.loading = false
                view.error = ''
            } else {
                view.route = [action === 'album'
                    ? { artist: item.album_artist ?? item.artist ?? null, album: item.album ?? null }
                    : { artist: item.artist ?? null }]
                const loading = this.loadTab(tab, true)
                const request = view.request
                await loading
                if (request !== view.request) return
            }
            this.persist()
            await this.restoreScroll(tab)
            if (this.disposed || this.activeTab !== tab || this.isSearching) return
            const target = isTrack(item)
                ? [...this.$refs.list.querySelectorAll('.list-item')].find(button => button.dataset.path === item.path)
                : this.$refs.list.querySelector('.list-item')
            target?.focus()
            target?.scrollIntoView?.({ block: 'nearest' })
        },
        persist() {
            if (this.disposed) return
            writeStorage('sessionStorage', resumeStorageKey, JSON.stringify({
                activeTab: this.activeTab,
                search: this.search, searchScroll: this.searchScroll, searchAnchor: this.searchAnchor,
                views: Object.fromEntries(tabs.map(tab => [tab, {
                    route: this.views[tab].route, scroll: this.views[tab].scroll
                }])),
                playback: this.resumeRestored ? {
                    paths: this.queue.map(track => track.path), order: this.queueOrder,
                    selectedPath: this.selectedTrack?.path, position: this.playbackPosition
                } : this.savedPlayback
            }))
        },
        saveScroll() {
            if (this.$refs.list && !this.displayView.loading) {
                if (this.isSearching) {
                    this.searchScroll = this.$refs.list.scrollTop
                    this.searchAnchor = this.$refs.libraryList?.getScrollAnchor() || null
                }
                else this.activeView.scroll = this.$refs.list.scrollTop
            }
            this.persist()
        },
        async restoreScroll(tab) {
            const search = this.search
            const searchScroll = this.searchScroll
            const searchAnchor = this.searchAnchor
            await nextTick()
            if (!this.$refs.list || this.disposed || search !== this.search) return
            if (this.isSearching) {
                if (tab === 'Folders') {
                    if (searchAnchor && this.$refs.libraryList) {
                        const restored = await this.$refs.libraryList.restoreScrollAnchor(searchAnchor)
                        if (restored || !this.$refs.list || this.disposed || search !== this.search) return
                    }
                    this.$refs.list.scrollTop = searchScroll
                }
            } else if (this.activeTab === tab) this.$refs.list.scrollTop = this.views[tab].scroll
        },
        searchChanged(value) {
            const wasSearching = this.isSearching
            if (!wasSearching) this.saveScroll()
            this.search = value
            this.searchScroll = 0
            this.searchAnchor = null
            if (this.isSearching) {
                if (this.$refs.list) this.$refs.list.scrollTop = 0
                if (!wasSearching && !this.views.Folders.loading) {
                    this.loadTab('Folders', true, this.views.Folders.loaded && !this.views.Folders.error)
                }
                this.restoreScroll('Folders')
            } else if (wasSearching) this.restoreScroll(this.activeTab)
            this.persist()
        },
        switchTab(tab) {
            if (tab === this.activeTab) {
                if (this.isSearching) this.searchChanged('')
                return
            }
            this.saveScroll()
            this.search = ''
            this.searchScroll = 0
            this.searchAnchor = null
            this.activeTab = tab
            this.persist()
            if (!this.views[tab].loading) this.loadTab(tab, true, this.views[tab].loaded && !this.views[tab].error)
            this.restoreScroll(tab)
        },
        handleTabKey(event, tab) {
            let index = this.tabs.indexOf(tab)
            if (event.key === 'ArrowLeft') index = (index + this.tabs.length - 1) % this.tabs.length
            else if (event.key === 'ArrowRight') index = (index + 1) % this.tabs.length
            else if (event.key === 'Home') index = 0
            else if (event.key === 'End') index = this.tabs.length - 1
            else return
            event.preventDefault()
            this.switchTab(this.tabs[index])
            event.currentTarget.parentElement.querySelectorAll('button')[index].focus()
        },
        async loadTab(tab, force = false, keepCurrentData = false) {
            const view = this.views[tab]
            if (view.loaded && !force) return
            const request = ++view.request
            view.loading = !keepCurrentData
            view.error = ''
            try {
                const root = await ({ Folders: fetchFolders, Albums: fetchAlbums, Artists: fetchArtists })[tab]()
                if (request !== view.request || this.disposed) return
                if (!Array.isArray(root)) throw new Error('The music server returned an invalid library. Try refreshing it.')
                // API responses are replaced as snapshots, never edited in place.
                markRaw(root)
                const stack = [root]
                const validRoute = []
                if (tab === 'Folders') {
                    // Prepare search data when the snapshot arrives, before the next keystroke.
                    this.searchIndex = markRaw(createSearchIndex(flattenTracks(root)))
                    let data = root
                    for (const savedFolder of view.route) {
                        const folder = data.find(item => !isTrack(item) && (item.path === savedFolder.path || item.name === savedFolder.name))
                        if (!folder) break
                        validRoute.push({ path: folder.path, name: folder.name })
                        data = folder.children
                        stack.push(data)
                    }
                    this.restorePlayback(root)
                } else if (view.route.length) {
                    const savedItem = view.route[0]
                    const item = root.find(item => tab === 'Albums'
                        ? (item.album_artist ?? item.artist) === savedItem.artist && item.album === savedItem.album
                        : item.artist === savedItem.artist)
                    if (item) {
                        const data = await (tab === 'Albums' ? fetchAlbum(savedItem.artist, savedItem.album) : fetchArtist(savedItem.artist))
                        if (request !== view.request || this.disposed) return
                        if (!Array.isArray(data)) throw new Error('The music server returned an invalid library. Try refreshing it.')
                        validRoute.push(savedItem)
                        stack.push(data)
                    }
                }
                view.root = root
                view.route = validRoute
                view.stack = stack
                view.loaded = true
            } catch (error) {
                if (request === view.request && !this.disposed) view.error = error.message || 'Could not load the library. Try again.'
            } finally {
                if (request === view.request && !this.disposed) {
                    view.loading = false
                    this.persist()
                    this.restoreScroll(tab)
                }
            }
        },
        async handleClick(item) {
            if (this.displayView.loading) return
            if (isTrack(item)) {
                this.queue = this.computedData.filter(isTrack)
                this.queueOrder = playbackOrder(this.queue, item.path, this.shuffle)
                this.playTrack(item)
                return
            }
            const tab = this.activeTab
            const view = this.views[tab]
            const request = ++view.request
            view.scroll = 0
            view.error = ''
            if (tab === 'Folders') {
                view.route.push({ path: item.path, name: item.name })
                view.stack.push(item.children)
                this.persist()
                this.restoreScroll(tab)
                return
            }
            view.route = [tab === 'Albums' ? { artist: item.album_artist ?? item.artist, album: item.album } : { artist: item.artist }]
            view.stack = [view.root]
            view.loading = true
            this.persist()
            try {
                const data = await (tab === 'Albums' ? fetchAlbum(item.album_artist ?? item.artist, item.album) : fetchArtist(item.artist))
                if (request !== view.request || this.disposed) return
                if (!Array.isArray(data)) throw new Error('The music server returned an invalid library. Try refreshing it.')
                view.stack.push(data)
            } catch (error) {
                if (request === view.request && !this.disposed) view.error = error.message || 'Could not load these tracks. Try again.'
            } finally {
                if (request === view.request && !this.disposed) {
                    view.loading = false
                    this.restoreScroll(tab)
                    this.persist()
                }
            }
        },
        navigateUp() {
            const view = this.activeView
            ++view.request
            view.loading = false
            view.error = ''
            view.route.pop()
            if (view.stack.length > 1) view.stack.pop()
            view.scroll = 0
            if (!view.loaded) this.loadTab(this.activeTab, true)
            else this.restoreScroll(this.activeTab)
            this.persist()
        },
        restorePlayback(folders) {
            const tracks = new Map(flattenTracks(folders).map(track => [track.path, track]))
            const saved = this.resumeRestored ? {
                paths: this.queue.map(track => track.path), order: this.queueOrder,
                selectedPath: this.selectedTrack?.path, position: this.playbackPosition
            } : this.savedPlayback
            if (saved && typeof saved === 'object') {
                this.queue = Array.isArray(saved.paths) ? [...new Set(saved.paths)].filter(path => tracks.has(path)).map(path => tracks.get(path)) : []
                const queuePaths = new Set(this.queue.map(track => track.path))
                this.queueOrder = this.shuffle && Array.isArray(saved.order)
                    ? [...new Set(saved.order)].filter(path => queuePaths.has(path)) : [...queuePaths]
                for (const path of queuePaths) if (!this.queueOrder.includes(path)) this.queueOrder.push(path)
                this.selectedTrack = queuePaths.has(saved.selectedPath) ? tracks.get(saved.selectedPath) : null
                this.playbackPosition = this.selectedTrack && Number.isFinite(saved.position) ? Math.max(0, saved.position) : 0
                this.updateMediaMetadata()
            }
            this.resumeRestored = true
            this.persist()
        },
        playTrack(track) {
            const sameTrack = this.selectedTrack?.path === track.path
            this.resumeRestored = true
            this.autoplay = true
            this.playbackPosition = 0
            this.selectedTrack = track
            this.updateMediaMetadata()
            if (sameTrack) this.$refs.audioPlayer?.replay()
            this.persist()
        },
        updateMediaMetadata() {
            if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
            try {
                const track = this.selectedTrack
                navigator.mediaSession.metadata = track ? new MediaMetadata({
                    title: track.title || track.name || '', artist: track.artist || '', album: track.album || '',
                    artwork: [{ src: new URL(trackUrl(track, true), window.location.href).href }]
                }) : null
            } catch { /* Metadata support varies between browsers. */ }
        },
        setShuffle(value) {
            this.shuffle = value
            this.queueOrder = playbackOrder(this.queue, this.selectedTrack?.path, value)
            writeStorage('localStorage', shuffleLocalStorageKey, String(value))
            this.persist()
        },
        setRepeat(value) {
            if (!['none', 'all', 'one'].includes(value)) return
            this.repeat = value
            writeStorage('localStorage', repeatLocalStorageKey, value)
            this.persist()
        },
        savePlaybackPosition(value) {
            if (!Number.isFinite(value)) return
            this.playbackPosition = Math.max(0, value)
            this.persist()
        },
        advance(direction, ended = false) {
            const path = adjacentTrackPath(this.queueOrder, this.selectedTrack?.path, direction, this.repeat, ended)
            const track = this.queue.find(track => track.path === path)
            if (track) this.playTrack(track)
        },
        handleEnd() { this.advance(1, true) },
        handlePrevious() { this.advance(-1) },
        handleNext() { this.advance(1) },
        async refresh() {
            if (this.refreshing) return
            this.refreshing = true
            this.refreshError = ''
            this.refreshMessage = ''
            try {
                await refreshLibrary()
                if (this.disposed) return
                for (const tab of tabs) { ++this.views[tab].request; this.views[tab].loaded = false; this.views[tab].loading = false }
                await this.loadTab('Folders', true)
                if (this.activeTab !== 'Folders') await this.loadTab(this.activeTab, true)
                if (!this.views.Folders.error && !this.activeView.error) this.refreshMessage = 'Library refreshed.'
            } catch (error) {
                if (!this.disposed) this.refreshError = error.message || 'Could not refresh the library. Try again.'
            } finally {
                if (!this.disposed) this.refreshing = false
            }
        }
    },
    created() {
        this.loadTab('Folders')
        if (this.activeTab !== 'Folders') this.loadTab(this.activeTab)
    },
    beforeUnmount() {
        this.saveScroll()
        this.persist()
        this.disposed = true
    }
}
</script>

<style scoped>
main {
    height: 100%; min-width: 0; min-height: 0;
    display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr) auto auto;
    grid-template-areas: 'search-bar' 'tabs' 'list' 'player' 'nav-bar';
    background: var(--background-color); color: var(--text-color);
}
main > .search-bar { grid-area: search-bar; }
main > .tabs { grid-area: tabs; }
main > .list { grid-area: list; }
main > .player { grid-area: player; min-width: 0; }
main > .nav-bar { grid-area: nav-bar; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--text-color); outline-offset: 2px; }
button:disabled { opacity: 0.5; cursor: default; }
.search-bar { display: flex; padding: 1rem; }
.search-bar > input {
    min-width: 0; flex: 1; outline: 0; border: 0; border-bottom: 1px solid var(--default-border-color); padding: 0.5rem;
    background-color: var(--search-background-color); color: var(--tab-active-text-color); font-weight: 500; border-radius: 3px;
}
.rescan-button { border: 1px solid var(--default-border-color); background: transparent; border-radius: 3px; padding: 0.4rem 0.6rem; }
.rescan-button:hover:not(:disabled), .error button:hover { background: #ffffff17; }
.tabs { display: flex; padding: 0.5rem 0 0.5rem 1rem; justify-content: center; }
.tab {
    background: transparent; border: 0; border-top: 1px solid var(--default-border-color);
    border-bottom: 1px solid var(--default-border-color); border-right: 1px solid var(--default-border-color); padding: 0.5rem 1rem;
}
.tab:first-child { border-left: 1px solid var(--default-border-color); border-radius: 4px 0 0 4px; }
.tab:last-child { border-radius: 0 4px 4px 0; }
.tab:hover:not(.tab-active) { background: #ffffff17; }
.tab-active { background-color: var(--tab-active-background-color); color: var(--tab-active-text-color); font-weight: 500; border: 1px solid transparent; }
.list { position: relative; overflow-y: auto; overflow-x: hidden; min-height: 0; padding-top: 0.5rem; padding-bottom: 1rem; }
.list ul { list-style: none; padding: 0; margin: 0; }
.list-item-row { position: relative; }
.list-item-row > .list-item { padding-right: 3rem; }
.item-options { position: absolute; right: 0.5rem; top: 0; bottom: 0; width: 2rem; border: 0; border-radius: 3px; background: transparent; font-size: 1.25rem; opacity: 0; pointer-events: none; }
.list-item-row:hover .item-options, .list-item-row:focus-within .item-options, .item-options[aria-expanded="true"] { opacity: 1; pointer-events: auto; }
.item-options:hover { background: #ffffff0c; }
@media (hover: none) { .item-options { opacity: 1; pointer-events: auto; } }
.list-item { display: flex; align-items: baseline; width: 100%; text-align: left; border: 0; background: transparent; padding: 0.5rem 1rem; }
.list-item > span { margin-left: 0.5rem; overflow-wrap: anywhere; min-width: 0; }
.search-result-text { display: flex; flex-direction: column; gap: 0.2rem; }
.search-result-title { font-weight: 500; }
.search-result-details { font-size: 0.9em; opacity: 0.75; }
.list-item:hover:not(.list-item-active) { background-color: #ffffff0c; }
.list-item-active { background-color: #ffffff17; }
.status { margin: 0; padding: 0.75rem 1rem; overflow-wrap: anywhere; }
.empty-state p { margin: 0 0 0.75rem; }
.error { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.error button { border: 1px solid var(--default-border-color); background: transparent; border-radius: 3px; padding: 0.4rem 0.6rem; }
.nav-bar { display: flex; border-top: 1px solid var(--default-border-color); }
.nav-bar-item { padding: 1rem; width: 100%; text-align: center; font-weight: 500; }
@media (max-width: 380px) {
    .tabs { padding-left: 0.5rem; padding-right: 0.5rem; }
    .tab { flex: 1; padding: 0.5rem; }
}
</style>
