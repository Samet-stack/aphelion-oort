import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;
const dbUrl = fs.readFileSync('db.txt', 'utf8').trim();
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// I will copy `normalizeSql` and `dbRun` to see if they work correctly
const normalizeSql = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
};

const dbRun = async (sql, params = []) => {
    const result = await pool.query(normalizeSql(sql), params);
    return { changes: result.rowCount ?? 0 };
};

async function testRegister() {
    try {
        const id = '11111111-1111-1111-1111-111111111111';
        const email = 'test.null@aphelion.com';
        const passwordHash = 'fake_hash_123';
        const firstName = 'John';
        const lastName = 'Doe';
        const companyName = 'Aphelion';

        console.log('Inserting...');
        await dbRun(
            'INSERT INTO users (id, email, password, first_name, last_name, company_name, email_verified) VALUES (?, ?, ?, ?, ?, ?, true)',
            [id, email.toLowerCase(), passwordHash, firstName, lastName, companyName]
        );

        console.log('Querying back...');
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        console.log('Inserted Row:', res.rows[0]);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

testRegister();
