import express from 'express'
import * as db from '../db.js'
import { requestValidator, authCheck } from '../helpers.js'

const router = express.Router()

router.post('/register', requestValidator(['email', 'password']), async(req, res) => {
    try {
        const createdUser = await db.createUser(req.body.email, req.body.password)
        res.send(createdUser)
    } catch(e) {
        res.status(400).send(e.message)
    }
})

router.post('/login', requestValidator(['email', 'password']), async(req, res) => {
    try {
        const token = await db.createUserToken(req.body.email, req.body.password)
        res.send({ token })
    } catch(e) {
        res.status(400).send(e.message)
    }
})

router.post('/change-password', authCheck, requestValidator(['currentPassword', 'newPassword']), async(req, res) => {
    try {
        await db.changeUserPassword(req.user.id, req.body.currentPassword, req.body.newPassword)
        res.send('Password changed')
    } catch(e) {
        res.status(400).send(e.message)
    }
})

router.post('/logout', authCheck, async(req, res) => {
    try {
        await db.clearUserToken(req.token)
        res.send('Logged out')
    } catch(e) {
        res.send(400).send(e.message)
    }
})

export default router
