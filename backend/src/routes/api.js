import express from 'express'
import { authCheck } from '../helpers.js'
import Database from 'better-sqlite3'
import SyncMusicDb from 'sync-music-db-bs3'
import { statSync, createReadStream, readFileSync, existsSync } from 'fs'
import mime from 'mime'
import * as mm from 'music-metadata'
import path from 'path'

const router = express.Router()

const database = new Database('music.db')

router.get('/index', async(_req, res) => {
    const syncMusicDb = new SyncMusicDb({ db: database, dirs: [process.env.MUSIC_DIRECTORY] })

    await syncMusicDb.createTable()

    console.time('sync')

    syncMusicDb
    .on('ready', () => console.timeEnd('sync'))
    .on('add', track => console.log(`${track.title} added`))
    .on('update', track => console.log(`${track.path} updated`))
    .on('remove', path => console.log(`${path} removed`))
    .on('error', err => console.error(err))
    .refresh()

    res.send('Success')
})

let folders = []
let artists = []
let albums = []

router.get('/folders', async(_req, res) => {
    if(folders.length === 0) {
        const allFilePaths = await database.prepare('SELECT * from library').all()
        let result = []
        let level = { result }

        allFilePaths.forEach(filePath => {
            filePath.path.replace(process.env.MUSIC_DIRECTORY, '').split('/').reduce((r, name) => {
                if(!r[name]) {
                    r[name] = { result: [] }
                    r.result.push({
                        name,
                        children: r[name].result,
                        ...filePath,
                        path: filePath.path.replace(process.env.MUSIC_DIRECTORY, '')
                    })
                }

                return r[name]
            }, level)
        })

        folders = result[0].children
    }
    res.send(folders)
})

router.get('/albums', async(_req, res) => {
    if(albums.length === 0) {
        albums = await database.prepare('SELECT artist, album, year from library GROUP BY album ORDER BY artist, album').all()
    }
    res.send(albums)
})

router.get('/artists', async(_req, res) => {
    if(artists.length === 0) {
        artists = await database.prepare('SELECT artist from library GROUP BY artist ORDER BY artist').all()
    }
    res.send(artists)
})

router.get('/album', async(req, res) => {
    let tracks = await database.prepare('SELECT * from library WHERE album = ? ORDER BY (CASE WHEN track_no THEN track_no ELSE path END)').all(req.query.album)
    tracks.forEach(track => {
        track.path = track.path.replace(process.env.MUSIC_DIRECTORY, '')
    })
    res.send(tracks)
})

router.get('/artist', async(req, res) => {
    let tracks = await database.prepare('SELECT * from library WHERE artist = ? ORDER BY (CASE WHEN album THEN album ELSE path END)').all(req.query.artist)
    tracks.forEach(track => {
        track.path = track.path.replace(process.env.MUSIC_DIRECTORY, '')
    })
    res.send(tracks)
})

// From: https://stackoverflow.com/a/42591021/4932305
router.get('/track', async(req, res) => {
    const trackFilePath = process.env.MUSIC_DIRECTORY + '/' + req.query.path
    const stat = statSync(trackFilePath)
    const total = stat.size
    if (req.headers.range) {
        const range = req.headers.range
        const parts = range.replace(/bytes=/, '').split('-')
        const partialstart = parts[0]
        const partialend = parts[1]

        const start = parseInt(partialstart, 10)
        const end = partialend ? parseInt(partialend, 10) : total-1
        const chunksize = (end-start)+1
        const readStream = createReadStream(trackFilePath, { start: start, end: end })
        res.writeHead(206, {
            'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
            'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
            'Content-Type': mime.getType(trackFilePath)
        })
        readStream.pipe(res)
     } else {
        res.writeHead(200, { 'Content-Length': total, 'Content-Type': mime.getType(trackFilePath) })
        createReadStream(trackFilePath).pipe(res)
     }
})

router.get('/track-cover', async(req, res) => {
    const trackFilePath = process.env.MUSIC_DIRECTORY + '/' + req.query.path
    const trackFolderPath = path.dirname(trackFilePath)
    res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-disposition': 'inline'
    })
    try {
        const metadata = await mm.parseFile(trackFilePath)
        if(metadata.common.picture && metadata.common.picture.length > 0) {
            res.end(metadata.common.picture[0].data)
        } else {
            let possibleCoverFilePaths = [
                trackFolderPath + '/cover.png',
                trackFolderPath + '/Cover.png',
                trackFolderPath + '/cover.jpg',
                trackFolderPath + '/Cover.png'
            ]

            let foundCover = null

            for(const possibleCoverFilePath of possibleCoverFilePaths) {
                if(existsSync(possibleCoverFilePath)) {
                    foundCover = readFileSync(possibleCoverFilePath)
                    break
                }
            }

            if(foundCover) {
                res.end(foundCover)
            } else {
                throw new Error()
            }
        }
    } catch(e) {
        res.end()
    }
})

router.get('/authenticated-route', authCheck, async(req, res) => {
    res.send('Hi, this is an authenticated route')
})

export default router
