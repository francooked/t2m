import { drizzle } from 'drizzle-orm/postgres-js';

async function main() {
	if (!process.env.DATABASE_URL) throw new Error('Undefined DATABASE_URL environment variable.');

	const db = drizzle(process.env.DATABASE_URL);
	await db.$client.end();
	console.log('🌱 Seed completed! 🎉');
}

main();
