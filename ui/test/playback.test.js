import { describe, expect, it } from 'vitest'
import { isTrack, flattenTracks, playbackOrder, adjacentTrackPath } from '../src/playback.js'

const one = { id: 1, path: 'one.mp3', children: [] }
const two = { id: 2, path: 'two.mp3', children: [] }
const three = { id: 3, path: 'three.mp3', children: [] }
const folder = { path: 'album', children: [one, two] }

describe('playback queue', () => {
    it('uses only files and handles a one-track shuffled queue without retrying random selection', () => {
        expect(isTrack(folder)).toBe(false)
        expect(flattenTracks([folder, three])).toEqual([one, two, three])
        const order = playbackOrder([folder, one], one.path, true, () => 0)
        expect(order).toEqual([one.path])
        expect(adjacentTrackPath(order, one.path, 1, 'none', true)).toBeNull()
        expect(adjacentTrackPath(order, one.path, 1, 'all', true)).toBe(one.path)
    })

    it('shuffles the remaining tracks once and plays each before stopping', () => {
        const order = playbackOrder([one, two, three], two.path, true, () => 0)
        expect(order[0]).toBe(two.path)
        expect(new Set(order)).toEqual(new Set([one.path, two.path, three.path]))
        expect(adjacentTrackPath(order, order[0], 1, 'none')).toBe(order[1])
        expect(adjacentTrackPath(order, order[2], 1, 'none')).toBeNull()
    })

    it('repeats one only after ending and wraps both boundaries only for repeat all', () => {
        const order = playbackOrder([one, two], one.path, false)
        expect(adjacentTrackPath(order, one.path, 1, 'one', true)).toBe(one.path)
        expect(adjacentTrackPath(order, one.path, 1, 'one', false)).toBe(two.path)
        expect(adjacentTrackPath(order, one.path, -1, 'none')).toBeNull()
        expect(adjacentTrackPath(order, one.path, -1, 'all')).toBe(two.path)
        expect(adjacentTrackPath(order, two.path, 1, 'all')).toBe(one.path)
        expect(adjacentTrackPath([], one.path, 1, 'all')).toBeNull()
        expect(adjacentTrackPath(order, 'removed.mp3', 1, 'all')).toBeNull()
    })
})
