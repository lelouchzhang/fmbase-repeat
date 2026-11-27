import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const { rows } = await pool.query(`
    TRUNCATE TABLE
      users,
      accounts,
      organizations,
      organizations_members,
      projects
    RESTART IDENTITY
    CASCADE;
  `);
  console.log('All records deleted. Tables are now empty.');
} catch (error) {
  console.error('Failed to reset database:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
