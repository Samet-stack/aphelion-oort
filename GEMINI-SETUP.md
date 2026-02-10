# 🤖 Configuration Google Gemini AI

Ce document explique comment configurer et utiliser l'analyse d'images par **Google Gemini** dans SiteFlow Pro.

## 🎯 Pourquoi Gemini ?

| Critère | Gemini | OpenAI |
|---------|--------|--------|
| **Prix** | ✅ Gratuit (quotas généreux) | 💰 Payant (~€0.002/img) |
| **Vitesse** | ⚡ Très rapide | ⚡ Rapide |
| **Qualité** | 🎯 Excellente | 🎯 Excellente |
| **Multilingue** | 🌍 Français natif | 🌍 Bon |

**Recommandation** : Gemini est la meilleure option pour démarrer (gratuit et performant).

## 🔧 Configuration Rapide

### 1. Vérifier que la clé est déjà configurée

Ta clé est déjà dans le fichier `.env` :
```bash
VITE_GEMINI_API_KEY=AIzaSyABy9HmDhf5M4NTkV2V_j6xAocgT8jB2MY
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

Et c'est tout ! 🎉

## 🔑 Configuration Manuelle (si besoin)

Si tu veux utiliser ta propre clé :

1. **Créer une clé API**
   - Va sur [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Connecte-toi avec ton compte Google
   - Clique sur **"Create API Key"**
   - Copie la clé (commence par `AIza...`)

2. **Configurer le projet**
   ```bash
   # Éditer le fichier .env
   VITE_GEMINI_API_KEY=ta-nouvelle-clé-ici
   ```

3. **Redémarrer**
   ```bash
   npm run dev
   ```

## 💰 Quotas Gratuits

Google Gemini offre un généreux quota gratuit :

| Modèle | Requêtes gratuites/jour | Limite/minute |
|--------|------------------------|---------------|
| gemini-2.0-flash | 1,500 | 15 |

**En pratique** :
- ~1,500 analyses de photos par jour
- Suffisant pour une petite entreprise
- Reset quotidien à minuit (PT)

## 🚀 Utilisation

### Automatique
L'analyse se fait automatiquement quand tu prends une photo :
1. 📸 Capture une image
2. 🤖 L'IA analyse en arrière-plan
3. ✨ Les champs se pré-remplissent automatiquement

### Dans l'interface
Tu verras :
- **"Analyse IA en cours..."** pendant l'analyse
- **"Analysé par IA (92%)"** quand c'est terminé
- **Carte d'analyse** avec tags, catégorie, problèmes détectés

## 🧪 Test Rapide

```bash
# Vérifier la configuration
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=AIzaSyABy9HmDhf5M4NTkV2V_j6xAocgT8jB2MY"
```

## 🐛 Dépannage

### "Analyse IA non configurée"
→ Vérifie que `VITE_GEMINI_API_KEY` est dans `.env` et que le serveur est redémarré

### "Analyse IA indisponible"
→ Vérifie ta connexion internet et la validité de la clé

### Erreur 429 (Too Many Requests)
→ Tu as atteint la limite quotidienne gratuite. Attends demain ou passe à un compte payant.

### Réponses étranges
→ Le modèle est en version beta. En cas de souci, redemande une analyse ou remplis manuellement.

## 📊 Logs

Ouvre la console du navigateur (F12) pour voir :
```
[Gemini] Starting image analysis...
[Gemini] Analysis completed successfully
[Gemini] Using cached result
[Gemini] Analysis failed: ...
```

## 🔄 Alternatives

Si Gemini ne te convient pas :

### OpenAI (Payant)
```bash
# Dans .env
VITE_OPENAI_API_KEY=sk-votre-clé-openai
# Commenter VITE_GEMINI_API_KEY
```

### Mode sans IA
L'application fonctionne parfaitement sans clé API. Les champs restent éditables manuellement.

## 🔒 Sécurité

- ⚠️ **Ne commite jamais** `.env` (déjà dans `.gitignore`)
- 🔑 La clé est côté client (acceptable pour démo/dev)
- 🛡️ En production, utilise un proxy backend

## 📚 Documentation

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Pricing](https://ai.google.dev/pricing)

---

**Prêt à tester ?** Prends une photo de chantier et regarde l'IA faire sa magie ! ✨
