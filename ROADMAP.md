# 🗺️ ROADMAP COMPLÈTE - SiteFlow Pro

## 📅 PLAN D'ACTION STRATÉGIQUE

---

# PHASE 1 : FONDATIONS (Semaines 1-2)
**Objectif : Stabilité et qualité de code**

## 1.1 Testing (CRITIQUE - Actuellement 0%)

### Backend (Node.js)
```bash
# Stack recommandée : Vitest + Supertest
npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest
```

**Fichiers à tester (priorité) :**
| Fichier | Type de tests | Temps estimé |
|---------|--------------|--------------|
| `middleware/auth.js` | Unit (JWT) | 2h |
| `middleware/validation.js` | Unit (Zod schemas) | 2h |
| `routes/auth.js` | Integration (login/register) | 4h |
| `routes/reports.js` | Integration (CRUD) | 4h |
| `database.js` | Unit (queries) | 2h |

**Exemple de test à implémenter :**
```javascript
// server/tests/auth.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('Auth Routes', () => {
  it('should reject login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
  
  it('should prevent timing attacks (constant time)', async () => {
    // Mesurer le temps pour user existant vs inexistant
    // Les deux doivent prendre ~le même temps
  });
});
```

### Frontend (React + Testing Library)
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Composants à tester :**
| Composant | Type | Temps estimé |
|-----------|------|--------------|
| `ui/Stack.tsx` | Unit | 30min |
| `ui/PageHeader.tsx` | Unit | 30min |
| `Login.tsx` | Integration | 2h |
| `hooks/` | Unit | 3h |
| `services/api.ts` | Unit (mock) | 2h |

---

## 1.2 Architecture Backend

### 1.2.1 Refactor en Clean Architecture
```
server/
├── src/
│   ├── domain/           # Entités métier pures
│   │   ├── entities/
│   │   │   ├── User.js
│   │   │   ├── Report.js
│   │   │   └── Plan.js
│   │   └── repositories/  # Interfaces
│   │
│   ├── application/      # Use cases
│   │   ├── auth/
│   │   │   ├── LoginUseCase.js
│   │   │   └── RegisterUseCase.js
│   │   ├── reports/
│   │   └── plans/
│   │
│   ├── infrastructure/   # Implémentations
│   │   ├── database/
│   │   │   ├── postgres/
│   │   │   └── repositories/
│   │   ├── email/
│   │   └── ai/
│   │
│   └── interfaces/       # Controllers/Routes
│       ├── http/
│       │   ├── routes/
│       │   └── middleware/
│       └── cli/
│
├── tests/
└── config/
```

**Temps estimé :** 3-4 jours de refactoring

### 1.2.2 Transactions Database (CRITIQUE)
**Problème actuel :** Opérations multi-tables sans atomicité

**Solution :**
```javascript
// infrastructure/database/transaction.js
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Usage
await withTransaction(async (client) => {
  await client.query('INSERT INTO sites...', [...]);
  await client.query('INSERT INTO plans...', [...]);
});
```

**Routes à modifier :**
- [ ] `POST /api/sites` (crée site + plan par défaut)
- [ ] `POST /api/reports` (crée report + extra_works)
- [ ] `DELETE /api/sites/:id` (supprime en cascade)

---

## 1.3 Documentation API (OpenAPI/Swagger)

```bash
npm install swagger-jsdoc swagger-ui-express
```

**Bénéfices :**
- Documentation auto-générée
- Validation des requêtes
- Tests automatisés via contrats

**Temps :** 1 journée

---

# PHASE 2 : PERFORMANCE (Semaines 3-4)

## 2.1 Backend Optimizations

### 2.1.1 Caching Layer (Redis)
```bash
npm install ioredis
```

**Stratégie de cache :**
```javascript
// Cache multi-niveaux
const cacheKeys = {
  USER_PROFILE: (id) => `user:${id}`,           // TTL: 1h
  PLAN_DETAILS: (id) => `plan:${id}`,           // TTL: 30min
  REPORTS_LIST: (userId, page) => `reports:${userId}:${page}`, // TTL: 5min
  STATS: (userId) => `stats:${userId}`,         // TTL: 10min
};
```

**Implémentation :**
```javascript
// middleware/cache.js
export const cacheMiddleware = (ttl = 300) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    redis.setex(key, ttl, JSON.stringify(body));
    res.sendResponse(body);
  };
  
  next();
};
```

**Endpoints à cacher :**
- [ ] `GET /api/reports` (5 min)
- [ ] `GET /api/reports/stats` (10 min)
- [ ] `GET /api/plans` (1 min)
- [ ] `GET /api/sites` (1 min)

**Temps :** 1 journée

### 2.1.2 Query Optimization
**Indexes manquants à ajouter :**
```sql
-- Composite indexes pour les requêtes fréquentes
CREATE INDEX idx_reports_user_date ON reports(user_id, created_at DESC);
CREATE INDEX idx_reports_user_category ON reports(user_id, category);
CREATE INDEX idx_extra_works_report_cost ON extra_works(report_id, estimated_cost);

-- Partial indexes pour les filtres courants
CREATE INDEX idx_points_todo ON plan_points(plan_id) WHERE status = 'a_faire';
```

**Temps :** 2h

### 2.1.3 Background Jobs (Bull Queue)
```bash
npm install bull redis
```

**Jobs à implémenter :**
| Job | Description | Priorité |
|-----|-------------|----------|
| `email:send` | Envoi d'emails | Normal |
| `report:generate-pdf` | Génération PDF lourde | High |
| `sync:offline` | Synchro données offline | Low |
| `cleanup:expired` | Nettoyage tokens | Low |

**Exemple :**
```javascript
// jobs/pdfGeneration.js
const pdfQueue = new Bull('pdf-generation', process.env.REDIS_URL);

pdfQueue.process(async (job) => {
  const { reportId, userId } = job.data;
  const pdf = await generatePDF(reportId);
  await uploadToStorage(pdf);
  await notifyUser(userId, 'PDF prêt');
});

// Usage
await pdfQueue.add({ reportId, userId }, { 
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});
```

**Temps :** 2 jours

---

## 2.2 Frontend Optimizations

### 2.2.1 Code Splitting Avancé
```typescript
// Actuel : Tout dans un seul chunk
// Cible :

// Lazy load des vues lourdes
const PlanView = lazy(() => import('./views/PlanView'));
const ReportView = lazy(() => import('./views/ReportView'));

// Lazy load des services PDF (très lourds)
const pdfService = {
  generate: async () => {
    const module = await import('./services/pdf-premium');
    return module.generatePremiumPDF();
  }
};
```

**Objectif :** Bundle initial < 200KB

**Temps :** 1 journée

### 2.2.2 Virtualization (Listes longues)
```bash
npm install react-window react-window-infinite-loader
```

**Usage pour HistoryView :**
```tsx
import { FixedSizeList as List } from 'react-window';

// Pour 1000+ rapports, ne rendre que ceux visibles
<List
  height={600}
  itemCount={reports.length}
  itemSize={80}
  itemData={reports}
>
  {({ index, style }) => <ReportCard report={reports[index]} style={style} />}
</List>
```

**Temps :** 3h

### 2.2.3 Service Worker Optimizations
**Actuel :** Basic PWA
**Cible :**
- Cache strategies (Stale-while-revalidate)
- Background sync pour offline
- Push notifications

```javascript
// sw.js - Stratégie avancée
workbox.routing.registerRoute(
  '/api/reports',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'reports-cache',
    plugins: [
      new workbox.expiration.Plugin({ maxEntries: 50 }),
    ],
  })
);
```

**Temps :** 1 journée

---

# PHASE 3 : SÉCURITÉ RENFORCÉE (Semaine 5)

## 3.1 Audit Complet

### 3.1.1 Outils à intégrer
```bash
# Dependency scanning
npm audit
npm install snyk -g && snyk test

# Static analysis
npm install eslint-plugin-security --save-dev

# Secrets scanning (pre-commit)
npm install --save-dev husky lint-staged
npx husky add .husky/pre-commit "npx detect-secrets scan"
```

### 3.1.2 Content Security Policy (CSP) Strict
```javascript
// server.js - Helmet CSP
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Nécessaire pour certaines libs
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co"],
    connectSrc: ["'self'", process.env.SUPABASE_DB_URL],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
}));
```

### 3.1.3 Row Level Security (Supabase)
Activer RLS sur toutes les tables (même si on utilise l'API Node) :
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- etc.
```

## 3.2 Encryption at Rest
**Données sensibles à chiffrer :**
- Signatures (clientSignature)
- Coordonnées GPS précises
- Notes confidentielles

```javascript
// utils/crypto.js
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes

export const encrypt = (text) => {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};
```

## 3.3 2FA (Two-Factor Authentication)
```bash
npm install speakeasy qrcode
```

**Flow :**
1. User active 2FA dans settings
2. Génération QR code (TOTP)
3. Vérification OTP à chaque login

**Temps :** 2 jours

---

# PHASE 4 : FEATURES AVANCÉES (Semaines 6-8)

## 4.1 Real-time Collaboration
```bash
npm install socket.io
```

**Features :**
- Curseurs temps réel sur les plans
- Commentaires live sur les points
- Notifications instantanées

**Architecture :**
```javascript
// socket/planCollaboration.js
io.on('connection', (socket) => {
  socket.on('join-plan', (planId) => {
    socket.join(`plan:${planId}`);
  });
  
  socket.on('point:move', (data) => {
    socket.to(`plan:${data.planId}`).emit('point:moved', data);
  });
  
  socket.on('point:create', async (data) => {
    const point = await createPoint(data);
    io.to(`plan:${data.planId}`).emit('point:created', point);
  });
});
```

**Temps :** 3-4 jours

## 4.2 Advanced AI Features

### 4.2.1 Image Comparison (Déjà partiel)
**Amélioration :** Détection automatique des différences
```javascript
// services/ai/comparison.js
export const compareImages = async (beforeUrl, afterUrl) => {
  const result = await geminiVision({
    model: 'gemini-2.0-flash',
    prompt: `Compare these construction images. Identify:
    1. Visual differences (added/removed elements)
    2. Progress estimation (%)
    3. Quality issues detected
    4. Safety concerns`,
    images: [beforeUrl, afterUrl],
  });
  return result;
};
```

### 4.2.2 Auto-tagging
Classification automatique des rapports par IA.

## 4.3 Export Avancés

### 4.3.1 Excel avec Formules
```bash
npm install exceljs
```

**Features :**
- Export multi-onglets
- Formules de calcul (totaux automatiques)
- Graphiques intégrés
- Styles conditionnels

### 4.3.2 PDF Haute Qualité
**Améliorations :**
- Templates personnalisables
- Watermarks
- Signatures digitales
- PDF/A pour archivage légal

## 4.4 Mobile App (React Native / Capacitor)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init SiteFlow com.siteflow.app
```

**Features mobiles :**
- Photo native (meilleure qualité)
- GPS précis
- Notifications push
- Mode offline complet

**Temps :** 1-2 semaines

---

# PHASE 5 : DEVOPS & MONITORING (Semaine 9)

## 5.1 CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Backend Tests
        run: |
          cd server
          npm ci
          npm test -- --coverage
          
      - name: Frontend Tests
        run: |
          npm ci
          npm test -- --coverage
          
      - name: E2E Tests
        run: npx playwright test
        
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: |
          # Railway/Render deployment
          # Vercel deployment
```

## 5.2 Monitoring & Alerting
```bash
# Application monitoring
npm install @sentry/node @sentry/react

# Performance monitoring
npm install prometheus-api-metrics
```

**Dashboards à créer :**
- Error rate (Sentry)
- Response times (Datadog/Grafana)
- Database performance (pg_stat_statements)
- User analytics (PostHog/Amplitude)

## 5.3 Backup Strategy
```bash
# Automated backups
0 2 * * * pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
0 3 * * 0 aws s3 sync backups/ s3://siteflow-backups/
```

---

# PHASE 6 : ACCESSIBILITÉ & UX (Semaine 10)

## 6.1 WCAG 2.1 AA Compliance
**Checklist :**
- [ ] Contraste 4.5:1 minimum
- [ ] Navigation clavier complète
- [ ] Screen reader compatible (ARIA)
- [ ] Réduction de mouvement (prefers-reduced-motion)
- [ ] Mode sombre/clair

## 6.2 Internationalisation (i18n)
```bash
npm install react-i18next i18next i18next-http-backend
```

**Langues cibles :**
- Français (✅)
- Anglais
- Espagnol
- Allemand

## 6.3 Design System
**Création d'une Storybook :**
```bash
npx storybook@latest init
```

**Composants à documenter :**
- Button variants
- Form inputs
- Cards
- Modals
- Data tables

---

# 📊 ESTIMATIONS RÉCAPITULATIVES

| Phase | Durée | Priorité |
|-------|-------|----------|
| 1. Fondations (Tests) | 2 semaines | 🔴 CRITIQUE |
| 2. Performance | 2 semaines | 🟠 HIGH |
| 3. Sécurité | 1 semaine | 🔴 CRITIQUE |
| 4. Features | 3 semaines | 🟡 MEDIUM |
| 5. DevOps | 1 semaine | 🟠 HIGH |
| 6. Accessibilité | 1 semaine | 🟡 MEDIUM |

**Total :** ~10 semaines (2.5 mois) pour une V2 enterprise-ready

---

# 🎯 PROCHAINES ACTIONS IMMÉDIATES (Cette semaine)

1. **Mettre en place les tests** (priorité #1)
   ```bash
   cd server && npm install --save-dev vitest supertest
   cd .. && npm install --save-dev @testing-library/react
   ```

2. **Configurer Redis** (caching + queues)
   ```bash
   # Railway/Upstash pour Redis
   # Mettre à jour docker-compose.yml
   ```

3. **Implémenter les transactions DB**
   - Commencer par `routes/sites.js`

4. **Setup monitoring basique**
   ```bash
   npm install @sentry/node @sentry/react
   ```

---

*Dernière mise à jour : $(date)*
*Prochaine review : Dans 2 semaines*
