# 🤖 Configuration de l'Analyse IA (OpenAI Vision)

Ce document explique comment configurer et utiliser l'analyse d'images par IA dans SiteFlow Pro.

## 🎯 Fonctionnalités

L'IA analyse automatiquement les photos de chantier pour :
- **Décrire** ce qui est visible (matériaux, équipements, travaux)
- **Détecter** les problèmes de sécurité, anomalies, avancement
- **Catégoriser** automatiquement (sécurité / avancement / anomalie)
- **Évaluer** la priorité (haute / moyenne / basse)
- **Tagger** les éléments identifiés (EPI, béton, électricité...)

## 🔧 Configuration

### 1. Obtenir une clé API OpenAI

1. Créez un compte sur [platform.openai.com](https://platform.openai.com)
2. Allez dans **API Keys** → **Create new secret key**
3. Copiez la clé (commence par `sk-...`)

### 2. Configurer l'environnement

```bash
# Copier le fichier example
cp .env.example .env

# Éditer .env et ajouter votre clé
VITE_OPENAI_API_KEY=sk-votre-clé-api-ici
```

### 3. Redémarrer le serveur de développement

```bash
npm run dev
```

## 💰 Coûts estimés

| Modèle | Prix par image | Usage moyen |
|--------|----------------|-------------|
| gpt-4o-mini | ~€0.002 | Recommandé (rapide, économique) |
| gpt-4o | ~€0.01 | Plus précis mais plus cher |

**Estimation mensuelle** :
- 100 rapports/mois = ~€0.20
- 1000 rapports/mois = ~€2.00
- 10000 rapports/mois = ~€20.00

## 🔒 Sécurité

- ⚠️ **Ne jamais commiter** votre clé API (elle est dans `.env` qui est gitignore)
- 🔑 Utilisez des clés avec un budget limité sur OpenAI
- 🛡️ En production, envisagez un proxy backend pour cacher la clé

## 🚀 Utilisation

### Mode automatique
L'analyse se fait automatiquement quand vous capturez une photo :
1. Prenez une photo
2. L'IA analyse pendant le chargement
3. Les champs sont pré-remplis automatiquement

### Sans configuration
Si l'API n'est pas configurée, l'app fonctionne normalement avec :
- Description générique par défaut
- Champs à remplir manuellement
- Aucune erreur visible pour l'utilisateur

## 🧪 Test

Pour tester l'intégration :

```bash
# Vérifier la configuration
curl -H "Authorization: Bearer $VITE_OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

## 🐛 Dépannage

### "Analyse IA non configurée"
→ Vérifiez que `VITE_OPENAI_API_KEY` est bien dans `.env`

### "Analyse IA indisponible"
→ Vérifiez votre connexion internet et la validité de la clé API

### Erreur de quota
→ Vérifiez votre [usage OpenAI](https://platform.openai.com/usage) et ajoutez des crédits

## 📊 Monitoring

Les logs sont visibles dans la console du navigateur :
```
[AI] Starting image analysis...
[AI] Analysis completed successfully
[AI] Using cached result
[AI] Analysis failed: ...
```

## 🔮 Fonctionnalités futures

- [ ] Comparaison avant/après automatique
- [ ] Détection de conformité réglementaire
- [ ] Estimation automatique des quantités
- [ ] Recommandations de sécurité

---

**Besoin d'aide ?** Contactez le support ou ouvrez une issue sur GitHub.
