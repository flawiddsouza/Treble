const titleOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function normalize(value) {
    return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function matchPosition(value, word) {
    let position = value.indexOf(word)
    if (position < 0) return -1
    if (!/[\p{L}\p{N}]/u.test(value.slice(0, position))) return 0
    while (position >= 0) {
        if (!/[\p{L}\p{N}]/u.test(value[position - 1])) return 1
        position = value.indexOf(word, position + 1)
    }
    return 2
}

export function createSearchIndex(tracks) {
    return tracks.map(track => {
        const filename = track.path?.split(/[\\/]/).pop()
        return {
            track,
            fields: [
                [track.title],
                [track.artist, track.album_artist, track.album],
                [track.filename, track.name, filename],
                [track.path]
            ].map(values => [...new Set(values.filter(value => value != null).map(normalize))]),
            order: [track.title || '', track.name || '', track.path || '']
        }
    }).sort((left, right) => {
        for (let index = 0; index < left.order.length; index++) {
            const difference = titleOrder.compare(left.order[index], right.order[index])
            if (difference) return difference
        }
        return 0
    })
}

function trackScore(fields, words) {
    let maxField = 0, fieldTotal = 0, maxPosition = 0, positionTotal = 0
    for (const word of words) {
        let matchedField = -1, matchedPosition = -1
        for (let field = 0; field < fields.length; field++) {
            let position = -1
            for (const value of fields[field]) {
                const match = matchPosition(value, word)
                if (match >= 0 && (position < 0 || match < position)) position = match
                if (position === 0) break
            }
            if (position >= 0) {
                matchedField = field
                matchedPosition = position
                break
            }
        }
        if (matchedField < 0) return null
        maxField = Math.max(maxField, matchedField)
        fieldTotal += matchedField
        maxPosition = Math.max(maxPosition, matchedPosition)
        positionTotal += matchedPosition
    }
    return [maxField, fieldTotal, maxPosition, positionTotal]
}

export function searchTracks(searchIndex, query) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return searchIndex.map(entry => ({ track: entry.track, score: trackScore(entry.fields, words) }))
        .filter(result => result.score)
        .sort((left, right) => {
            for (let index = 0; index < left.score.length; index++) {
                const difference = left.score[index] - right.score[index]
                if (difference) return difference
            }
            return 0
        })
        .map(result => result.track)
}
