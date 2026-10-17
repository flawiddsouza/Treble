import express from 'express'

function nullableQuery(value) {
    if (value === undefined) return null
    if (typeof value !== 'string') throw Object.assign(new Error('Invalid query parameter'), { status: 400 })
    return value
}

export function createApiRoutes(library) {
    const router = express.Router()
    router.get('/index', (_req, res) => res.json(library.status))
    router.post('/index', async (_req, res) => res.json(await library.refresh()))
    router.get('/folders', (_req, res) => res.json(library.folders()))
    router.get('/albums', (_req, res) => res.json(library.albums()))
    router.get('/artists', (_req, res) => res.json(library.artists()))
    router.get('/album', (req, res) => res.json(library.album(nullableQuery(req.query.artist), nullableQuery(req.query.album))))
    router.get('/artist', (req, res) => res.json(library.artist(nullableQuery(req.query.artist))))

    router.get('/track', async (req, res, next) => {
        const trackPath = await library.trackFile(req.query)
        res.sendFile(trackPath, { dotfiles: 'allow', cacheControl: false }, error => {
            if (error && !req.aborted) next(error)
        })
    })
    router.get('/track-cover', async (req, res, next) => {
        const cover = await library.cover(await library.trackFile(req.query))
        if (cover.data) res.type(cover.type).send(cover.data)
        else res.sendFile(cover.path, { dotfiles: 'allow', cacheControl: false }, error => {
            if (error && !req.aborted) next(error)
        })
    })
    return router
}
