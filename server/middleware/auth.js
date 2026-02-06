import jwt from 'jsonwebtoken';
import { get } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'siteflow-super-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

// Générer un token JWT
export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

// Vérifier le token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware de protection des routes
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès non autorisé. Token manquant.' 
      });
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide ou expiré.' 
      });
    }
    
    // Vérifier que l'utilisateur existe toujours
    const user = await get(
      'SELECT id, email, first_name, last_name, company_name, role FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé.' 
      });
    }
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'authentification.' 
    });
  }
};

// Optionnel: Middleware pour vérifier le rôle admin
export const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Accès réservé aux administrateurs.' 
    });
  }
  next();
};
