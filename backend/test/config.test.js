import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { startServer } from '../src/app.js'
import { getConfig } from '../src/config.js'

async function ipv6Available() {
    const server = net.createServer()
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(0, '::1', resolve)
        })
        return true
    } catch (error) {
        if (['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) return false
        throw error
    } finally {
        if (server.listening) await new Promise(resolve => server.close(resolve))
    }
}

async function fixture(t, host) {
    const root = await mkdtemp(path.join(tmpdir(), 'treble-network-'))
    let runtime
    t.after(async () => {
        try { await runtime?.close() } finally { await rm(root, { recursive: true, force: true }) }
    })
    const musicDirectory = path.join(root, 'music')
    await mkdir(musicDirectory)
    runtime = await startServer({ musicDirectory, databasePath: path.join(root, 'music.db'), port: 0, host })
    const port = runtime.server.address().port
    return { runtime, url: hostname => `http://${hostname}:${port}/api/folders` }
}

async function assertMusicApi(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), [])
}

test('default and empty HOST preserve the original all-interface binding', async t => {
    assert.equal(getConfig({ MUSIC_DIRECTORY: '.' }).host, undefined)
    assert.equal(getConfig({ MUSIC_DIRECTORY: '.', HOST: '' }).host, undefined)
    const ipv6 = await ipv6Available()
    const { runtime, url } = await fixture(t, getConfig({ MUSIC_DIRECTORY: '.' }).host)
    await assertMusicApi(url('127.0.0.1'))
    if (ipv6) {
        assert.equal(runtime.server.address().address, '::')
        await assertMusicApi(url('[::1]'))
    } else {
        t.diagnostic('IPv6 loopback is unavailable; IPv4 default binding verified.')
    }
})

test('explicit IPv4 hosts remain IPv4 and honor localhost versus all interfaces', async t => {
    const ipv6 = await ipv6Available()
    for (const host of ['127.0.0.1', '0.0.0.0']) {
        assert.equal(getConfig({ MUSIC_DIRECTORY: '.', HOST: host }).host, host)
        const { runtime, url } = await fixture(t, host)
        assert.equal(runtime.server.address().address, host)
        await assertMusicApi(url('127.0.0.1'))
        if (ipv6) await assert.rejects(fetch(url('[::1]'), { signal: AbortSignal.timeout(2000) }))
    }
})

test('an explicit IPv6 localhost host stays local to IPv6', async t => {
    if (!await ipv6Available()) return t.skip('IPv6 loopback is unavailable.')
    const host = '::1'
    assert.equal(getConfig({ MUSIC_DIRECTORY: '.', HOST: host }).host, host)
    const { runtime, url } = await fixture(t, host)
    assert.equal(runtime.server.address().address, host)
    await assertMusicApi(url('[::1]'))
    await assert.rejects(fetch(url('127.0.0.1'), { signal: AbortSignal.timeout(2000) }))
})
