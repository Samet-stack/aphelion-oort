# ⚡ ACTIONS IMMÉDIATES - À faire cette semaine

## 🎯 Objectif : Passer de "Prêt pour prod" à "Enterprise Ready"

---

## JOUR 1 (Aujourd'hui) : Testing Setup

### Backend
```bash
cd server

# 1. Installer Vitest
npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest

# 2. Créer structure
mkdir -p tests/unit tests/integration tests/fixtures

# 3. Créer premier test (auth)
cat > tests/integration/auth.test.js << 'EOF'
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server.js';
import { closeDb } from '../../database.js';

const app = createApp();

describe('POST /api/auth/login', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid@test.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
  
  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    
    expect(res.status).toBe(400);
  });
});

afterAll(async () => {
  await closeDb();
});
EOF

# 4. Ajouter script package.json
# "test": "vitest",
# "test:coverage": "vitest --coverage"
```

### Frontend
```bash
# 1. Installer Testing Library
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom

# 2. Configurer Vitest pour React
# vitest.config.ts déjà présent, ajouter :
cat >> vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
EOF

# 3. Créer test setup
mkdir -p src/test
cat > src/test/setup.ts << 'EOF'
import '@testing-library/jest-dom';
EOF

# 4. Premier test composant
cat > src/components/ui/__tests__/Button.test.tsx << 'EOF'
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('Button', () => {
  it('renders correctly', () => {
    render(<button type="button">Click me</button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click', () => {
    const handleClick = vi.fn();
    render(<button type="button" onClick={handleClick}>Click</button>);
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalled();
  });
});
EOF
```

**Temps :** 2-3 heures
**Impact :** 🟢 Facilite tous les futurs refactors

---

## JOUR 2 : Database Transactions

### Implémentation du wrapper
```javascript
// server/infrastructure/database/transaction.js
import { getPool } from '../../database.js';

export const withTransaction = async (callback) => {
  const pool = getPool();
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
```

### Refactor route sites
```javascript
// server/routes/sites.js - Refactor create site
router.post('/', validateCreateSite, async (req, res) => {
  try {
    const result = await withTransaction(async (client) => {
      // 1. Créer le site
      const siteResult = await client.query(
        'INSERT INTO sites (id, user_id, site_name, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [uuidv4(), req.user.id, req.body.siteName, req.body.address]
      );
      
      // 2. Créer un plan par défaut (si besoin)
      // Si ça échoue, tout est annulé
      
      return siteResult.rows[0];
    });
    
    res.status(201).json({ success: true, data: { site: result } });
  } catch (error) {
    res.status(500).json({ success: false, message: '...' });
  }
});
```

**Routes à modifier (par ordre) :**
1. `POST /api/sites` 
2. `POST /api/reports` (avec extra_works)
3. `POST /api/plans/:id/points` (création point + maj stats)

**Temps :** 1 journée
**Impact :** 🔴 Évite les données corrompues

---

## JOUR 3 : Caching Redis

### Setup
```bash
# 1. Railway/Upstash Redis (gratuit jusqu'à 10k req/jour)
# Ou local pour dev
docker run -d -p 6379:6379 redis:alpine

# 2. Installer client
npm install ioredis
```

### Implementation
```javascript
// server/infrastructure/cache/redis.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const cache = {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },
  
  async set(key, value, ttlSeconds = 300) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  
  async invalidate(pattern) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};

// Cache middleware
export const cacheMiddleware = (ttl = 300) => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  
  const key = `cache:${req.user.id}:${req.originalUrl}`;
  const cached = await cache.get(key);
  
  if (cached) {
    return res.json(cached);
  }
  
  res.originalJson = res.json;
  res.json = (body) => {
    cache.set(key, body, ttl);
    return res.originalJson(body);
  };
  
  next();
};
```

### Application
```javascript
// server/routes/reports.js
import { cacheMiddleware } from '../infrastructure/cache/redis.js';

// Cache les GET /reports pendant 5 minutes
router.get('/', cacheMiddleware(300), async (req, res) => {
  // ...existing code
});

// Invalider le cache lors des modifications
router.post('/', async (req, res) => {
  // ...create report
  await cache.invalidate(`cache:${req.user.id}:/api/reports*`);
});
```

**Temps :** 1 journée
**Impact :** 🟠 Réduit charge DB de 60-80%

---

## JOUR 4 : Error Handling & Logging

### Setup Winston
```bash
npm install winston
```

```javascript
// server/infrastructure/logger.js
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'siteflow-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Global Error Handler
```javascript
// server/middleware/errorHandler.js
import { logger } from '../infrastructure/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
};
```

**Temps :** 1/2 journée
**Impact :** 🟠 Debugging 10x plus rapide

---

## JOUR 5 : Frontend Performance

### 1. Virtualization (HistoryView)
```bash
npm install react-window
```

```tsx
// components/VirtualReportList.tsx
import { FixedSizeList as List } from 'react-window';

export const VirtualReportList = ({ reports }) => (
  <List
    height={600}
    itemCount={reports.length}
    itemSize={100}
    itemData={reports}
  >
    {({ index, style }) => (
      <ReportCard report={reports[index]} style={style} />
    )}
  </List>
);
```

### 2. React Query (Data Fetching)
```bash
npm install @tanstack/react-query
```

```tsx
// hooks/useReports.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useReports = () => {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: reportsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};
```

### 3. Bundle Analysis
```bash
npm install --save-dev rollup-plugin-visualizer

# Analyser le bundle
npm run build
# Ouvrir stats.html
```

**Temps :** 1 journée
**Impact :** 🟠 UX significativement améliorée

---

## WEEKEND : Review & Documentation

### 1. Security Headers Check
```bash
# Tester avec curl
curl -I https://votre-api.com/api/health

# Vérifier présence de :
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - Strict-Transport-Security
```

### 2. Load Testing
```bash
# Installer Artillery
npm install -g artillery

# Créer test
cat > load-test.yml << 'EOF'
config:
  target: 'https://votre-api.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health check"
    requests:
      - get:
          url: "/api/health"
EOF

artillery run load-test.yml
```

### 3. Documentation
- [ ] Mettre à jour README avec env vars
- [ ] Créer CHANGELOG.md
- [ ] Documenter API (Postman/Swagger)

---

## 📋 CHECKLIST FIN DE SEMAINE

### Backend
- [ ] Tests auth passent (`npm test`)
- [ ] Transactions DB sur POST /sites
- [ ] Redis connecté et fonctionnel
- [ ] Logs Winston écrits dans fichiers
- [ ] Error handler global actif

### Frontend
- [ ] React Query installé et utilisé
- [ ] Virtualization sur listes longues
- [ ] Bundle analysé et optimisé
- [ ] Pas de régression (manuel QA)

### DevOps
- [ ] Variables d'env documentées
- [ ] Health check endpoint OK
- [ ] Load test passé (>100 req/s)

---

## 🎯 MÉTRIQUES DE SUCCÈS

| Métrique | Actuel | Cible | Comment vérifier |
|----------|--------|-------|------------------|
| Coverage tests | 0% | >60% | `npm test -- --coverage` |
| Temps réponse API | ~200ms | <100ms | Logs/Monitoring |
| Bundle JS | 472KB | <400KB | `npm run build` |
| Erreurs 500/jour | ? | <10 | Sentry/Logs |
| Uptime | ? | >99.9% | Uptime checker |

---

**Prochaine étape après cette semaine :** 
Mettre en place CI/CD avec GitHub Actions pour déploiement automatique.

*À toi de jouer ! 🚀*
