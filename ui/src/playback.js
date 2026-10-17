export function isTrack(item) {
    return typeof item?.path === 'string' && (!Array.isArray(item.children) || item.children.length === 0)
}

export function flattenTracks(items) {
    return items.flatMap(item => isTrack(item) ? [item] : flattenTracks(item.children || []))
}

export function playbackOrder(tracks, selectedPath, shuffle, random = Math.random) {
    const paths = tracks.filter(isTrack).map(track => track.path)
    if (!shuffle) return paths
    const remainingPaths = paths.filter(path => path !== selectedPath)
    for (let index = remainingPaths.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1))
        ;[remainingPaths[index], remainingPaths[randomIndex]] = [remainingPaths[randomIndex], remainingPaths[index]]
    }
    return paths.includes(selectedPath) ? [selectedPath, ...remainingPaths] : remainingPaths
}

export function adjacentTrackPath(order, selectedPath, direction, repeat, ended = false) {
    const selectedIndex = order.indexOf(selectedPath)
    if (selectedIndex < 0 || order.length === 0) return null
    if (ended && repeat === 'one') return selectedPath
    const nextIndex = selectedIndex + direction
    if (nextIndex >= 0 && nextIndex < order.length) return order[nextIndex]
    if (repeat === 'all') return order[(nextIndex + order.length) % order.length]
    return null
}
