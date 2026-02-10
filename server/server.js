import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import { verifyEmailConfig } from './services/email.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import shareRoutes from './routes/shares.js';
import exportRoutes from './routes/export.js';
import planRoutes from './routes/plans.js';
import aiRoutes from './routes/ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ].filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // curl / server-to-server
  if (allowedOrigins.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    // Allow Vercel preview deployments for demos.
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: false,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai', aiRoutes);

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
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne.'
  });
});

// Initialisation et démarrage
const start = async () => {
  try {
    // En production, éviter de relancer le SQL schema à chaque redémarrage
    // (surtout si l'API est déployée en serverless). Lance `npm --prefix server run init-db` au besoin.
    const shouldInitDb =
      process.env.AUTO_INIT_DB === 'true' || process.env.NODE_ENV !== 'production';
    if (shouldInitDb) {
      await initDb();
    }

    const shouldVerifySmtp =
      process.env.VERIFY_SMTP === 'true' || process.env.NODE_ENV !== 'production';
    if (shouldVerifySmtp) {
      await verifyEmailConfig();
    }
    
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
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
