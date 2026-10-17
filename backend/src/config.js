import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const backendDirectory = fileURLToPath(new URL('../', import.meta.url))
dotenv.config({ path: path.join(backendDirectory, '.env'), quiet: true })

export function getConfig(env = process.env) {
    if (!env.MUSIC_DIRECTORY?.trim()) throw new Error('MUSIC_DIRECTORY is required')
    const port = Number(env.PORT ?? 4001)
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be between 0 and 65535')
    return {
        host: env.HOST || undefined,
        port,
        musicDirectory: path.resolve(backendDirectory, env.MUSIC_DIRECTORY),
        databasePath: path.resolve(backendDirectory, env.MUSIC_DB_PATH || 'music.db'),
        corsOrigins: env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean)
    }
}
