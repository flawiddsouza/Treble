export const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:4001'}/api`

async function get(apiPath) {
    const response = await fetch(API_URL + apiPath)
    return await response.json()
}

export async function fetchFolders() {
    return await get('/folders')
}

export async function fetchAlbums() {
    return await get('/albums')
}

export async function fetchArtists() {
    return await get('/artists')
}

export async function fetchAlbum(artist, album) {
    return await get(`/album?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`)
}

export async function fetchArtist(artist, album) {
    return await get(`/artist?artist=${encodeURIComponent(artist)}`)
}
