# 🚀 CHECKLIST DÉPLOIEMENT PRODUCTION

## ✅ PRÊT POUR PRODUCTION

### Variables d'Environnement Requises

#### Backend (`server/.env`)
```bash
# CRITICAL - Sans ces variables, le serveur ne démarre PAS
SUPABASE_DB_URL=postgresql://...      # Connexion PostgreSQL
JWT_SECRET=votre_secret_32_chars_min  # Clé JWT (min 32 caractères)
GEMINI_API_KEY=votre_cle_gemini       # Pour l'analyse AI

# Email (optionnel mais recommandé)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=

# Sécurité CORS
FRONTEND_URL=https://votre-domaine.vercel.app
VERCEL_SLUG=votre-projet-vercel       # Pour les previews
```

#### Frontend (`.env` ou variables Vercel)
```bash
VITE_API_URL=/api                      # Ou https://api.votre-domaine.com
```

### ✅ Vérifications Effectuées

| Check | Statut |
|-------|--------|
| Build frontend | ✅ 472KB JS, 67KB CSS |
| Syntaxe backend | ✅ Aucune erreur |
| JWT_SECRET obligatoire | ✅ Crash si manquant |
| Helmet security headers | ✅ Actif |
| Rate limiting | ✅ Auth (5 req/15min), AI (20 req/heure) |
| CSV injection protection | ✅ Sanitization active |
| CORS restrictif | ✅ Slug Vercel spécifique |
| Pool PostgreSQL | ✅ 20 connexions max |
| Timing attack mitigation | ✅ bcrypt constant-time |
| Validation Zod | ✅ Toutes les routes |

### 🚨 Points de Vigilance

1. **Base de données** : Exécuter `supabase-schema.sql` AVANT le déploiement
2. **JWT_SECRET** : Doit avoir au moins 32 caractères aléatoires
3. **GEMINI_API_KEY** : Nécessaire pour l'analyse AI (sinon 503)
4. **Variables Vercel** : Définir `VERCEL_SLUG` pour les previews

### 📋 Commandes de Déploiement

```bash
# 1. Backend (Railway/Render/Heroku)
cd server
npm install
npm start  # ou "node server.js"

# 2. Frontend (Vercel)
npm run build
# Upload du dossier 'dist/' ou git push
```

### 🔍 Tests Post-Déploiement

```bash
# Health check
curl https://votre-api.com/api/health

# Test auth (doit retourner 401 sans token)
curl -X POST https://votre-api.com/api/auth/login

# Test avec token valide
curl -H "Authorization: Bearer $TOKEN" \
  https://votre-api.com/api/reports
```

## ⚠️ Limitations Connues

- Pas de tests automatisés (à ajouter)
- Pas de transactions DB sur opérations multi-tables
- Composant PlanView encore volumineux (1371 lignes)
- Pas de streaming pour exports CSV massifs

## 🎯 Statut Final

**PRÊT POUR PRODUCTION** avec vigilance sur les variables d'environnement.
