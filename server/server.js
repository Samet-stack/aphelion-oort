import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './database.js';
import { verifyEmailConfig } from './services/email.js';
import { getCacheStatus, initializeCache } from './services/cache.js';
import { logger } from './services/logger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { attachRequestContext, httpRequestLogger } from './middleware/requestLogger.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import shareRoutes from './routes/shares.js';
import exportRoutes from './routes/export.js';
import siteRoutes from './routes/sites.js';
import planRoutes from './routes/plans.js';
import aiRoutes from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', true);
app.use(attachRequestContext);
app.use(httpRequestLogger);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));

// Rate limiting global
app.use('/api/', apiLimiter);

// CORS configuration
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ].filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  // Allow requests without Origin header (curl, health checks, server-to-server).
  // Browser CORS protection still applies for cross-origin frontends.
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  // Only allow specific Vercel deployments, not all .vercel.app
  const allowedVercelSlug = process.env.VERCEL_SLUG;
  if (allowedVercelSlug && origin.includes(allowedVercelSlug)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) {
        cb(null, origin);
      } else {
        cb(new Error('CORS not allowed'));
      }
    },
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
app.use('/api/sites', siteRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'SiteFlow API is running',
    timestamp: new Date().toISOString(),
    cache: getCacheStatus(),
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
  logger.error('Unhandled server error', {
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    userId: req?.user?.id,
    error: {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    },
  });
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

    await initializeCache();
    
    // Démarrer le serveur
    app.listen(PORT, () => {
      logger.info('API server started', {
        port: Number(PORT),
        nodeEnv: process.env.NODE_ENV || 'development',
        database: 'postgresql',
        auth: 'jwt',
        cache: getCacheStatus(),
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', {
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    });
    process.exit(1);
  }
};

start();
