import Database from 'better-sqlite3'
import chokidar from 'chokidar'
import audioExtensions from 'audio-extensions' with { type: 'json' }
import { parseFile, selectCover } from 'music-metadata'
import { readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

const extensions = new Set(audioExtensions.map(extension => `.${extension.toLowerCase()}`))
const compareNames = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
const trackPathKey = filePath => process.platform === 'win32'
    ? path.normalize(filePath).replace(/^[a-z]:/, drive => drive.toUpperCase()) : path.normalize(filePath)

export function isInside(root, filePath) {
    const relative = path.relative(root, filePath)
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

function httpError(status, message) {
    return Object.assign(new Error(message), { status })
}

export class MusicLibrary {
    constructor({ musicDirectory, databasePath = ':memory:', onError = console.error }) {
        this.musicDirectory = path.resolve(musicDirectory)
        this.musicDirectoryReal = this.musicDirectory
        this.onError = onError
        this.database = new Database(databasePath)
        this.databasePath = databasePath === ':memory:' ? null : path.resolve(databasePath)
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS library (
                id INTEGER PRIMARY KEY, path TEXT UNIQUE, mtime INTEGER, title TEXT,
                artist TEXT, album TEXT, year INTEGER, duration INTEGER, track_no INTEGER,
                disk INTEGER DEFAULT 1, tags TEXT, is_vbr INTEGER DEFAULT 0,
                bitrate INTEGER, codec TEXT, container TEXT
            );
        `)
        const columns = this.database.pragma('table_info(library)').map(column => column.name)
        if (!columns.includes('album_artist')) this.database.exec('ALTER TABLE library ADD COLUMN album_artist TEXT')
        if (!columns.includes('metadata_version')) this.database.exec('ALTER TABLE library ADD COLUMN metadata_version INTEGER NOT NULL DEFAULT 0')
        this.database.exec('CREATE INDEX IF NOT EXISTS library_album ON library(COALESCE(album_artist, artist), album)')
        this.status = { syncing: false, lastAttempt: null, lastSuccess: null, error: null }
        this.upsert = this.database.prepare(`
            INSERT INTO library (path, mtime, title, artist, album_artist, album, year, duration,
                track_no, disk, tags, is_vbr, bitrate, codec, container, metadata_version)
            VALUES (@path, @mtime, @title, @artist, @album_artist, @album, @year, @duration,
                @track_no, @disk, @tags, @is_vbr, @bitrate, @codec, @container, 1)
            ON CONFLICT(path) DO UPDATE SET mtime=excluded.mtime, title=excluded.title,
                artist=excluded.artist, album_artist=excluded.album_artist, album=excluded.album,
                year=excluded.year, duration=excluded.duration, track_no=excluded.track_no,
                disk=excluded.disk, tags=excluded.tags, is_vbr=excluded.is_vbr,
                bitrate=excluded.bitrate, codec=excluded.codec, container=excluded.container,
                metadata_version=1
        `)
    }

    async start() {
        this.musicDirectoryReal = await realpath(this.musicDirectory)
        if (!(await stat(this.musicDirectory)).isDirectory()) throw new Error('MUSIC_DIRECTORY must be a directory')
        this.watcher = chokidar.watch(this.musicDirectoryReal, {
            ignoreInitial: true,
            followSymlinks: false,
            // Windows network shares may not support native watch events.
            usePolling: process.platform === 'win32' && this.musicDirectoryReal.startsWith('\\\\'),
            interval: 30000,
            binaryInterval: 30000,
            // Wait for a file copy to settle before parsing its tags.
            awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
        })
        this.watcher.on('all', (event, filePath) => {
            if (this.closed) return
            if (this.databasePath && (path.resolve(filePath) === this.databasePath || path.resolve(filePath).startsWith(`${this.databasePath}-`))) return
            if (!event.endsWith('Dir') && !extensions.has(path.extname(filePath).toLowerCase())) return
            this.refreshAgain = true
            clearTimeout(this.refreshTimer)
            this.refreshTimer = setTimeout(() => this.refresh().catch(this.onError), 100)
        })
        this.watcher.on('error', error => this.onError(error))
        console.log('Initializing music folder watcher...')
        await new Promise((resolve, reject) => {
            this.watcher.once('ready', resolve)
            this.watcher.once('error', reject)
        })
        console.log('Scanning music library...')
        await this.refresh()
    }

    refresh() {
        if (this.closed) return Promise.reject(new Error('Music library is closed'))
        if (this.refreshPromise) return this.refreshPromise
        this.refreshPromise = (async () => {
            do {
                this.refreshAgain = false
                await this.scan()
            } while (this.refreshAgain && !this.closed)
            return this.status
        })().finally(() => { this.refreshPromise = null })
        return this.refreshPromise
    }

    async scan() {
        this.status = { ...this.status, syncing: true, lastAttempt: new Date().toISOString(), error: null }
        try {
            const files = new Map()
            const visited = new Set()
            const walk = async directory => {
                const directoryReal = await realpath(directory)
                if (!isInside(this.musicDirectoryReal, directoryReal) || visited.has(directoryReal)) return
                visited.add(directoryReal)
                for (const entry of await readdir(directory, { withFileTypes: true })) {
                    const filePath = path.join(directory, entry.name)
                    let fileStat
                    try {
                        if (!isInside(this.musicDirectoryReal, await realpath(filePath))) continue
                        fileStat = await stat(filePath)
                    } catch (error) {
                        if (error.code === 'ENOENT') continue
                        throw error
                    }
                    if (fileStat.isDirectory()) await walk(filePath)
                    else if (fileStat.isFile() && extensions.has(path.extname(filePath).toLowerCase())) {
                        files.set(filePath, Math.floor(fileStat.mtimeMs))
                    }
                }
            }
            await walk(this.musicDirectory)
            const existing = this.database.prepare('SELECT path, mtime, metadata_version, duration FROM library').all()
            const existingByPath = new Map(existing.map(track => [trackPathKey(track.path), track]))
            for (const track of existing) if (files.has(track.path)) existingByPath.set(trackPathKey(track.path), track)
            const pathUpdates = []
            const updates = []
            for (const [filePath, mtime] of files) {
                const previous = existingByPath.get(trackPathKey(filePath))
                if (previous && previous.path !== filePath) pathUpdates.push({ path: previous.path, pathResolved: filePath })
                if (previous?.mtime === mtime && previous.metadata_version === 1) continue
                let common = {}, format = {}
                try {
                    const metadata = await parseFile(filePath, { skipCovers: true })
                    common = metadata.common
                    format = metadata.format
                } catch (error) {
                    if (error.code === 'ENOENT') { files.delete(filePath); continue }
                    this.onError(new Error(`Could not read tags for ${filePath}: ${error.message}`))
                    if (previous?.mtime === mtime) continue
                }
                updates.push({
                    path: filePath, mtime, title: common.title || path.basename(filePath),
                    artist: common.artists?.join(',') || common.artist || null,
                    album_artist: common.albumartist || common.artists?.join(',') || common.artist || null,
                    album: common.album || null, year: common.year || null,
                    duration: Number.isFinite(format.duration) ? Math.round(format.duration) : previous?.mtime === mtime ? previous.duration : null,
                    track_no: common.track?.no || null, disk: common.disk?.no || 1,
                    tags: common.genre ? JSON.stringify(common.genre) : null,
                    is_vbr: /^V/i.test(format.codecProfile || '') ? 1 : 0,
                    bitrate: Number.isFinite(format.bitrate) ? Math.floor(format.bitrate / 1000) : null,
                    codec: format.codec || null, container: format.container || null
                })
            }
            const remove = this.database.prepare('DELETE FROM library WHERE path = ?')
            const updatePath = this.database.prepare('UPDATE library SET path = ? WHERE path = ?')
            this.database.transaction(() => {
                for (const track of pathUpdates) if (files.has(track.pathResolved)) updatePath.run(track.pathResolved, track.path)
                for (const track of updates) this.upsert.run(track)
                for (const track of existing) if (!files.has(track.path)) remove.run(track.path)
            })()
            this.status = { ...this.status, syncing: false, lastSuccess: new Date().toISOString() }
        } catch (error) {
            this.status = { ...this.status, syncing: false, error: error.message }
            throw error
        }
        return this.status
    }

    publicTrack(track) {
        return { ...track, path: path.relative(this.musicDirectory, track.path).split(path.sep).join('/') }
    }

    folders() {
        const root = { children: [], folders: new Map() }
        for (const track of this.database.prepare('SELECT * FROM library').all()) {
            if (!isInside(this.musicDirectory, track.path)) continue
            const trackPublic = this.publicTrack(track)
            const parts = trackPublic.path.split('/')
            let parent = root
            for (const [index, name] of parts.entries()) {
                if (index === parts.length - 1) parent.children.push({ ...trackPublic, name, children: [] })
                else {
                    if (!parent.folders.has(name)) {
                        const folder = { name, path: parts.slice(0, index + 1).join('/'), children: [], folders: new Map() }
                        parent.folders.set(name, folder)
                        parent.children.push(folder)
                    }
                    parent = parent.folders.get(name)
                }
            }
        }
        const tidy = folder => folder.children.sort((a, b) => compareNames(a.name, b.name)).map(child => {
            if (!child.folders) return child
            return { name: child.name, path: child.path, children: tidy(child) }
        })
        return tidy(root)
    }

    albums() {
        return this.database.prepare(`SELECT COALESCE(album_artist, artist) AS album_artist,
            COALESCE(album_artist, artist) AS artist, album, MIN(year) AS year
            FROM library GROUP BY COALESCE(album_artist, artist), album ORDER BY artist, album`).all()
    }

    artists() {
        return this.database.prepare('SELECT DISTINCT artist FROM library ORDER BY artist').all()
    }

    album(artist, album) {
        return this.database.prepare(`SELECT * FROM library WHERE COALESCE(album_artist, artist) IS ? AND album IS ?
            ORDER BY disk, track_no IS NULL, track_no, path`).all(artist, album).map(track => this.publicTrack(track))
    }

    artist(artist) {
        return this.database.prepare(`SELECT * FROM library WHERE artist IS ?
            ORDER BY album, disk, track_no IS NULL, track_no, path`).all(artist).map(track => this.publicTrack(track))
    }

    async trackFile(query) {
        let track
        if (query.id !== undefined) {
            if (typeof query.id !== 'string' || !/^[1-9]\d*$/.test(query.id)) throw httpError(400, 'A valid track ID is required')
            track = this.database.prepare('SELECT * FROM library WHERE id = ?').get(query.id)
        } else {
            if (typeof query.path !== 'string' || !query.path || query.path.includes('\0')) throw httpError(400, 'A track ID or path is required')
            // Older clients send a relative path with a leading separator.
            const trackPath = path.resolve(this.musicDirectory, query.path.replaceAll('\\', '/').replace(/^\/+/, ''))
            if (!isInside(this.musicDirectory, trackPath)) throw httpError(403, 'Track is outside the music directory')
            track = this.database.prepare('SELECT * FROM library WHERE path = ?').get(trackPath)
        }
        if (!track) throw httpError(404, 'Track not found')
        const trackPath = await realpath(track.path)
        if (!isInside(this.musicDirectoryReal, trackPath)) throw httpError(403, 'Track is outside the music directory')
        if (!(await stat(trackPath)).isFile()) throw httpError(404, 'Track not found')
        return trackPath
    }

    async cover(trackPath) {
        const fileStat = await stat(trackPath)
        if (this.coverCache?.path !== trackPath || this.coverCache.mtime !== fileStat.mtimeMs) {
            const picture = parseFile(trackPath).then(metadata => selectCover(metadata.common.picture)).catch(error => {
                this.onError(new Error(`Could not read cover for ${trackPath}: ${error.message}`))
                return null
            })
            // Cache the current track's embedded art, rather than retaining art for the entire library.
            this.coverCache = { path: trackPath, mtime: fileStat.mtimeMs, picture }
        }
        const picture = await this.coverCache.picture
        if (picture) return { data: Buffer.from(picture.data), type: picture.format }
        const directory = path.dirname(trackPath)
        const coverName = (await readdir(directory)).sort(compareNames).find(name => /^cover\.(png|jpe?g|webp)$/i.test(name))
        if (!coverName) throw httpError(404, 'Cover not found')
        const coverPath = await realpath(path.join(directory, coverName))
        if (!isInside(this.musicDirectoryReal, coverPath)) throw httpError(403, 'Cover is outside the music directory')
        return { path: coverPath }
    }

    async close() {
        this.closed = true
        clearTimeout(this.refreshTimer)
        await this.watcher?.close()
        await this.refreshPromise?.catch(() => {})
        if (this.database.open) this.database.close()
    }
}
