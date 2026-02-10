# 🔒 Sécurité AI - Architecture Backend

## ⚠️ Pourquoi cette architecture ?

**PROBLÈME**: Mettre une clé API (Gemini, OpenAI) dans le frontend expose la clé publiquement.
```javascript
// ❌ DANGER - Clé visible par tout le monde
const API_KEY = "AIzaSyABy9Hm..." // N'importe qui peut la récupérer !
```

**SOLUTION**: Proxy backend sécurisé
```
Frontend (pas de clé)
    ↓ POST /api/ai/analyze (authentifié)
Backend (clé sécurisée)
    ↓ Appel API Gemini avec clé
Gemini API
```

## 🏗️ Architecture

### Avant (Insécure)
```
┌─────────────┐          ┌─────────────┐
│   Frontend  │ ───────► │  Gemini API │
│  (clé API)  │  Clé     │             │
└─────────────┘ exposée  └─────────────┘
```

### Après (Sécurisé)
```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Frontend  │ ───────► │   Backend   │ ───────► │  Gemini API │
│  (pas clé)  │  Token   │  (clé API)  │  Clé     │             │
└─────────────┘  JWT     └─────────────┘  sécurisée└─────────────┘
```

## 📁 Configuration

### 1. Backend (server/.env)
```bash
# ✅ SÉCURISÉ - Côté serveur uniquement
GEMINI_API_KEY=AIzaSyABy9HmDhf5M4NTkV2V_j6xAocgT8jB2MY
```

### 2. Frontend (.env)
```bash
# ✅ SÉCURISÉ - Aucune clé API
# VITE_API_URL=http://localhost:3001/api
# Les clés API ne sont JAMAIS ici !
```

## 🔐 Points de sécurité

| Aspect | Implémentation |
|--------|---------------|
| **Authentification** | JWT obligatoire sur `/api/ai/*` |
| **Rate Limiting** | 3 req/minute par utilisateur |
| **Validation** | Images < 10MB, format base64 vérifié |
| **Clé API** | Uniquement côté serveur (process.env) |
| **Logs** | Pas de log de la clé API |
| **Erreurs** | Messages génériques côté client |

## 🚀 Endpoints API

### GET /api/ai/status
Vérifier si l'AI est configurée (public)

```json
{
  "configured": true,
  "model": "gemini-2.0-flash"
}
```

### POST /api/ai/analyze
Analyser une image (authentifié)

**Request:**
```json
{
  "imageBase64": "base64encodedimage...",
  "mimeType": "image/jpeg",
  "language": "fr"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "description": "...",
    "category": "safety",
    "priority": "high",
    "tags": ["EPI", "béton"],
    "confidence": 0.92,
    "issues": [...]
  }
}
```

### POST /api/ai/compare
Comparer deux images (authentifié)

## 🛡️ Protection contre les attaques

### 1. Rate Limiting (à implémenter)
```javascript
// Limit to 3 requests per minute per user
const rateLimit = new Map();

const checkRateLimit = (userId) => {
  const now = Date.now();
  const userLimit = rateLimit.get(userId);
  
  if (userLimit && userLimit.count >= 3 && now - userLimit.reset < 60000) {
    throw new Error('Rate limit exceeded');
  }
  // ...
};
```

### 2. Validation d'image
```javascript
// Vérifier la taille
if (imageBase64.length > 14 * 1024 * 1024) {
  return res.status(413).json({ error: 'Image too large' });
}

// Vérifier le MIME type
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedTypes.includes(mimeType)) {
  return res.status(400).json({ error: 'Invalid image type' });
}
```

### 3. Authentification JWT
```javascript
import { authenticateToken } from '../middleware/auth.js';

router.post('/analyze', authenticateToken, async (req, res) => {
  // Uniquement les utilisateurs connectés
});
```

## 🧪 Test de sécurité

Vérifier que la clé n'est pas exposée:

```bash
# 1. Build le frontend
npm run build

# 2. Chercher la clé dans le build
grep -r "AIzaSy" dist/
# Ne doit rien retourner !

# 3. Vérifier les appels réseau
# Ouvrir DevTools → Network
# L'appel à Gemini ne doit pas apparaître
# Seul /api/ai/analyze doit être visible
```

## 📝 Checklist déploiement

- [ ] Clé API uniquement dans `server/.env`
- [ ] Frontend `.env` sans clé
- [ ] JWT middleware actif sur les routes AI
- [ ] Rate limiting configuré
- [ ] Validation des images en place
- [ ] Logs sans informations sensibles
- [ ] HTTPS en production

## 🔄 Fallback sécurisé

Si l'API AI échoue, le backend renvoie une réponse gracieuse:

```json
{
  "success": false,
  "message": "AI analysis failed",
  "data": {
    "description": "Analyse manuelle requise",
    "category": "other",
    "priority": "medium"
  }
}
```

L'application fonctionne sans IA si nécessaire.

---

**Besoin d'aide ?** Vérifie que:
1. `GEMINI_API_KEY` est dans `server/.env`
2. Pas de clé dans le frontend `.env`
3. Le backend redémarre après changement de config
