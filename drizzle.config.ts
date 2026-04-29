import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.TRAJECTORY_DB_FILE ?? './data/db.sqlite'
	},
	verbose: true,
	strict: true
});
