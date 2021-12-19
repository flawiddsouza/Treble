export async function up(sql) {
	await sql`
        CREATE TABLE users (
            id serial PRIMARY KEY,
            email text UNIQUE NOT NULL,
            password text NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `
}

export async function down(sql) {
	await sql`
        DROP TABLE users
    `
}
