import nodemailer from 'nodemailer';
import { get, run } from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger, serializeError } from './logger.js';

// Configuration SMTP (à mettre dans .env en production)
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
};

// Créer le transporteur
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Vérifier la connexion SMTP
export const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    logger.info('SMTP configuration verified');
    return true;
  } catch (err) {
    logger.warn('SMTP configuration unavailable, running in preview mode', {
      reason: err?.message,
    });
    return false;
  }
};

// Générer un token de vérification
export const generateEmailVerification = async (userId, email) => {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24h

  await run(
    `INSERT INTO email_verifications (id, user_id, email, token, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), userId, email.toLowerCase(), token, expiresAt.toISOString()]
  );

  return token;
};

// Vérifier un token
export const verifyEmailToken = async (token) => {
  const verification = await get(
    `SELECT * FROM email_verifications 
     WHERE token = ? AND used = false AND expires_at > NOW()`,
    [token]
  );

  if (!verification) {
    return { valid: false, message: 'Token invalide ou expiré' };
  }

  // Marquer comme utilisé
  await run(
    'UPDATE email_verifications SET used = true, verified_at = NOW() WHERE id = ?',
    [verification.id]
  );

  // Activer l'utilisateur
  await run(
    'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = ?',
    [verification.userId]
  );

  return { valid: true, userId: verification.userId };
};

// Envoyer l'email de vérification
export const sendVerificationEmail = async (email, token, firstName = '') => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ffb703, #f97316); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #ffb703; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
        .url-box { background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏗️ SiteFlow Pro</h1>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName || ''},</h2>
          <p>Merci de votre inscription sur SiteFlow Pro !</p>
          <p>Pour activer votre compte et commencer à créer des rapports de chantier, veuillez confirmer votre adresse email :</p>
          
          <center>
            <a href="${verificationUrl}" class="button">✅ Vérifier mon email</a>
          </center>
          
          <p>Ou copiez-collez ce lien dans votre navigateur :</p>
          <div class="url-box">${verificationUrl}</div>
          
          <p style="color: #6c757d; font-size: 14px;">Ce lien est valable 24 heures.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 14px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
        </div>
        <div class="footer">
          <p>SiteFlow Pro - Gestion de rapports de chantier</p>
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"SiteFlow Pro" <${process.env.SMTP_FROM || 'noreply@siteflow.pro'}>`,
    to: email,
    subject: '✅ Vérifiez votre email - SiteFlow Pro',
    html: htmlContent,
    text: `Bonjour,\n\nMerci de votre inscription sur SiteFlow Pro.\n\nPour activer votre compte, cliquez sur ce lien : ${verificationUrl}\n\nCe lien est valable 24 heures.\n\nSi vous n'avez pas créé de compte, ignorez cet email.`
  };

  try {
    // Si pas de config SMTP, on logue dans la console (mode dev)
    if (!process.env.SMTP_USER) {
      logger.info('Verification email preview generated (dev mode)', {
        to: email,
        subject: mailOptions.subject,
        verificationUrl,
      });
      return { success: true, preview: true };
    }

    const info = await transporter.sendMail(mailOptions);
    logger.info('Verification email sent', {
      to: email,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send verification email', {
      to: email,
      error: serializeError(error),
    });
    return { success: false, error: error.message };
  }
};

// Envoyer email de bienvenue (après vérification)
export const sendWelcomeEmail = async (email, firstName = '') => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ffb703, #f97316); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 Bienvenue sur SiteFlow Pro !</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2>Bonjour ${firstName || ''},</h2>
        <p>Votre compte est maintenant activé !</p>
        <p>Commencez à créer vos rapports de chantier professionnels en quelques clics :</p>
        <ul>
          <li>📸 Capturez des photos sur le terrain</li>
          <li>📍 Géolocalisation automatique</li>
          <li>💰 Déclarez les travaux supplémentaires</li>
          <li>📄 Générez des PDF certifiés</li>
        </ul>
        <center>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" 
             style="display: inline-block; background: #ffb703; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
            🚀 Accéder à l'application
          </a>
        </center>
      </div>
    </div>
  `;

  try {
    if (!process.env.SMTP_USER) {
      logger.info('Welcome email preview generated (dev mode)', { to: email });
      return { success: true, preview: true };
    }

    await transporter.sendMail({
      from: `"SiteFlow Pro" <${process.env.SMTP_FROM || 'noreply@siteflow.pro'}>`,
      to: email,
      subject: '🎉 Bienvenue sur SiteFlow Pro !',
      html: htmlContent
    });
    return { success: true };
  } catch (error) {
    logger.error('Failed to send welcome email', {
      to: email,
      error: serializeError(error),
    });
    return { success: false };
  }
};
