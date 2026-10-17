export function formatSecondsAsTime(seconds) {
    const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const remainder = total % 60
    const time = `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    return hours ? `${hours}:${time}` : time
}

export function savedVolume(value) {
    if (value === null || value.trim() === '') return 1
    const volume = Number(value)
    return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 1
}
