import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(password)}@db.oihfscgkigahmanxakoz.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

const sqlFile = process.argv[2];

await client.connect();
try {
  if (sqlFile) {
    const sql = readFileSync(join(__dirname, '..', sqlFile), 'utf8');
    await client.query(sql);
    console.log('Executed', sqlFile);
  }

  const checks = [
    ['vehicles', 'select count(*)::int as n from vehicles'],
    ['per789', "select placa from vehicles where placa = 'PER-789'"],
    ['trips', 'select count(*)::int as n from trips'],
    ['alerts', 'select count(*)::int as n from ai_alerts'],
    ['incidents', 'select count(*)::int as n from incidents'],
    ['events', 'select count(*)::int as n from incident_events'],
  ];
  for (const [label, q] of checks) {
    const r = await client.query(q);
    console.log(label, r.rows);
  }
} finally {
  await client.end();
}
