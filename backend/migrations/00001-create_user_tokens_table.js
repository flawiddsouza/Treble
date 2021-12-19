export async function up(sql) {
	await sql`
        CREATE TABLE user_tokens (
            id serial PRIMARY KEY,
            user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token text NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `
}

export async function down(sql) {
	await sql`
        DROP TABLE user_tokens
    `
}
