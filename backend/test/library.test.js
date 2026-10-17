import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink, utimes } from 'node:fs/promises'
import { once } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { unlinkSync } from 'node:fs'
import Database from 'better-sqlite3'
import { MusicLibrary } from '../src/library.js'
import { createApp } from '../src/app.js'
import { getConfig, backendDirectory } from '../src/config.js'

export function wav(seconds = 2) {
    const samples = 8000 * seconds
    const buffer = Buffer.alloc(44 + samples * 2)
    buffer.write('RIFF')
    buffer.writeUInt32LE(buffer.length - 8, 4)
    buffer.write('WAVEfmt ', 8)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(8000, 24)
    buffer.writeUInt32LE(16000, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(samples * 2, 40)
    return buffer
}

async function fixture(t, { files = ['sample.wav'], legacy = false, legacyPath = file => file, musicDirectoryAlias = false, databaseInsideMusic = false, corsOrigins } = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'treble-tests-'))
    const musicDirectory = path.join(root, 'music')
    await mkdir(musicDirectory)
    for (const file of files) {
        await mkdir(path.dirname(path.join(musicDirectory, file)), { recursive: true })
        await writeFile(path.join(musicDirectory, file), wav())
    }
    const configuredMusicDirectory = musicDirectoryAlias ? path.join(root, 'music-link') : musicDirectory
    if (musicDirectoryAlias) await symlink(musicDirectory, configuredMusicDirectory, 'junction')
    const databasePath = path.join(databaseInsideMusic ? musicDirectory : root, 'music.db')
    if (legacy) {
        const old = new Database(databasePath)
        old.exec(`CREATE TABLE library(id INTEGER PRIMARY KEY, path TEXT UNIQUE, mtime INTEGER,
            title TEXT, artist TEXT, album TEXT, year INTEGER, duration INTEGER, track_no INTEGER,
            disk INTEGER DEFAULT 1, tags TEXT, is_vbr INTEGER DEFAULT 0, bitrate INTEGER, codec TEXT, container TEXT)`)
        old.prepare('INSERT INTO library(id,path,title) VALUES (42,?,?)').run(legacyPath(path.join(configuredMusicDirectory, files[0])), 'Old title')
        old.close()
    }
    const library = new MusicLibrary({ musicDirectory: configuredMusicDirectory.replaceAll('\\', '/'), databasePath, onError() {} })
    await library.start()
    const server = createApp({ library, corsOrigins }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${server.address().port}/api`
    t.after(async () => {
        await new Promise(resolve => server.close(resolve))
        await library.close()
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
        assert.ok(path.basename(root).startsWith('treble-tests-'))
        await rm(root, { recursive: true, force: true })
    })
    return { root, musicDirectory, library, base, get: route => fetch(base + route) }
}

test('fresh empty library is usable and indexing status is accurate', async t => {
    const { get, base, library } = await fixture(t, { files: [] })
    assert.deepEqual(await (await get('/folders')).json(), [])
    assert.deepEqual(await (await get('/albums')).json(), [])
    const previousAttempt = library.status.lastAttempt
    assert.equal((await (await get('/index')).json()).lastAttempt, previousAttempt)
    const watcher = library.watcher
    const refreshed = await (await fetch(base + '/index', { method: 'POST' })).json()
    assert.equal(refreshed.syncing, false)
    assert.ok(refreshed.lastSuccess)
    assert.equal(library.watcher, watcher)
    const first = library.refresh()
    assert.equal(library.refresh(), first)
    await first
})

test('indexing reads MPEG tags without requiring a full duration scan and keeps header-known durations', async t => {
    const { musicDirectory, library, get } = await fixture(t)
    const textTag = (id, value) => {
        const data = Buffer.concat([Buffer.from([0]), Buffer.from(value, 'latin1')])
        const header = Buffer.alloc(10)
        header.write(id, 0, 4, 'ascii')
        header.writeUInt32BE(data.length, 4)
        return Buffer.concat([header, data])
    }
    const tags = Buffer.concat([textTag('TIT2', 'Tagged network song'), textTag('TPE1', 'Test artist')])
    const id3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, tags.length])
    // Alternating bitrates without a Xing header require frame scanning to know the duration.
    const frames = Array.from({ length: 80 }, (_, index) => {
        const bitrate = index % 2 ? 192 : 128
        const frame = Buffer.alloc(Math.floor(144000 * bitrate / 44100))
        frame.writeUInt32BE(index % 2 ? 0xfffbb000 : 0xfffb9000)
        return frame
    })
    await writeFile(path.join(musicDirectory, 'tagged.mp3'), Buffer.concat([id3, tags, ...frames]))
    await library.refresh()
    const tracks = await (await get('/folders')).json()
    const mpeg = tracks.find(track => track.name === 'tagged.mp3')
    assert.equal(mpeg.title, 'Tagged network song')
    assert.equal(mpeg.artist, 'Test artist')
    assert.equal(mpeg.codec, 'MPEG 1 Layer 3')
    assert.equal(mpeg.duration, null)
    assert.equal(tracks.find(track => track.name === 'sample.wav').duration, 2)

    library.database.prepare('UPDATE library SET duration = 2, metadata_version = 0 WHERE id = ?').run(mpeg.id)
    await library.refresh()
    assert.equal(library.database.prepare('SELECT duration FROM library WHERE id = ?').get(mpeg.id).duration, 2)

    const mpegPath = path.join(musicDirectory, 'tagged.mp3')
    await writeFile(mpegPath, Buffer.concat([id3, tags, ...frames, ...frames]))
    await utimes(mpegPath, new Date(), new Date(mpeg.mtime + 2000))
    await library.refresh()
    assert.equal(library.database.prepare('SELECT duration FROM library WHERE id = ?').get(mpeg.id).duration, null)
})

test('outside files, unindexed files, and malformed track selectors cannot be read', async t => {
    const { root, musicDirectory, library, get } = await fixture(t)
    await writeFile(path.join(root, 'sentinel.txt'), 'private sentinel')
    assert.equal((await get('/track?path=../sentinel.txt')).status, 403)
    assert.equal((await get('/track?path=..%5Csentinel.txt')).status, 403)
    await writeFile(path.join(musicDirectory, 'private.txt'), 'not a track')
    assert.equal((await get('/track?path=private.txt')).status, 404)
    assert.equal((await get('/track?id=garbage')).status, 400)
    assert.equal((await get('/track?id=1&id=2')).status, 400)
    assert.equal((await get('/track')).status, 400)
    assert.equal((await get('/track-cover?path=../sentinel.txt')).status, 403)
    assert.equal((await get('/track?path=missing.wav')).status, 404)
    const track = library.database.prepare('SELECT id FROM library').get()
    assert.equal((await get(`/track?id=${track.id}`)).status, 200)
    assert.equal((await get('/track?path=/sample.wav')).status, 200)
})

test('cached path media URLs cannot return a replacement track after its SQLite ID is reused', async t => {
    const { musicDirectory, library, base, get } = await fixture(t)
    const original = library.database.prepare('SELECT * FROM library').get()
    const originalQuery = new URLSearchParams({ path: library.publicTrack(original).path })
    const cachedTrackUrl = `${base}/track?${originalQuery}`
    const cachedCoverUrl = `${base}/track-cover?${originalQuery}`
    const initialResponse = await fetch(cachedTrackUrl)
    assert.equal(initialResponse.status, 200)
    assert.deepEqual(Buffer.from(await initialResponse.arrayBuffer()), wav())

    await rm(path.join(musicDirectory, 'sample.wav'))
    await library.refresh()
    await writeFile(path.join(musicDirectory, 'replacement.wav'), wav(3))
    await library.refresh()
    const replacement = library.database.prepare('SELECT id FROM library').get()
    assert.equal(replacement.id, original.id)
    const replacementResponse = await get(`/track?id=${replacement.id}`)
    assert.equal(replacementResponse.status, 200)
    assert.deepEqual(Buffer.from(await replacementResponse.arrayBuffer()), wav(3))

    for (const url of [cachedTrackUrl, cachedCoverUrl]) {
        const response = await fetch(url)
        assert.equal(response.status, 404)
        assert.deepEqual(await response.json(), { error: 'Track not found' })
    }
})

test('indexed symlink escapes are denied and directory symlink cycles do not hang', async t => {
    const { root, musicDirectory, library, get } = await fixture(t)
    const outside = path.join(root, 'outside')
    await mkdir(outside)
    await writeFile(path.join(outside, 'secret.wav'), wav())
    await symlink(outside, path.join(musicDirectory, 'escape'), 'junction')
    await symlink(musicDirectory, path.join(musicDirectory, 'cycle'), 'junction')
    await library.refresh()
    assert.equal(library.database.prepare('SELECT count(*) AS count FROM library').get().count, 1)
    const inserted = library.database.prepare('INSERT INTO library(path,title) VALUES (?,?)').run(path.join(musicDirectory, 'escape', 'secret.wav'), 'Secret')
    assert.equal((await get(`/track?id=${inserted.lastInsertRowid}`)).status, 403)
})

test('suffix and bounded ranges work; invalid ranges and deleted files do not kill the server', async t => {
    const { musicDirectory, library, base, get } = await fixture(t)
    const id = library.database.prepare('SELECT id FROM library').get().id
    const requestRange = range => fetch(`${base}/track?id=${id}`, { headers: { Range: range } })
    let response = await requestRange('bytes=-10')
    assert.equal(response.status, 206)
    assert.equal((await response.arrayBuffer()).byteLength, 10)
    response = await requestRange('bytes=0-9')
    assert.equal(response.status, 206)
    assert.equal((await response.arrayBuffer()).byteLength, 10)
    for (const range of ['bytes=10-5', 'bytes=999999999-']) {
        response = await requestRange(range)
        assert.equal(response.status, 416)
        assert.match(response.headers.get('content-range'), /^bytes \*\//)
        await response.text()
    }
    await rm(path.join(musicDirectory, 'sample.wav'))
    const missing = await get(`/track?id=${id}`)
    assert.equal(missing.status, 404)
    assert.deepEqual(await missing.json(), { error: 'File not found' })
    assert.equal((await get('/folders')).status, 200)
})

test('folder names do not collide with object properties and library results stay fresh', async t => {
    const { musicDirectory, library, get } = await fixture(t, { files: ['constructor/one.wav', 'result/two.wav', '__proto__/three.wav'] })
    const folders = await (await get('/folders')).json()
    assert.deepEqual(folders.map(folder => folder.name), ['__proto__', 'constructor', 'result'])
    assert.equal('id' in folders[0], false)
    assert.equal(folders[0].children[0].path, '__proto__/three.wav')
    await writeFile(path.join(musicDirectory, 'new.wav'), wav())
    await library.refresh()
    assert.equal((await (await get('/folders')).json()).length, 4)
    await rm(path.join(musicDirectory, 'new.wav'))
    await library.refresh()
    assert.equal((await (await get('/folders')).json()).length, 3)
})

test('the owned watcher discovers files without a manual index request', async t => {
    const { musicDirectory, library } = await fixture(t, { files: [] })
    await writeFile(path.join(musicDirectory, 'new.wav'), wav())
    const deadline = Date.now() + 8000
    while (!library.database.prepare('SELECT id FROM library').get() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.equal(library.database.prepare('SELECT title FROM library').get()?.title, 'new.wav')
})

test('a database inside the music directory does not trigger its own refresh loop', async t => {
    const { library, musicDirectory } = await fixture(t, { files: [], databaseInsideMusic: true })
    const lastAttempt = library.status.lastAttempt
    await new Promise(resolve => setTimeout(resolve, 1200))
    assert.equal(library.status.lastAttempt, lastAttempt)
    await writeFile(path.join(musicDirectory, 'new.wav'), wav())
    const deadline = Date.now() + 8000
    while (!library.database.prepare('SELECT id FROM library').get() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.equal(library.database.prepare('SELECT title FROM library').get()?.title, 'new.wav')
})

test('album identity separates artists, groups compilation artists, orders discs, and supports missing tags', async t => {
    const { library, get } = await fixture(t, { files: ['one.wav', 'two.wav', 'three.wav', 'four.wav'] })
    const tracks = library.database.prepare('SELECT id FROM library ORDER BY id').all()
    const update = library.database.prepare('UPDATE library SET artist=?, album_artist=?, album=?, disk=?, track_no=? WHERE id=?')
    update.run('A', 'A', 'Hits', 1, 1, tracks[0].id)
    update.run('B', 'B', 'Hits', 1, 1, tracks[1].id)
    update.run('Guest', 'A', 'Hits', 2, 1, tracks[2].id)
    update.run(null, null, null, 1, 1, tracks[3].id)
    assert.equal((await (await get('/albums')).json()).length, 3)
    assert.deepEqual((await (await get('/album?artist=A&album=Hits')).json()).map(track => track.id), [tracks[0].id, tracks[2].id])
    assert.equal((await (await get('/artist?artist=B')).json())[0].id, tracks[1].id)
    assert.equal((await (await get('/album')).json())[0].id, tracks[3].id)
    assert.equal((await (await get('/artist')).json())[0].id, tracks[3].id)
    assert.equal((await get('/album?artist[x]=bad')).status, 200)
    assert.equal((await get('/album?artist=A&artist=B')).status, 400)
})

test('existing SQLite rows retain their IDs while metadata schema upgrades', async t => {
    const { library } = await fixture(t, { legacy: true })
    const track = library.database.prepare('SELECT * FROM library').get()
    assert.equal(track.id, 42)
    assert.equal(track.title, 'sample.wav')
    assert.equal(track.metadata_version, 1)
    assert.ok(library.status.lastSuccess)
})

test('unchanged legacy tags survive a temporary parse failure and recover on the next refresh', async t => {
    const { library, musicDirectory } = await fixture(t)
    const parseErrors = []
    library.onError = error => parseErrors.push(error)
    const track = library.database.prepare('SELECT id, path, mtime FROM library').get()
    const originalMtime = Math.floor(track.mtime / 1000) * 1000
    library.database.prepare('UPDATE library SET title = ?, artist = ?, album = ?, metadata_version = 0, mtime = ? WHERE id = ?')
        .run('Saved title', 'Saved artist', 'Saved album', originalMtime, track.id)
    const originalTime = new Date(originalMtime)
    await writeFile(track.path, Buffer.alloc(0))
    await utimes(track.path, originalTime, originalTime)
    await library.refresh()
    assert.equal(parseErrors.length, 1)
    const retained = library.database.prepare('SELECT title, artist, album, metadata_version FROM library WHERE id = ?').get(track.id)
    assert.deepEqual(retained, { title: 'Saved title', artist: 'Saved artist', album: 'Saved album', metadata_version: 0 })

    await writeFile(track.path, wav())
    await utimes(track.path, originalTime, originalTime)
    await library.refresh()
    const recovered = library.database.prepare('SELECT title, artist, metadata_version, mtime FROM library WHERE id = ?').get(track.id)
    assert.deepEqual(recovered, { title: 'sample.wav', artist: null, metadata_version: 1, mtime: originalMtime })

    library.database.prepare('UPDATE library SET title = ?, artist = ? WHERE id = ?').run('Old title', 'Old artist', track.id)
    await writeFile(track.path, Buffer.alloc(0))
    const changedTime = new Date(originalMtime + 2000)
    await utimes(track.path, changedTime, changedTime)
    await writeFile(path.join(musicDirectory, 'new-corrupt.wav'), Buffer.alloc(0))
    await library.refresh()
    assert.equal(parseErrors.length, 3)
    const fallback = library.database.prepare('SELECT title, artist, metadata_version, mtime FROM library WHERE id = ?').get(track.id)
    assert.deepEqual(fallback, { title: 'sample.wav', artist: null, metadata_version: 1, mtime: originalMtime + 2000 })
    assert.equal(library.database.prepare('SELECT metadata_version FROM library WHERE title = ?').get('new-corrupt.wav').metadata_version, 1)
})

test('a configured music-directory alias preserves existing track IDs and relative paths', async t => {
    const { library, get, musicDirectory } = await fixture(t, { legacy: true, musicDirectoryAlias: true })
    assert.equal(library.database.prepare('SELECT id FROM library').get().id, 42)
    assert.equal((await get('/track?id=42')).status, 200)
    assert.equal((await get('/track?path=/sample.wav')).status, 200)
    assert.equal((await (await get('/folders')).json())[0].path, 'sample.wav')
    await writeFile(path.join(musicDirectory, 'Cover.png'), Buffer.from([137, 80, 78, 71]))
    assert.equal((await get('/track-cover?id=42')).status, 200)
    await writeFile(path.join(musicDirectory, 'new.wav'), wav())
    const deadline = Date.now() + 8000
    while (library.database.prepare('SELECT count(*) AS count FROM library').get().count < 2 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.equal(library.database.prepare('SELECT count(*) AS count FROM library').get().count, 2)
    assert.equal(library.database.prepare('SELECT id FROM library WHERE title = ?').get('sample.wav').id, 42)
})

test('Windows path spelling changes preserve existing track IDs', { skip: process.platform !== 'win32' }, async t => {
    const { library, get } = await fixture(t, { legacy: true, legacyPath: file => file.replaceAll('\\', '/').replace(/^[A-Z]:/, drive => drive.toLowerCase()) })
    assert.equal(library.database.prepare('SELECT id FROM library').get().id, 42)
    assert.equal((await get('/track?id=42')).status, 200)
    assert.equal((await get('/track?path=/sample.wav')).status, 200)
    await library.refresh()
    assert.equal(library.database.prepare('SELECT id FROM library').get().id, 42)
})

test('existing Windows rows with equivalent path spellings do not conflict during refresh', { skip: process.platform !== 'win32' }, async t => {
    const { library, get } = await fixture(t)
    const track = library.database.prepare('SELECT * FROM library').get()
    library.database.prepare('INSERT INTO library(path, title) VALUES (?, ?)').run(track.path.replaceAll('\\', '/'), 'Duplicate spelling')
    await library.refresh()
    assert.equal(library.database.prepare('SELECT count(*) AS count FROM library').get().count, 1)
    assert.equal((await get(`/track?id=${track.id}`)).status, 200)
})

test('a legacy-spelled track removed while tags are read is removed from the index', { skip: process.platform !== 'win32' }, async t => {
    const { library } = await fixture(t)
    const track = library.database.prepare('SELECT id, path FROM library').get()
    library.database.prepare('UPDATE library SET path = ?, metadata_version = 0 WHERE id = ?')
        .run(track.path.replaceAll('\\', '/'), track.id)
    const prepare = library.database.prepare.bind(library.database)
    let removalPending = true
    t.mock.method(library.database, 'prepare', query => {
        const statement = prepare(query)
        if (!removalPending || query !== 'SELECT path, mtime, metadata_version, duration FROM library') return statement
        return { all() {
            const rows = statement.all()
            removalPending = false
            unlinkSync(track.path)
            return rows
        } }
    })
    await library.refresh()
    assert.equal(library.database.prepare('SELECT count(*) AS count FROM library').get().count, 0)
    assert.equal(library.status.error, null)
})

test('cover lookup handles filename case and type, and returns missing art as 404', async t => {
    const { musicDirectory, library, get } = await fixture(t)
    const id = library.database.prepare('SELECT id FROM library').get().id
    assert.equal((await get(`/track-cover?id=${id}`)).status, 404)
    await writeFile(path.join(musicDirectory, 'Cover.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    let cover = await get(`/track-cover?id=${id}`)
    assert.equal(cover.status, 200)
    assert.match(cover.headers.get('content-type'), /^image\/jpeg/)
    await cover.arrayBuffer()
    await rm(path.join(musicDirectory, 'Cover.jpg'))
    await writeFile(path.join(musicDirectory, 'cover.PNG'), Buffer.from([137, 80, 78, 71]))
    cover = await get(`/track-cover?id=${id}`)
    assert.match(cover.headers.get('content-type'), /^image\/png/)
    await cover.arrayBuffer()
})

test('network binding and optional CORS configuration preserve personal Tailscale access', async t => {
    const config = getConfig({ MUSIC_DIRECTORY: '.', PORT: '0' })
    assert.equal(config.host, undefined)
    assert.equal(config.musicDirectory, backendDirectory.replace(/[\\/]$/, ''))
    assert.equal(getConfig({ MUSIC_DIRECTORY: '.', HOST: '127.0.0.1' }).host, '127.0.0.1')
    assert.deepEqual(getConfig({ MUSIC_DIRECTORY: '.', CORS_ORIGINS: 'https://one.ts.net, https://two.ts.net' }).corsOrigins, ['https://one.ts.net', 'https://two.ts.net'])
    assert.throws(() => getConfig({}), /MUSIC_DIRECTORY/)
    assert.throws(() => getConfig({ MUSIC_DIRECTORY: '.', PORT: 'bad' }), /PORT/)
    const { base } = await fixture(t)
    const response = await fetch(base + '/folders', { headers: { Origin: 'https://personal.tailnet.ts.net' } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
    const restricted = await fixture(t, { corsOrigins: ['https://personal.tailnet.ts.net'] })
    const allowed = await fetch(restricted.base + '/folders', { headers: { Origin: 'https://personal.tailnet.ts.net' } })
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://personal.tailnet.ts.net')
    const denied = await fetch(restricted.base + '/folders', { headers: { Origin: 'https://unrelated.example' } })
    assert.equal(denied.headers.get('access-control-allow-origin'), null)
    assert.equal(denied.status, 200)
})
