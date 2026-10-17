import { describe, expect, it } from 'vitest'
import { createSearchIndex, searchTracks } from '../src/search.js'

describe('whole-library search', () => {
    it('returns no results for empty or whitespace-only queries', () => {
        const tracks = [{ path: 'one.mp3', title: 'One' }]
        const searchIndex = createSearchIndex(tracks)
        expect(searchTracks(searchIndex, '')).toEqual([])
        expect(searchTracks(searchIndex, ' \t\n ')).toEqual([])
    })

    it('requires every word across title, artist, album artist and album in any order', () => {
        const match = { path: 'one.mp3', title: 'Bohemian Rhapsody', artist: 'Queen', album_artist: 'Various Artists', album: 'Live at Wembley' }
        const other = { path: 'two.mp3', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera' }
        const searchIndex = createSearchIndex([other, match])
        expect(searchTracks(searchIndex, '  WEMBLEY queen bohemian various ')).toEqual([match])
        expect(searchTracks(searchIndex, 'queen nowhere')).toEqual([])
    })

    it('finds filename and path words when metadata is absent', () => {
        const tracks = [
            { path: 'Music\\Vinyl\\Track 01.flac' },
            { path: 'Music/Other/unknown.mp3', filename: 'Hidden recording.mp3' },
            { path: 'Music/Other/second.mp3', name: 'Session two.mp3' }
        ]
        const searchIndex = createSearchIndex(tracks)
        expect(searchTracks(searchIndex, 'vinyl track flac')).toEqual([tracks[0]])
        expect(searchTracks(searchIndex, 'hidden recording')).toEqual([tracks[1]])
        expect(searchTracks(searchIndex, 'session two')).toEqual([tracks[2]])
    })

    it('matches accents and composed or decomposed characters without case sensitivity', () => {
        const track = { path: 'one.mp3', title: 'Cafe\u0301 del Mar', artist: 'Beyonc\u00e9' }
        expect(searchTracks(createSearchIndex([track]), 'CAF\u00c9 beyonce')).toEqual([track])
    })

    it('ranks titles before metadata, filenames and folder paths', () => {
        const title = { path: 'one.mp3', title: 'A live recording' }
        const artist = { path: 'two.mp3', artist: 'Live' }
        const album = { path: 'three.mp3', album: 'Live' }
        const filename = { path: 'live.mp3' }
        const folder = { path: 'Live/other.mp3' }
        const results = searchTracks(createSearchIndex([folder, filename, album, artist, title]), 'live')
        expect(results[0]).toBe(title)
        expect(new Set(results.slice(1, 3))).toEqual(new Set([artist, album]))
        expect(results.slice(3)).toEqual([filename, folder])
    })

    it('prefers title-only matches before matches requiring metadata or a path', () => {
        const title = { path: 'one.mp3', title: 'Queen Live' }
        const metadata = { path: 'two.mp3', title: 'Queen', album: 'Live' }
        const path = { path: 'Live/three.mp3', title: 'Queen' }
        expect(searchTracks(createSearchIndex([path, metadata, title]), 'queen live')).toEqual([title, metadata, path])
    })

    it('ranks field starts, word starts and infixes in that order', () => {
        const start = { path: 'one.mp3', title: 'Live music' }
        const wordStart = { path: 'two.mp3', title: 'A Live recording' }
        const infix = { path: 'three.mp3', title: 'Olive branch' }
        expect(searchTracks(createSearchIndex([infix, wordStart, start]), 'live')).toEqual([start, wordStart, infix])
    })

    it('favors every word at a word start over mixed infix matches', () => {
        const wordStarts = { path: 'one.mp3', title: 'The Queen live' }
        const mixed = { path: 'two.mp3', title: 'Queen olive' }
        expect(searchTracks(createSearchIndex([mixed, wordStarts]), 'queen live')).toEqual([wordStarts, mixed])
    })

    it('ignores leading punctuation when ranking field-start matches', () => {
        const currency = { path: 'one.mp3', title: '$Song' }
        const parentheses = { path: 'two.mp3', title: '(Song)' }
        const wordStart = { path: 'three.mp3', title: '!A Song' }
        const results = searchTracks(createSearchIndex([wordStart, currency, parentheses]), 'song')
        expect(new Set(results.slice(0, 2))).toEqual(new Set([currency, parentheses]))
        expect(results[2]).toBe(wordStart)
    })

    it('uses the best occurrence and recognizes punctuation between words', () => {
        const bestOccurrence = { path: 'one.mp3', title: 'Olive: Live' }
        const infix = { path: 'two.mp3', title: 'Olive branch' }
        expect(searchTracks(createSearchIndex([infix, bestOccurrence]), 'live')).toEqual([bestOccurrence, infix])
        expect(searchTracks(createSearchIndex([{ path: 'three.mp3', artist: 'AC/DC', title: 'Thunderstruck' }]), 'ac dc')).toHaveLength(1)
    })

    it('breaks equal-score ties naturally by title, name and path without changing inputs', () => {
        const tracks = Object.freeze([
            Object.freeze({ path: 'z.mp3', title: 'Song 10' }),
            Object.freeze({ path: 'z.mp3', name: 'Track 10', title: 'song 2' }),
            Object.freeze({ path: 'z.mp3', name: 'Track 2', title: 'Song 2' }),
            Object.freeze({ path: 'a.mp3', name: 'Track 2', title: 'Song 2' })
        ])
        const results = searchTracks(createSearchIndex(tracks), 'song')
        expect(results).toEqual([tracks[3], tracks[2], tracks[1], tracks[0]])
        expect(results[0]).toBe(tracks[3])
        expect(tracks.map(track => track.path)).toEqual(['z.mp3', 'z.mp3', 'z.mp3', 'a.mp3'])
    })

    it('keeps repeated queries on prepared metadata until a new library snapshot replaces it', () => {
        const original = { path: 'one.mp3', title: 'Old title', artist: 'Original artist' }
        const removed = { path: 'removed.mp3', title: 'Removed song' }
        const tracks = [original, removed]
        const searchIndex = createSearchIndex(tracks)
        original.title = 'Updated title'
        original.artist = 'New artist'
        const added = { path: 'added.mp3', title: 'Added song' }
        tracks.splice(1, 1, added)

        expect(searchTracks(searchIndex, 'old original')[0]).toBe(original)
        expect(searchTracks(searchIndex, 'removed')).toEqual([removed])
        expect(searchTracks(searchIndex, 'updated')).toEqual([])
        expect(searchTracks(searchIndex, 'added')).toEqual([])

        const searchIndexUpdated = createSearchIndex(tracks)
        expect(searchTracks(searchIndexUpdated, 'old original')).toEqual([])
        expect(searchTracks(searchIndexUpdated, 'removed')).toEqual([])
        expect(searchTracks(searchIndexUpdated, 'updated new')[0]).toBe(original)
        expect(searchTracks(searchIndexUpdated, 'added')[0]).toBe(added)
        expect(searchTracks(searchIndex, 'old original')[0]).toBe(original)
    })
})
