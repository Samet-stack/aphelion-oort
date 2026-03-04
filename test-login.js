import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;
const dbUrl = fs.readFileSync('db.txt', 'utf8').trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function testLogin() {
    try {
        const email = 'samet.test777@aphelion.com';
        console.log('Fetching user...');
        const result = await pool.query(
            'SELECT id, email, password, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            console.log('User not found');
            return;
        }

        const user = result.rows[0];
        console.log('User found:', user.email);

        console.log('Updating last login...');
        await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        console.log('Success!');
    } catch (err) {
        console.error('SQL Error during login:', err);
    } finally {
        pool.end();
    }
}

testLogin();
