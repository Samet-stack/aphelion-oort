import dotenv from 'dotenv';
import { initDb } from './database.js';
dotenv.config();
console.log('🔄 Initialisation de la base de données...');
initDb()
    .then(() => {
    console.log('✅ Base de données prête !');
    process.exit(0);
})
    .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
