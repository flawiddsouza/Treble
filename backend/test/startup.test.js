import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import chokidar from 'chokidar'
import { MusicLibrary } from '../src/library.js'
import { startServer } from '../src/app.js'

const emptyWav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=', 'base64')

async function fixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'treble-startup-'))
    const musicDirectory = path.join(root, 'music')
    const databasePath = path.join(root, 'music.db')
    await mkdir(musicDirectory)
    await writeFile(path.join(musicDirectory, 'cached.wav'), emptyWav)
    const cached = new MusicLibrary({ musicDirectory, databasePath })
    cached.database.prepare('INSERT INTO library(id, path, title) VALUES (42, ?, ?)')
        .run(path.join(musicDirectory, 'cached.wav'), 'Cached title')
    await cached.close()
    const errors = []
    let runtime
    t.after(async () => {
        await runtime?.close()
        assert.equal(path.dirname(root), path.resolve(tmpdir()))
        assert.ok(path.basename(root).startsWith('treble-startup-'))
        await rm(root, { recursive: true, force: true })
    })
    return {
        musicDirectory, errors,
        async start(port = 0) {
            runtime = await startServer({ musicDirectory, databasePath, host: '127.0.0.1', port, onError: error => errors.push(error) })
            const base = `http://127.0.0.1:${runtime.server.address().port}/api`
            return { ...runtime, get: route => fetch(base + route), post: () => fetch(base + '/index', { method: 'POST' }) }
        }
    }
}

function watchers(t) {
    const created = []
    let next = Promise.withResolvers()
    t.mock.method(chokidar, 'watch', () => {
        const watcher = new EventEmitter()
        watcher.closeCount = 0
        watcher.close = async () => {
            watcher.closeCount++
            watcher.removeAllListeners()
        }
        created.push(watcher)
        next.resolve(watcher)
        return watcher
    })
    return {
        created,
        async take() {
            const watcher = await next.promise
            next = Promise.withResolvers()
            return watcher
        }
    }
}

test('HTTP serves cached tracks throughout watcher setup and the initial scan, with refresh requests sharing that scan', async t => {
    const controlled = watchers(t)
    const scanEntered = Promise.withResolvers()
    const releaseScan = Promise.withResolvers()
    t.after(() => releaseScan.resolve())
    const scan = MusicLibrary.prototype.scan
    let scanCount = 0
    t.mock.method(MusicLibrary.prototype, 'scan', async function () {
        scanCount++
        scanEntered.resolve()
        await releaseScan.promise
        return scan.call(this)
    })
    const data = await fixture(t)
    const runtime = await data.start()
    const watcher = await controlled.take()
    assert.equal((await (await runtime.get('/index')).json()).syncing, true)
    assert.equal((await (await runtime.get('/folders')).json())[0].title, 'Cached title')
    assert.equal((await runtime.get('/track?id=42')).status, 200)
    assert.equal(scanCount, 0)

    const beforeWatcher = Promise.withResolvers()
    const duringScan = Promise.withResolvers()
    const refresh = runtime.library.refresh.bind(runtime.library)
    let refreshCount = 0
    t.mock.method(runtime.library, 'refresh', () => {
        refreshCount++
        if (refreshCount === 1) beforeWatcher.resolve()
        if (refreshCount === 3) duringScan.resolve()
        return refresh()
    })
    const firstRequest = runtime.post()
    await beforeWatcher.promise
    watcher.emit('ready')
    await scanEntered.promise
    const secondRequest = runtime.post()
    await duringScan.promise
    assert.equal((await (await runtime.get('/index')).json()).syncing, true)
    assert.equal((await (await runtime.get('/folders')).json())[0].title, 'Cached title')
    assert.equal(scanCount, 1)
    releaseScan.resolve()
    await runtime.libraryReady
    for (const request of [firstRequest, secondRequest]) {
        const status = await (await request).json()
        assert.equal(status.syncing, false)
        assert.ok(status.lastSuccess)
    }
    assert.equal(scanCount, 1)
    const track = (await (await runtime.get('/folders')).json())[0]
    assert.equal(track.id, 42)
    assert.equal(track.title, 'cached.wav')
    assert.equal(data.errors.length, 0)
})

test('a watcher startup failure leaves cached HTTP results available and a refresh retries initialization', async t => {
    const controlled = watchers(t)
    const data = await fixture(t)
    const runtime = await data.start()
    const failedWatcher = await controlled.take()
    failedWatcher.emit('error', new Error('Music share is unavailable'))
    await assert.rejects(runtime.libraryReady, /Music share is unavailable/)
    const failedStatus = await (await runtime.get('/index')).json()
    assert.equal(failedStatus.syncing, false)
    assert.equal(failedStatus.error, 'Music share is unavailable')
    assert.equal((await (await runtime.get('/folders')).json())[0].title, 'Cached title')
    assert.equal(failedWatcher.closeCount, 1)

    const retry = runtime.post()
    const watcher = await controlled.take()
    const retryStatus = await (await runtime.get('/index')).json()
    assert.equal(retryStatus.syncing, true)
    assert.equal(retryStatus.error, null)
    watcher.emit('ready')
    assert.equal((await (await retry).json()).error, null)
    assert.equal((await (await runtime.get('/folders')).json())[0].id, 42)
    assert.equal(controlled.created.length, 2)
    assert.equal(data.errors.length, 1)
})

test('a missing music root preserves cached rows and a refresh recovers when the root returns', async t => {
    const controlled = watchers(t)
    const data = await fixture(t)
    await rm(data.musicDirectory, { recursive: true })
    const runtime = await data.start()
    await assert.rejects(runtime.libraryReady, { code: 'ENOENT' })
    assert.equal((await (await runtime.get('/index')).json()).syncing, false)
    assert.equal((await (await runtime.get('/folders')).json())[0].title, 'Cached title')
    assert.equal(controlled.created.length, 0)
    await mkdir(data.musicDirectory)
    await writeFile(path.join(data.musicDirectory, 'cached.wav'), emptyWav)
    const retry = runtime.post()
    const watcher = await controlled.take()
    watcher.emit('ready')
    assert.equal((await (await retry).json()).error, null)
    assert.equal((await (await runtime.get('/folders')).json())[0].id, 42)
})

test('shutdown cancels watcher initialization and an in-flight refresh without leaving the database open', async t => {
    const controlled = watchers(t)
    const data = await fixture(t)
    const runtime = await data.start()
    const watcher = await controlled.take()
    const refreshEntered = Promise.withResolvers()
    const refresh = runtime.library.refresh.bind(runtime.library)
    t.mock.method(runtime.library, 'refresh', () => {
        refreshEntered.resolve()
        return refresh()
    })
    const pendingRequest = runtime.post().then(response => response.json())
    await refreshEntered.promise
    await runtime.close()
    await runtime.libraryReady
    assert.equal((await pendingRequest).syncing, false)
    assert.equal(watcher.closeCount, 1)
    assert.equal(watcher.listenerCount('ready'), 0)
    assert.equal(runtime.library.database.open, false)
    assert.equal(runtime.library.status.lastSuccess, null)
    assert.equal(data.errors.length, 0)
})

test('shutdown waits for the initial scan before closing its database', async t => {
    const controlled = watchers(t)
    const scanEntered = Promise.withResolvers()
    const releaseScan = Promise.withResolvers()
    t.after(() => releaseScan.resolve())
    const scan = MusicLibrary.prototype.scan
    t.mock.method(MusicLibrary.prototype, 'scan', async function () {
        scanEntered.resolve()
        await releaseScan.promise
        return scan.call(this)
    })
    const data = await fixture(t)
    const runtime = await data.start()
    const watcher = await controlled.take()
    watcher.emit('ready')
    await scanEntered.promise
    const refreshEntered = Promise.withResolvers()
    const refresh = runtime.library.refresh.bind(runtime.library)
    t.mock.method(runtime.library, 'refresh', () => {
        refreshEntered.resolve()
        return refresh()
    })
    const pendingRequest = runtime.post().then(response => response.json())
    await refreshEntered.promise
    const closing = runtime.close()
    assert.equal(runtime.library.database.open, true)
    releaseScan.resolve()
    await closing
    await runtime.libraryReady
    assert.equal(runtime.library.database.open, false)
    assert.equal(runtime.library.status.syncing, false)
    assert.equal((await pendingRequest).syncing, false)
    assert.equal(watcher.closeCount, 1)
    assert.equal(data.errors.length, 0)
})

test('a bind failure closes its library before initialization can create a watcher', async t => {
    const blocker = net.createServer()
    t.after(() => new Promise(resolve => blocker.close(resolve)))
    blocker.listen(0, '127.0.0.1')
    await once(blocker, 'listening')
    const controlled = watchers(t)
    const data = await fixture(t)
    const close = MusicLibrary.prototype.close
    let failedLibrary
    t.mock.method(MusicLibrary.prototype, 'close', function (...args) {
        failedLibrary = this
        return close.apply(this, args)
    })

    await assert.rejects(data.start(blocker.address().port), { code: 'EADDRINUSE' })
    await failedLibrary.startPromise
    assert.equal(failedLibrary.database.open, false)
    assert.equal(controlled.created.length, 0)
    assert.equal(data.errors.length, 0)
})

test('shutdown serves an already accepted HTTP request before closing its database', async t => {
    const controlled = watchers(t)
    let socket
    t.after(() => socket?.destroy())
    const data = await fixture(t)
    const runtime = await data.start()
    const watcher = await controlled.take()
    watcher.emit('ready')
    await runtime.libraryReady

    const connection = once(runtime.server, 'connection')
    socket = net.createConnection(runtime.server.address().port, '127.0.0.1')
    const [serverSocket] = await connection
    const headersReceived = once(serverSocket, 'data')
    let response = ''
    socket.on('data', chunk => { response += chunk })
    socket.write('GET /api/folders HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n')
    await headersReceived

    const closing = runtime.close()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(runtime.library.database.open, true)
    socket.write('\r\n')
    await once(socket, 'close', { signal: AbortSignal.timeout(2000) })
    await closing
    assert.match(response, /^HTTP\/1\.1 200 /)
    assert.match(response, /cached\.wav/)
    assert.equal(runtime.library.database.open, false)
    assert.equal(watcher.closeCount, 1)
})

test('shutdown before root resolution cannot create a watcher after the database closes', async t => {
    const controlled = watchers(t)
    const data = await fixture(t)
    const library = new MusicLibrary({ musicDirectory: data.musicDirectory })
    const started = library.start()
    assert.equal(library.status.syncing, true)
    await library.close()
    await started
    assert.equal(controlled.created.length, 0)
    assert.equal(library.database.open, false)
})
