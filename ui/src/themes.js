export const themes = [
    { id: 'turquoise-dreams', label: 'Turquoise Dreams' },
    { id: 'purple', label: 'Purple' },
    { id: 'royalty', label: 'Royalty' },
    { id: 'dark', label: 'Dark' }
]

const defaultTheme = themes[0].id
const themeIds = new Set(themes.map(theme => theme.id))
const themeStorageKey = 'Treble-Theme'

export function getTheme() {
    const theme = document.documentElement.dataset.theme
    return themeIds.has(theme) ? theme : defaultTheme
}

export function setTheme(id) {
    if (!themeIds.has(id)) return getTheme()
    document.documentElement.dataset.theme = id
    try { window.localStorage.setItem(themeStorageKey, id) } catch { /* The theme still applies when storage is unavailable. */ }
    return id
}

export function initializeTheme() {
    let savedTheme
    try { savedTheme = window.localStorage.getItem(themeStorageKey) } catch { /* Use the default when storage is unavailable. */ }
    const theme = themeIds.has(savedTheme) ? savedTheme : defaultTheme
    document.documentElement.dataset.theme = theme
    return theme
}
