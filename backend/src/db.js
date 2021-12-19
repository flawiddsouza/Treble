import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import ms from 'ms'
import sql from '../sql.js'

const saltRounds = 10

export async function getUsers() {
    const users = await sql`
        select id, email, created_at, updated_at from users
    `
    return users
}

export async function createUser(email, password) {
    try {
        const hashedPassword = bcrypt.hashSync(password, saltRounds)
        const [createdUser] = await sql`
            insert into users(email, password) values(${email}, ${hashedPassword})
            returning id, created_at, updated_at
        `
        return createdUser
    } catch(e) {
        throw new Error('Email already registered')
    }
}

export async function findUserByEmail(email) {
    const [user] = await sql`select * from users where email = ${email}`

    if(!user) {
        throw new Error('User not found')
    }

    return user
}

export async function findUserById(id) {
    const [user] = await sql`select * from users where id = ${id}`

    if(!user) {
        throw new Error('User not found')
    }

    return user
}

export async function validateUser(email, password) {
    try {
        const user = await findUserByEmail(email)
        if(bcrypt.compareSync(password, user.password)) {
            return { id: user.id }
        } else {
            throw new Error('Invalid password')
        }
    } catch(e) {
        throw new Error(e.message)
    }
}

export async function createUserToken(email, password) {
    try {
        const user = await validateUser(email, password) // will throw error if validation fails
        const expiresIn = ms(process.env.JWT_EXPIRY)
        const expiresAt = new Date(Date.now() + expiresIn)
        const token = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET, {
            expiresIn: expiresIn
        })
        await sql`insert into user_tokens(user_id, token, expires_at) values(${user.id}, ${token}, ${expiresAt})`
        return token
    } catch(e) {
        throw new Error(e.message)
    }
}

export async function validateUserToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const [userToken] = await sql`select (case when count(*) > 0 then true else FALSE end) as token_found from user_tokens WHERE user_id = ${decoded.user_id} AND token = ${token}`
        if(userToken.token_found) {
            return { id: decoded.user_id }
        } else {
            throw new Error('Invalid token')
        }
    } catch(e) {
        throw new Error(e.message)
    }
}

export async function changeUserPassword(userId, currentPassword, newPassword) {
    const user = await findUserById(userId)
    if(bcrypt.compareSync(currentPassword, user.password)) {
        const hashedPassword = bcrypt.hashSync(newPassword, saltRounds)
        await sql`update users set password=${hashedPassword} where id = ${userId}`
    } else {
        throw new Error('Invalid current password')
    }
}

export async function clearUserToken(token) {
    await sql`delete from user_tokens WHERE token = ${token}`
}

export async function clearExpiredUserTokens() {
    const { count } = await sql`delete from user_tokens WHERE expires_at < now()`
    return count
}
