import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { reset } from 'drizzle-seed';

async function main() {
	if (!process.env.DATABASE_URL) throw new Error('Undefined DATABASE_URL environment variable.');
	const db = drizzle(process.env.DATABASE_URL);
	await reset(db, { ...schema, ...authSchema });
	await db.$client.end();
	console.log('🔄 Base de datos restablecida exitosamente! 🎉');
}

main();
