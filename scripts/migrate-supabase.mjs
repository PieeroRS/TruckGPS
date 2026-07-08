/**
 * Ejecuta migraciones SQL contra Supabase Postgres.
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_DB_PASSWORD="tu_password_de_database"
 *   node scripts/migrate-supabase.mjs
 *
 * Opcional: solo migraciones (sin seed):
 *   $env:SKIP_SEED="1"; node scripts/migrate-supabase.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const PROJECT_REF = 'oihfscgkigahmanxakoz';
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('Falta SUPABASE_DB_PASSWORD (contraseña de Database en Supabase Settings).');
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ??
  `postgresql://postgres:${encodeURIComponent(password)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = [
  '001_initial_schema.sql',
  '002_conductor_tracking.sql',
  '003_profiles_admin.sql',
  '004_ensure_profiles.sql',
  '005_map_live.sql',
  '006_nav_routes.sql',
  '007_crud_policies.sql'
].map((f) => join(root, 'supabase/migrations', f));

const files = process.env.SKIP_SEED === '1'
  ? migrations
  : [...migrations, join(root, 'supabase/seed.sql')];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('Conectado a Supabase Postgres.');

  for (const file of files) {
    const sql = readFileSync(file, 'utf8');
    console.log(`Ejecutando ${file}...`);
    await client.query(sql);
    console.log(`OK: ${file}`);
  }

  const counts = await client.query(`
    select
      (select count(*)::int from public.vehicles) as vehicles,
      (select count(*)::int from public.incidents) as incidents,
      (select count(*)::int from public.ai_alerts) as ai_alerts,
      (select count(*)::int from public.nav_routes) as nav_routes
  `);
  console.log('Conteos:', counts.rows[0]);
  console.log('Migración completada.');
} catch (err) {
  console.error('Error en migración:', err.message);
  if (String(err.message).includes('Tenant or user not found')) {
    console.error('Prueba con región distinta. En Supabase → Database → Connection string copia el URI del pooler Session mode.');
  }
  process.exit(1);
} finally {
  await client.end();
}
