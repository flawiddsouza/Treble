import crypto from 'crypto'
import * as db from './db.js'

export function requestValidator(fieldsToValidate) {
    return function(req, res, next) {
        for(const field of fieldsToValidate) {
            if(field in req.body === false || req.body[field] === '' || req.body[field] === null) {
                return res.status(400).send(`${field} field is required`)
            }
        }

        next()
    }
}

export function generateRandomString(size = 64) {
    return crypto.randomBytes(size).toString('base64').slice(0, size)
}

export async function authCheck(req, res, next) {
    try {
        const authHeader = String(req.headers['authorization'] || '')
        if(authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7, authHeader.length)
            req.user = await db.validateUserToken(token)
            req.token = token
        } else {
            throw new Error('No bearer token provided')
        }
        next()
    } catch(e) {
        if(e.message !== 'No bearer token provided') {
            res.status(401).send('Invalid bearer token provided')
        } else {
            res.status(401).send(e.message)
        }
    }
}
