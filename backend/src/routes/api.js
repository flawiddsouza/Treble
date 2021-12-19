import express from 'express'
import { authCheck } from '../helpers.js'

const router = express.Router()

router.get('/unauthenticated-route', async(req, res) => {
    res.send('Hi, this is an unauthenticated route')
})

router.get('/authenticated-route', authCheck, async(req, res) => {
    res.send('Hi, this is an authenticated route')
})

export default router
