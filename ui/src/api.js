const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '')
export const API_URL = configuredApiUrl
    ? configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`
    : '/api'

async function request(apiPath, options) {
    let response
    try {
        response = await fetch(API_URL + apiPath, options)
    } catch {
        throw new Error('Cannot reach the music server. Check the connection and try again.')
    }
    let data
    try {
        data = await response.json()
    } catch {
        throw new Error(`The music server returned an unexpected response (${response.status}).`)
    }
    if (!response.ok) {
        throw new Error(data?.error || `The music server could not complete the request (${response.status}).`)
    }
    return data
}

function query(values) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) {
        if (value !== null && value !== undefined) params.set(key, value)
    }
    const query = params.toString()
    return query ? `?${query}` : ''
}

export const fetchFolders = () => request('/folders')
export const fetchAlbums = () => request('/albums')
export const fetchArtists = () => request('/artists')
export const fetchAlbum = (artist, album) => request(`/album${query({ artist, album })}`)
export const fetchArtist = artist => request(`/artist${query({ artist })}`)
export const refreshLibrary = () => request('/index', { method: 'POST' })

export function trackUrl(track, cover = false) {
    return `${API_URL}/${cover ? 'track-cover' : 'track'}${query({ path: track.path })}`
}
