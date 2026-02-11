import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { get, run } from '../database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { 
  validateRegister, 
  validateLogin, 
  validateUpdateProfile, 
  validateChangePassword 
} from '../middleware/validation.js';
import { logRouteError } from '../services/logger.js';

const router = express.Router();

// Register - with rate limiting and validation
router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;
    
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
    await run(
      `INSERT INTO users (id, email, password, first_name, last_name, company_name, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?, true)`,
      [userId, email.toLowerCase(), hashedPassword, firstName || null, lastName || null, companyName || null]
    );

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez vous connecter.',
      data: {
        userId,
        emailSent: false,
        preview: false
      }
    });
    
  } catch (error) {
    logRouteError(req, 'Register error', error, { statusCode: 500 });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte.'
    });
  }
});

// Email verification disabled by product choice.
// Keep endpoints for backward compatibility with old links/app versions.
router.get('/verify-email', (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'La vérification email est désactivée. Connectez-vous directement.'
  });
});

router.post('/resend-verification', (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'La vérification email est désactivée. Aucun envoi nécessaire.'
  });
});

// Login - with rate limiting and validation
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Récupérer l'utilisateur
    const user = await get(
      'SELECT id, email, password, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    
    // Timing attack protection: always run bcrypt.compare even if user not found
    // Use a dummy hash with same cost factor to ensure constant-time comparison
    const dummyHash = '$2a$10$invalidhash.invalidhash.invalidhash.inva';
    const passwordToCheck = user ? user.password : dummyHash;
    const isValidPassword = await bcrypt.compare(password, passwordToCheck);
    
    if (!user || !isValidPassword) {
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
    
  } catch (error) {
    logRouteError(req, 'Login error', error, { statusCode: 500 });
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil.'
    });
  }
});

// Update profile
router.put('/profile', authMiddleware, validateUpdateProfile, async (req, res) => {
  try {
    const { firstName, lastName, companyName } = req.body;
    const userId = req.user.id;
    
    await run(
      `UPDATE users SET first_name = ?, last_name = ?, company_name = ?, updated_at = NOW() WHERE id = ?`,
      [firstName || null, lastName || null, companyName || null, userId]
    );
    
    const updatedUser = await get(
      'SELECT id, email, first_name, last_name, company_name, role, email_verified, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    res.json({
      success: true,
      message: 'Profil mis à jour.',
      data: { user: updatedUser }
    });
    
  } catch (error) {
    logRouteError(req, 'Update profile error', error, { statusCode: 500 });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil.'
    });
  }
});

// Change password
router.put('/password', authMiddleware, validateChangePassword, async (req, res) => {
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
    
  } catch (error) {
    logRouteError(req, 'Change password error', error, { statusCode: 500 });
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe.'
    });
  }
});

export default router;
