# 🏗️ Workflow Conducteur de Travaux

Ce document explique le workflow métier complet pour un conducteur de travaux utilisant SiteFlow Pro.

## 🎯 Workflow Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONDUCTEUR DE TRAVAUX                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. CRÉER UN CHANTIER (Plan)                                     │
│    ├─ Nom du chantier                                           │
│    ├─ Adresse                                                   │
│    └─ Upload du plan (image)                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AJOUTER DES POINTS SUR LE PLAN                               │
│    ├─ Cliquer sur le plan pour positionner                      │
│    ├─ Prendre une photo du problème                             │
│    ├─ Décrire le problème                                       │
│    ├─ Catégoriser (défaut, électricité, plomberie...)           │
│    └─ Définir le statut (à faire/en cours/terminé)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CRÉER UN RAPPORT DEPUIS UN POINT                             │
│    ├─ Ouvrir un point existant                                  │
│    ├─ Cliquer sur "Créer rapport"                               │
│    ├─ L'IA analyse automatiquement la photo                     │
│    ├─ Les champs sont pré-remplis (description, catégorie...)   │
│    ├─ Ajouter des travaux supplémentaires si besoin             │
│    ├─ Signature client                                          │
│    └─ Générer le PDF                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. SUIVI ET HISTORIQUE                                          │
│    ├─ Voir tous les rapports liés au plan                       │
│    ├─ Filtrer par statut (à faire/en cours/terminé)             │
│    └─ Exporter en PDF global                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 📱 En pratique

### Scénario 1 : Rapport depuis un point existant

1. **Aller dans "Gérer les plans"**
2. **Ouvrir un plan**
3. **Cliquer sur un point** (marqueur rouge/jaune/vert)
4. **Cliquer sur "Créer rapport"** (bouton vert)
5. Le système :
   - Récupère la photo du point
   - Lance l'analyse IA (Gemini)
   - Pré-remplit la description
   - Définit la priorité selon le statut du point
6. **Compléter si besoin** (travaux supp, signature...)
7. **Générer le PDF**

### Scénario 2 : Rapport rapide (sans point)

1. **Cliquer "Choisir un chantier"**
2. **Sélectionner le plan**
3. **Prendre une photo**
4. L'IA analyse
5. **Générer le PDF**

### Scénario 3 : Plan d'action

1. **Ouvrir un plan**
2. **Onglet "Plan d'action"**
3. **Voir les colonnes** : À faire / En cours / Terminé
4. **Déplacer les points** entre les colonnes
5. **Filtrer par catégorie**

## 🔗 Liaisons dans la base de données

```sql
-- Un rapport peut être lié à un point
reports
├── plan_id → plans.id          -- Lien vers le plan
├── plan_point_id → plan_points.id  -- Lien vers le point (optionnel)
└── ... autres champs

plan_points
├── plan_id → plans.id
├── status (a_faire/en_cours/termine)
├── photo_data_url
└── ... autres champs
```

## 🎨 UI/UX

### Badge "Point #{num}" 
Affiché dans le rapport quand il vient d'un point existant.

### Pré-remplissage automatique
| Champ | Source |
|-------|--------|
| Description | `point.description` |
| Catégorie | Mappée depuis `point.category` |
| Priorité | `point.status` → high/medium/low |
| Photo | `point.photoDataUrl` → File |

### Mapping des catégories
```javascript
défaut → anomaly
validation → progress
électricité/plomberie/maconnerie/menuiserie → other
```

## 🔄 Flux de données

```
1. User clique "Créer rapport" sur un point
   ↓
2. App.tsx reçoit (plan, point)
   ↓
3. Conversion photo_data_url → File
   ↓
4. Navigation vers ReportView
   ↓
5. ReportView pré-remplit avec données du point
   ↓
6. IA analyse (optionnel si déjà analysé)
   ↓
7. User complète le rapport
   ↓
8. Sauvegarde avec planId + planPointId
   ↓
9. Génération PDF
```

## 📝 API Endpoints utilisés

### GET /api/plans
Liste des plans du user

### GET /api/plans/:id
Plan avec tous ses points

### POST /api/plans/:id/points
Créer un nouveau point

### POST /api/ai/analyze
Analyser une image (IA Gemini) - sécurisé côté backend

### POST /api/reports
Créer un rapport (avec `planId` et `planPointId` optionnels)

## 🎁 Fonctionnalités clés

✅ **Création rapide** : Rapport depuis un point en 2 clics  
✅ **Pré-remplissage** : Données du point automatiquement remplies  
✅ **IA intégrée** : Analyse automatique de la photo  
✅ **Lien bidirectionnel** : Point ↔ Rapport liés  
✅ **PDF unifié** : Plan + Points + Rapports dans un seul document  
✅ **Workflow fluide** : Du plan à la signature client  

## 🚀 Prochaines améliorations

- [ ] PDF global : Plan avec tous les points et leurs rapports
- [ ] Vue calendrier des points à traiter
- [ ] Notifications pour points "à faire" depuis > 7 jours
- [ ] Comparaison avant/après automatique
- [ ] Dashboard KPI pour le conducteur

---

**Workflow prêt à l'emploi !** 🎉
