import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', '')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))
})
afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

describe('music API requests', () => {
    it('uses same-origin URLs and encoded paths for media even when tracks have IDs', async () => {
        const api = await import('../src/api.js')
        await api.fetchFolders()
        expect(fetch).toHaveBeenCalledWith('/api/folders', undefined)
        expect(api.trackUrl({ id: 8, path: '/a file.mp3' })).toBe('/api/track?path=%2Fa+file.mp3')
        expect(api.trackUrl({ id: 8, path: 'A & B/song.mp3' }, true)).toBe('/api/track-cover?path=A+%26+B%2Fsong.mp3')
        expect(api.trackUrl({ path: 'A & B/song.mp3' })).toBe('/api/track?path=A+%26+B%2Fsong.mp3')
    })

    it('keeps cached media URLs attached to a path when another track reuses its ID', async () => {
        const api = await import('../src/api.js')
        const originalTrack = { id: 1, path: 'original.wav' }
        const replacementTrack = { id: 1, path: 'replacement.wav' }
        expect(api.trackUrl(originalTrack)).not.toBe(api.trackUrl(replacementTrack))
        expect(api.trackUrl(originalTrack, true)).not.toBe(api.trackUrl(replacementTrack, true))
    })

    it.each([
        ['http://music.tailnet:4001/', 'http://music.tailnet:4001/api'],
        ['https://music.example/player/api/', 'https://music.example/player/api'],
        ['/music', '/music/api']
    ])('supports the configured API base %s', async (configured, expected) => {
        vi.stubEnv('VITE_API_URL', configured)
        const api = await import('../src/api.js')
        expect(api.API_URL).toBe(expected)
    })

    it('omits unknown metadata filters and refreshes using POST', async () => {
        const api = await import('../src/api.js')
        await api.fetchAlbum(null, null)
        expect(fetch).toHaveBeenLastCalledWith('/api/album', undefined)
        await api.fetchAlbum('A & B', 'Album')
        expect(fetch).toHaveBeenLastCalledWith('/api/album?artist=A+%26+B&album=Album', undefined)
        await api.fetchArtist(null)
        expect(fetch).toHaveBeenLastCalledWith('/api/artist', undefined)
        await api.fetchIndexStatus()
        expect(fetch).toHaveBeenLastCalledWith('/api/index', undefined)
        await api.refreshLibrary()
        expect(fetch).toHaveBeenLastCalledWith('/api/index', { method: 'POST' })
    })

    it('reports network failures, server errors and malformed responses', async () => {
        const api = await import('../src/api.js')
        fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        await expect(api.fetchFolders()).rejects.toThrow('Cannot reach the music server')
        fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'Index unavailable.' }) })
        await expect(api.fetchFolders()).rejects.toThrow('Index unavailable.')
        fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => null })
        await expect(api.fetchFolders()).rejects.toThrow('could not complete the request (500)')
        fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('Invalid JSON') } })
        await expect(api.fetchFolders()).rejects.toThrow('unexpected response (502)')
    })
})
