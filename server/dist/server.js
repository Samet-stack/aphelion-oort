import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { initDb } from './database.js';
import { verifyEmailConfig } from './services/email.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import shareRoutes from './routes/shares.js';
import exportRoutes from './routes/export.js';
import planRoutes from './routes/plans.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/plans', planRoutes);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'SiteFlow API is running',
        timestamp: new Date().toISOString()
    });
});
// Servir le frontend en production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}
// Error handler
app.use((err, req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Erreur serveur interne.'
    });
});
// Initialisation et démarrage
const start = async () => {
    try {
        // Initialiser la base de données
        await initDb();
        // Vérifier la configuration email
        await verifyEmailConfig();
        // Démarrer le serveur
        app.listen(PORT, () => {
            console.log('╔════════════════════════════════════════════════╗');
            console.log('║         SITEFLOW PRO API SERVER                ║');
            console.log('╠════════════════════════════════════════════════╣');
            console.log(`║  🚀 Port: ${PORT}                             ║`);
            console.log(`║  🐘 Base: PostgreSQL (Supabase)                ║`);
            console.log(`║  🔐 Auth: JWT (7j expiration)                  ║`);
            console.log('╚════════════════════════════════════════════════╝');
            console.log('');
            console.log('Endpoints disponibles:');
            console.log('  POST /api/auth/register - Créer un compte');
            console.log('  POST /api/auth/login    - Connexion');
            console.log('  GET  /api/auth/me       - Profil (protégé)');
            console.log('  GET  /api/reports       - Liste rapports (protégé)');
            console.log('  POST /api/reports       - Créer rapport (protégé)');
            console.log('');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
start();
