import * as db from "../src/db.js"

async function clearExpiredUserTokens() {
    const count = await db.clearExpiredUserTokens()
    if(count > 0) {
        console.log(`Cleared ${count} expired token${count > 1 ? 's' : ''}`)
    } else {
        console.log('Nothing to clear')
    }
    process.exit()
}

clearExpiredUserTokens()
