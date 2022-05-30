import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import apiRoutes from './routes/api.js'

const app = express()
const port = process.env.PORT ?? 4001

app.use(express.json())
app.use(cors())

app.use('/auth', authRoutes)
app.use('/api', apiRoutes)

app.listen(port, () => console.log(`Listening on http://localhost:${port}`))
