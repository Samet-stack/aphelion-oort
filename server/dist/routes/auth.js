import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { get, run } from '../database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { generateEmailVerification, verifyEmailToken, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
const router = express.Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth requests per windowMs
    message: {
        success: false,
        message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.'
    }
});
const registerSchema = z.object({
    email: z.string().email("Format d'email invalide."),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional()
});
const loginSchema = z.object({
    email: z.string().email("Format d'email invalide."),
    password: z.string().min(1, "Mot de passe requis.")
});
// Register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error.errors[0].message
            });
        }
        const { email, password, firstName, lastName, companyName } = parsed.data;
        // Vérifier si l'email existe déjà
        const existingUser = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Un compte existe déjà avec cet email.'
            });
        }
        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        // Créer l'utilisateur (activé immédiatement)
        const userId = uuidv4();
        await run(`INSERT INTO users (id, email, password, first_name, last_name, company_name, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?, true)`, [userId, email.toLowerCase(), hashedPassword, firstName || null, lastName || null, companyName || null]);
        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès. Vous pouvez vous connecter.',
            data: {
                userId,
                emailSent: false,
                preview: false
            }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du compte.'
        });
    }
});
// Vérifier l'email (click sur le lien)
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token manquant.'
            });
        }
        const result = await verifyEmailToken(token);
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
        // Récupérer l'utilisateur pour l'email de bienvenue
        const user = await get('SELECT email, first_name FROM users WHERE id = ?', [result.userId]);
        if (user) {
            await sendWelcomeEmail(user.email, user.firstName);
        }
        res.json({
            success: true,
            message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.',
            data: { userId: result.userId }
        });
    }
    catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification de l\'email.'
        });
    }
});
// Renvoyer l'email de vérification
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis.'
            });
        }
        const user = await get('SELECT id, first_name, email_verified FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Aucun compte trouvé avec cet email.'
            });
        }
        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Cet email est déjà vérifié.'
            });
        }
        // Générer nouveau token
        const verificationToken = await generateEmailVerification(user.id, email);
        const emailResult = await sendVerificationEmail(email, verificationToken, user.firstName);
        res.json({
            success: true,
            message: 'Email de vérification renvoyé.',
            data: {
                emailSent: emailResult.success,
                preview: emailResult.preview || false
            }
        });
    }
    catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de l\'email.'
        });
    }
});
// Login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error.errors[0].message
            });
        }
        const { email, password } = parsed.data;
        // Récupérer l'utilisateur
        const user = await get('SELECT id, email, password, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE email = ?', [email.toLowerCase()]);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect.'
            });
        }
        // Vérifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Email ou mot de passe incorrect.'
            });
        }
        // Mettre à jour lastLoginAt
        await run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        // Générer le token
        const token = generateToken(user.id);
        // Supprimer le password de la réponse
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            success: true,
            message: 'Connexion réussie.',
            data: {
                user: userWithoutPassword,
                token
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion.'
        });
    }
});
// Get current user (profil)
router.get('/me', authMiddleware, async (req, res) => {
    try {
        res.json({
            success: true,
            data: { user: req.user }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du profil.'
        });
    }
});
// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { firstName, lastName, companyName } = req.body;
        const userId = req.user.id;
        await run(`UPDATE users SET first_name = ?, last_name = ?, company_name = ?, updated_at = NOW() WHERE id = ?`, [firstName || null, lastName || null, companyName || null, userId]);
        const updatedUser = await get('SELECT id, email, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE id = ?', [userId]);
        res.json({
            success: true,
            message: 'Profil mis à jour.',
            data: { user: updatedUser }
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du profil.'
        });
    }
});
// Change password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mot de passe actuel et nouveau mot de passe (6 caractères min) requis.'
            });
        }
        // Vérifier l'ancien mot de passe
        const user = await get('SELECT password FROM users WHERE id = ?', [userId]);
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Mot de passe actuel incorrect.'
            });
        }
        // Hasher le nouveau
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        res.json({
            success: true,
            message: 'Mot de passe modifié avec succès.'
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de mot de passe.'
        });
    }
});
// Forgot Password
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis.'
            });
        }
        const user = await get('SELECT id, first_name FROM users WHERE email = ?', [email.toLowerCase()]);
        // Pour des raisons de sécurité, nous renvoyons un succès même si l'email n'existe pas.
        if (!user) {
            return res.json({
                success: true,
                message: 'Si cet email correspond à un compte, un lien de réinitialisation vous a été envoyé.'
            });
        }
        // Générer un token unique pour le reset
        const resetToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Expiration dans 1 heure
        // Mettre à jour l'utilisateur en base avec ce token
        await run('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', [resetToken, expiresAt.toISOString(), user.id]);
        // Envoyer l'email
        const emailResult = await sendPasswordResetEmail(email.toLowerCase(), resetToken, user.firstName);
        res.json({
            success: true,
            message: 'Si cet email correspond à un compte, un lien de réinitialisation vous a été envoyé.',
            data: {
                emailSent: emailResult.success,
                preview: emailResult.preview || false
            }
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue.'
        });
    }
});
// Reset Password
const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token manquant.'),
    newPassword: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.')
});
router.post('/reset-password', authLimiter, async (req, res) => {
    try {
        const parsed = resetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error.errors[0].message
            });
        }
        const { token, newPassword } = parsed.data;
        // Rechercher l'utilisateur avec ce token et s'assurer qu'il n'est pas expiré
        const user = await get('SELECT id FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()', [token]);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Le lien de réinitialisation est invalide ou a expiré.'
            });
        }
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Mettre à jour le mot de passe et supprimer le token
        await run('UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = ?', [hashedPassword, user.id]);
        res.json({
            success: true,
            message: 'Votre mot de passe a été réinitialisé avec succès.'
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Une erreur est survenue lors de la réinitialisation.'
        });
    }
});
export default router;
