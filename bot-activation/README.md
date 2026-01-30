# 🤖 L'Horizon - Bot d'Activation v2

Bot d'activation automatique des abonnements Discord via Stripe + OAuth.

## 🔄 Flux Complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ACHAT & ACTIVATION                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Client achète sur Stripe                                        │
│           ↓                                                         │
│  2. Webhook Stripe → Bot enregistre dans Supabase                   │
│           ↓                                                         │
│  3. Stripe envoie email avec lien:                                  │
│     https://ton-app.com/activate?email=client@mail.com              │
│           ↓                                                         │
│  4. Client clique → OAuth Discord → Connexion                       │
│           ↓                                                         │
│  5. Bot lie discord_id ↔ email dans Supabase                        │
│           ↓                                                         │
│  6. Bot attribue le rôle automatiquement                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         EXPIRATION                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Cron toutes les heures:                                            │
│  - Vérifie expires_at dans Supabase                                 │
│  - Retire le rôle Discord si expiré                                 │
│  - Envoie un DM au membre                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 🚀 Installation

### 1. Prérequis

- Node.js 18+
- Compte Supabase
- Compte Stripe
- Application Discord

### 2. Clone et installe

```bash
git clone <ton-repo>
cd activation_bot_v2
npm install
```

### 3. Configure Supabase

1. Va sur [Supabase](https://supabase.com) → ton projet
2. SQL Editor → colle le contenu de `database.sql`
3. Exécute le script

### 4. Configure Discord

#### Dans le [Discord Developer Portal](https://discord.com/developers/applications):

**Onglet "Bot":**
- Reset Token → copie-le
- Active les intents:
  - ✅ SERVER MEMBERS INTENT

**Onglet "OAuth2":**
- Copie le Client Secret
- Ajoute l'URL de callback dans "Redirects":
  ```
  https://ton-app.onrender.com/auth/discord/callback
  ```

### 5. Configure Stripe

#### Dashboard Stripe → Developers → Webhooks:

1. **Add endpoint**
2. **URL:** `https://ton-app.onrender.com/webhook/stripe`
3. **Events à écouter:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copie le **Signing secret** (whsec_xxx)

#### Email après paiement:

Dashboard Stripe → Settings → Emails → Customer emails

Dans le template de l'email de confirmation, ajoute le lien:
```
Activez votre accès Discord: https://ton-app.onrender.com/activate?email={{customer.email}}
```

### 6. Configure les variables d'environnement

```bash
cp .env.example .env
```

Remplis toutes les valeurs dans `.env`

### 7. Génère le STATE_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 8. Lance le bot

```bash
# Dev (avec hot reload)
npm run dev

# Prod
npm start
```

## 📁 Structure

```
activation_bot_v2/
├── bot.js              # Code principal
├── package.json        # Dépendances
├── .env.example        # Template des variables
├── database.sql        # Script création table Supabase
└── README.md           # Ce fichier
```

## 🗂️ Mapping Produits → Rôles

| Produit Stripe | Access Level | Rôle Discord | Durée |
|----------------|--------------|--------------|-------|
| prod_TpcMzVxIVuGaMa | SOLO | 1462751613830828135 | 30 jours |
| prod_ToXr1gq3YcBORK | PRO | 1462731035958710327 | 90 jours |
| prod_ToXwVbu17edNfs | VIP | 1462730651727036554 | 180 jours |

## 🔗 Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/` | Health check |
| GET | `/activate?email=xxx` | Démarre OAuth Discord |
| GET | `/auth/discord/callback` | Callback OAuth |
| POST | `/webhook/stripe` | Réception webhooks Stripe |

## ⏰ Tâches Cron

| Fréquence | Action |
|-----------|--------|
| Toutes les heures | Vérifie les expirations et retire les rôles |
| Toutes les 5 min | Attribue les rôles en attente (users qui ont rejoint le serveur) |

## 🚀 Déploiement sur Render

1. Connecte ton repo GitHub
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. Ajoute les variables d'environnement
5. Deploy !

## 🐛 Dépannage

### Le bot est hors ligne
- Vérifie `DISCORD_BOT_TOKEN`
- Vérifie les logs Render/Railway

### OAuth échoue
- Vérifie que `DISCORD_REDIRECT_URI` correspond exactement à celle dans Discord Developer Portal
- Vérifie `DISCORD_CLIENT_SECRET`

### Webhook Stripe ne fonctionne pas
- Vérifie `STRIPE_WEBHOOK_SECRET`
- Vérifie les logs dans Stripe Dashboard → Developers → Webhooks → Logs

### Rôle non attribué
- Vérifie la hiérarchie des rôles (bot au-dessus)
- Vérifie que le membre est sur le serveur
- Vérifie les logs du bot

## 📊 Vérifier les données Supabase

```sql
-- Voir tous les clients
SELECT * FROM customers ORDER BY created_at DESC;

-- Clients actifs avec Discord lié
SELECT email, discord_username, access_level, expires_at 
FROM customers 
WHERE discord_id IS NOT NULL 
AND access_level NOT IN ('expired', 'cancelled');

-- Abonnements qui expirent bientôt (7 jours)
SELECT * FROM customers 
WHERE expires_at < NOW() + INTERVAL '7 days'
AND access_level NOT IN ('expired', 'cancelled');
```
