import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;
const dbUrl = fs.readFileSync('db.txt', 'utf8').trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function checkTriggers() {
    try {
        const res = await pool.query(`
            SELECT trigger_name, event_manipulation, event_object_table, action_statement 
            FROM information_schema.triggers 
            WHERE event_object_table = 'users' OR action_statement LIKE '%users%'
        `);
        console.log('Triggers:', res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkTriggers();
