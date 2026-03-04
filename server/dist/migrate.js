import 'dotenv/config';
import { run } from './database.js';
async function migrate() {
    try {
        console.log("Adding reset_password_token and reset_password_expires...");
        await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token text unique;`);
        await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires timestamptz;`);
        console.log("Migration successful");
    }
    catch (e) {
        console.error("Migration failed", e);
    }
    process.exit();
}
migrate();
