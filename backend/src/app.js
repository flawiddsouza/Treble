import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApiRoutes } from './routes/api.js'
import { MusicLibrary } from './library.js'
import { backendDirectory, getConfig } from './config.js'

export function createApp({ library, corsOrigins } = {}) {
    const app = express()
    app.disable('x-powered-by')
    app.use(cors({ origin: corsOrigins?.length ? corsOrigins : '*' }))
    app.use('/api', createApiRoutes(library))
    app.use(express.static(path.resolve(backendDirectory, '../ui/dist')))
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error)
        const status = error.status || (error.code === 'ENOENT' ? 404 : 500)
        if (error.headers) res.set(error.headers)
        if (status >= 500) console.error(error)
        const message = error.code === 'ENOENT' ? 'File not found' : error.message
        res.status(status).json({ error: status >= 500 ? 'The request could not be completed' : message })
    })
    return app
}

export async function startServer(config = getConfig()) {
    const library = new MusicLibrary(config)
    let server
    try {
        await library.start()
        const app = createApp({ library, corsOrigins: config.corsOrigins })
        server = config.host ? app.listen(config.port, config.host) : app.listen(config.port)
        await new Promise((resolve, reject) => {
            server.once('listening', resolve)
            server.once('error', reject)
        })
        const serverAddress = server.address()
        const serverHost = serverAddress.family === 'IPv6' ? `[${serverAddress.address}]` : serverAddress.address
        console.log(`Listening on ${serverHost}:${serverAddress.port}`)
    } catch (error) {
        await library.close()
        throw error
    }
    let closing
    const close = () => closing ??= (async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
        await library.close()
    })()
    return { server, library, close }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    startServer().then(({ close }) => {
        const shutdown = () => close().then(() => process.exit(0)).catch(error => {
            console.error(error)
            process.exit(1)
        })
        process.once('SIGINT', shutdown)
        process.once('SIGTERM', shutdown)
    }).catch(error => {
        console.error(error.message)
        process.exitCode = 1
    })
}
