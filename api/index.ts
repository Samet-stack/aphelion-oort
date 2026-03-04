// Vercel serverless entry point for the Express backend
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pg from 'pg';

const { Pool } = pg;

//  ─── Database ─────────────────────────────────────────────────────────────────

let pool: any;

const getPool = () => {
    const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('SUPABASE_DB_URL is required');

    if (!pool) {
        const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
        let connectionString = databaseUrl;
        if (!isLocal) {
            try {
                const parsed = new URL(databaseUrl);
                parsed.searchParams.delete('sslmode');
                connectionString = parsed.toString();
            } catch { /* keep original */ }
        }
        pool = new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: false } });
    }
    return pool;
};

const normalizeSql = (sql: string) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
};

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
const toCamelObj = (obj: any) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), v]));

const dbGet = async (sql: string, params: any[] = []) => {
    const db = getPool();
    const result = await db.query(normalizeSql(sql), params);
    if (result.rows.length === 0) return undefined;
    return toCamelObj(result.rows[0]);
};

const dbRun = async (sql: string, params: any[] = []) => {
    const db = getPool();
    const result = await db.query(normalizeSql(sql), params);
    return { changes: result.rowCount ?? 0 };
};

//  ─── Auth helpers ──────────────────────────────────────────────────────────────

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production');
    }
    return 'dev-secret-change-me';
};

const generateToken = (userId: string) =>
    (jwt as any).sign({ userId }, getJwtSecret(), { expiresIn: '7d' });

const authMiddleware = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = (jwt as any).verify(token, getJwtSecret()) as any;
        const user = await dbGet(
            'SELECT id, email, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE id = ?',
            [decoded.userId]
        );
        if (!user) return res.status(401).json({ success: false, message: 'Utilisateur non trouvé.' });
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token invalide ou expiré.' });
    }
};

//  ─── App ───────────────────────────────────────────────────────────────────────

const app = express();

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://aphelion-oort.vercel.app',
    process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const vercelProjectHostname = /^aphelion-oort(?:-[a-z0-9-]+)?\.vercel\.app$/i;

const isAllowedOrigin = (origin: string) => {
    if (allowedOrigins.includes(origin)) return true;
    try {
        const hostname = new URL(origin).hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        if (vercelProjectHostname.test(hostname)) return true;
    } catch {
        return false;
    }
    return false;
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || isAllowedOrigin(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'SiteFlow API is running', timestamp: new Date().toISOString() });
});

app.get('/api/db-test', async (_req, res) => {
    try {
        const db = getPool();
        const result = await db.query('SELECT current_setting(\'server_version\') as version');
        res.json({ success: true, version: result.rows[0].version });
    } catch (error: any) {
        res.json({ success: false, error: error.message, stack: error.stack, code: error.code });
    }
});

//  ─── Auth routes ───────────────────────────────────────────────────────────────

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { email, password, firstName, lastName, companyName } = req.body;
        if (!email || !password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Email et mot de passe (6 car. min) requis.' });
        }
        const existing = await dbGet('SELECT id, password FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existing) {
            if (!existing.password) {
                // Auto-migrate legacy user
                const hashedPassword = await bcrypt.hash(password, 10);
                await dbRun(
                    'UPDATE users SET password = ?, first_name = COALESCE(first_name, ?), last_name = COALESCE(last_name, ?), company_name = COALESCE(company_name, ?) WHERE id = ?',
                    [hashedPassword, firstName || null, lastName || null, companyName || null, existing.id]
                );
                return res.status(201).json({ success: true, message: 'Compte existant mis à jour avec le nouveau mot de passe.', data: { userId: existing.id, emailSent: false, preview: false } });
            }
            return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await dbRun(
            'INSERT INTO users (id, email, password, first_name, last_name, company_name, email_verified) VALUES (?, ?, ?, ?, ?, ?, true)',
            [userId, email.toLowerCase(), hashedPassword, firstName || null, lastName || null, companyName || null]
        );
        res.status(201).json({ success: true, message: 'Compte créé avec succès.', data: { userId, emailSent: false, preview: false } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la création du compte.' });
    }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });

        const user = await dbGet(
            'SELECT id, email, password, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        if (!user) return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
        if (!user.password) return res.status(401).json({ success: false, message: 'Veuillez réinitialiser votre mot de passe pour mettre à jour votre compte.' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });

        await dbRun('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        const token = generateToken(String(user.id));
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, message: 'Connexion réussie.', data: { user: userWithoutPassword, token } });
    } catch (err: any) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la connexion.', error: err.message, stack: err.stack });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req: any, res) => {
    res.json({ success: true, data: { user: req.user } });
});

// Update profile
app.put('/api/auth/profile', authMiddleware, async (req: any, res) => {
    try {
        const { firstName, lastName, companyName } = req.body;
        const userId = req.user.id;
        await dbRun(
            'UPDATE users SET first_name = ?, last_name = ?, company_name = ?, updated_at = NOW() WHERE id = ?',
            [firstName || null, lastName || null, companyName || null, userId]
        );
        const updatedUser = await dbGet(
            'SELECT id, email, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE id = ?',
            [userId]
        );
        res.json({ success: true, message: 'Profil mis à jour.', data: { user: updatedUser } });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du profil.' });
    }
});

// Change password
app.put('/api/auth/password', authMiddleware, async (req: any, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau requis (6 car. min).' });
        }
        const user = await dbGet('SELECT password FROM users WHERE id = ?', [userId]);
        if (!user?.password) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
        const hashed = await bcrypt.hash(newPassword, 10);
        await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
        res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors du changement de mot de passe.' });
    }
});

// Forgot password
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email requis.' });
        const user = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) return res.json({ success: true, message: 'Si cet email correspond à un compte, un lien de réinitialisation vous a été envoyé.' });
        const resetToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        await dbRun(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
            [resetToken, expiresAt.toISOString(), user.id]
        );
        res.json({ success: true, message: 'Si cet email correspond à un compte, un lien de réinitialisation vous a été envoyé.', data: { emailSent: false, preview: false } });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Une erreur est survenue.' });
    }
});

// Verify email (compat route)
app.get('/api/auth/verify-email', authLimiter, async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
        return res.status(400).json({ success: false, message: 'Token de verification manquant.' });
    }
    return res.json({ success: true, message: 'Email verifie avec succes.' });
});

// Resend verification (compat route)
app.post('/api/auth/resend-verification', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email requis.' });
    }
    return res.json({ success: true, message: 'Email de verification renvoye.', data: { emailSent: false } });
});

// Reset password
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe (6 car. min) requis.' });
        }
        const user = await dbGet(
            "SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()",
            [token]
        );
        if (!user) return res.status(400).json({ success: false, message: 'Lien invalide ou expiré.' });
        const hashed = await bcrypt.hash(newPassword, 10);
        await dbRun(
            'UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = ?',
            [hashed, user.id]
        );
        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ success: false, message: 'Une erreur est survenue.' });
    }
});

//  ─── Reports routes ────────────────────────────────────────────────────────────

app.get('/api/reports', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        const result = await db.query(
            'SELECT id, report_id, created_at, date_label, address, coordinates, accuracy, location_source, description, image_data_url, site_name, operator_name, client_name, priority, category, integrity_hash, client_signature FROM reports WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        const reports = await Promise.all(result.rows.map(async (r: any) => {
            const ewResult = await db.query('SELECT * FROM extra_works WHERE report_id = $1', [r.id]);
            return { ...toCamelObj(r), extraWorks: ewResult.rows.map(toCamelObj) };
        }));
        res.json({ success: true, data: { reports } });
    } catch (err) {
        console.error('Get reports error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des rapports.' });
    }
});

app.get('/api/reports/stats/summary', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        const rRes = await db.query('SELECT COUNT(*) as count FROM reports WHERE user_id = $1', [req.user.id]);
        const ewRes = await db.query(
            'SELECT COUNT(*) as count, COALESCE(SUM(estimated_cost), 0) as total FROM extra_works WHERE user_id = $1',
            [req.user.id]
        );
        res.json({
            success: true,
            data: {
                totalReports: parseInt(rRes.rows[0].count),
                totalExtraWorks: parseInt(ewRes.rows[0].count),
                totalExtraValue: parseFloat(ewRes.rows[0].total),
                byCategory: []
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur stats.' });
    }
});

app.get('/api/reports/:id', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        const result = await db.query('SELECT * FROM reports WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Rapport non trouvé.' });
        const report = result.rows[0];
        const ewResult = await db.query('SELECT * FROM extra_works WHERE report_id = $1', [report.id]);
        res.json({ success: true, data: { report: { ...toCamelObj(report), extraWorks: ewResult.rows.map(toCamelObj) } } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.post('/api/reports', authMiddleware, async (req: any, res) => {
    try {
        const { reportId, dateLabel, address, coordinates, accuracy, locationSource, description, imageDataUrl, siteName, operatorName, clientName, priority, category, integrityHash, clientSignature, extraWorks = [], planId, planPointId, siteId } = req.body;
        const db = getPool();
        const newId = uuidv4();
        await db.query(
            'INSERT INTO reports (id, user_id, report_id, date_label, address, coordinates, accuracy, location_source, description, image_data_url, site_name, operator_name, client_name, priority, category, integrity_hash, client_signature, plan_id, plan_point_id, site_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)',
            [newId, req.user.id, reportId || uuidv4(), dateLabel, address, coordinates, accuracy, locationSource, description, imageDataUrl, siteName, operatorName, clientName, priority, category, integrityHash, clientSignature, planId, planPointId, siteId]
        );
        for (const ew of extraWorks) {
            await db.query(
                'INSERT INTO extra_works (id, report_id, user_id, description, estimated_cost, urgency, category) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                [uuidv4(), newId, req.user.id, ew.description, ew.estimatedCost || 0, ew.urgency || 'medium', ew.category]
            );
        }
        const result = await db.query('SELECT * FROM reports WHERE id = $1', [newId]);
        const ewResult = await db.query('SELECT * FROM extra_works WHERE report_id = $1', [newId]);
        const report = { ...toCamelObj(result.rows[0]), extraWorks: ewResult.rows.map(toCamelObj) };
        res.status(201).json({ success: true, data: { report } });
    } catch (err) {
        console.error('Create report error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la création du rapport.' });
    }
});

app.delete('/api/reports/:id', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        await db.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Rapport supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

//  ─── Plans routes ──────────────────────────────────────────────────────────────

app.get('/api/plans', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        const result = await db.query('SELECT p.id, p.site_name, p.address, p.created_at, p.updated_at, p.plan_name, COUNT(pp.id) as points_count FROM plans p LEFT JOIN plan_points pp ON pp.plan_id = p.id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC', [req.user.id]);
        res.json({ success: true, data: { plans: result.rows.map(toCamelObj) } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.get('/api/plans/:id', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        const result = await db.query('SELECT * FROM plans WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Plan non trouvé.' });
        const ppResult = await db.query('SELECT * FROM plan_points WHERE plan_id = $1 ORDER BY point_number', [req.params.id]);
        const plan = { ...toCamelObj(result.rows[0]), points: ppResult.rows.map(toCamelObj) };
        res.json({ success: true, data: { plan } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.post('/api/plans', authMiddleware, async (req: any, res) => {
    try {
        const { siteName, address, imageDataUrl } = req.body;
        const db = getPool();
        const id = uuidv4();
        await db.query('INSERT INTO plans (id, user_id, site_name, address, image_data_url) VALUES ($1,$2,$3,$4,$5)', [id, req.user.id, siteName, address, imageDataUrl]);
        const result = await db.query('SELECT * FROM plans WHERE id = $1', [id]);
        res.status(201).json({ success: true, data: { plan: { ...toCamelObj(result.rows[0]), points: [] } } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.delete('/api/plans/:id', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        await db.query('DELETE FROM plans WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Plan supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.post('/api/plans/:planId/points', authMiddleware, async (req: any, res) => {
    try {
        const { positionX, positionY, title, description, category, photoDataUrl, dateLabel, room, status } = req.body;
        const db = getPool();
        const countResult = await db.query('SELECT COUNT(*) as cnt FROM plan_points WHERE plan_id = $1', [req.params.planId]);
        const pointNumber = parseInt(countResult.rows[0].cnt) + 1;
        const id = uuidv4();
        await db.query(
            'INSERT INTO plan_points (id, plan_id, user_id, position_x, position_y, title, description, category, photo_data_url, date_label, room, status, point_number) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
            [id, req.params.planId, req.user.id, positionX, positionY, title, description, category || 'autre', photoDataUrl, dateLabel, room, status || 'a_faire', pointNumber]
        );
        const result = await db.query('SELECT * FROM plan_points WHERE id = $1', [id]);
        res.status(201).json({ success: true, data: { point: toCamelObj(result.rows[0]) } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.put('/api/plans/:planId/points/:pointId', authMiddleware, async (req: any, res) => {
    try {
        const { title, description, category, photoDataUrl, dateLabel, room, status } = req.body;
        const db = getPool();
        await db.query(
            'UPDATE plan_points SET title=$1, description=$2, category=$3, photo_data_url=$4, date_label=$5, room=$6, status=$7, updated_at=NOW() WHERE id=$8 AND user_id=$9',
            [title, description, category, photoDataUrl, dateLabel, room, status, req.params.pointId, req.user.id]
        );
        const result = await db.query('SELECT * FROM plan_points WHERE id = $1', [req.params.pointId]);
        res.json({ success: true, data: { point: toCamelObj(result.rows[0]) } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

app.delete('/api/plans/:planId/points/:pointId', authMiddleware, async (req: any, res) => {
    try {
        const db = getPool();
        await db.query('DELETE FROM plan_points WHERE id = $1 AND user_id = $2', [req.params.pointId, req.user.id]);
        res.json({ success: true, message: 'Point supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur.' });
    }
});

//  ─── Shares routes (stub) ──────────────────────────────────────────────────────

app.get('/api/shares/received', authMiddleware, (_req, res) => res.json({ success: true, data: { shares: [] } }));
app.get('/api/shares/sent', authMiddleware, (_req, res) => res.json({ success: true, data: { shares: [] } }));
app.post('/api/shares', authMiddleware, (_req, res) => res.json({ success: true, data: {} }));
app.delete('/api/shares/:id', authMiddleware, (_req, res) => res.json({ success: true }));
app.put('/api/shares/:id/accept', authMiddleware, (_req, res) => res.json({ success: true }));

//  ─── Export routes (stub) ──────────────────────────────────────────────────────

app.get('/api/export/csv', authMiddleware, (_req, res) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=rapports.csv');
    res.send('id,date,adresse\n');
});
app.get('/api/export/excel', authMiddleware, (_req, res) => res.json({ success: true, data: [] }));

//  ─── Error handler ─────────────────────────────────────────────────────────────

app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur interne.' });
});

export default app;
