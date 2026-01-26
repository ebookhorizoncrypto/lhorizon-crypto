# 🌅 L'Horizon Crypto

> Le premier guide crypto où votre apprentissage est récompensé sur la blockchain.

Pour toute question : [contact@ebook-horizoncrypto.com](mailto:contact@ebook-horizoncrypto.com)

---

## 📦 Déploiement sur Vercel

### Étape 1 : Préparer le repo

```bash
cd lhorizon-crypto
git init
git add .
git commit -m "Initial commit - L'Horizon Crypto"
```

### Étape 2 : Connecter à Vercel

1. Allez sur [vercel.com](https://vercel.com)
2. "Add New Project" → Import Git Repository
3. Sélectionnez votre repo

### Étape 3 : Configurer le domaine

1. Dans Vercel Dashboard → Settings → Domains
2. Ajoutez `ebook-horizoncrypto.com`
3. Configurez les DNS chez Cloudflare :

```
Type: CNAME
Name: @
Target: cname.vercel-dns.com
```

Ou utilisez les nameservers Vercel :
```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

### Étape 4 : Variables d'environnement

Dans Vercel Dashboard → Settings → Environment Variables, ajoutez :

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | sk_live_xxx |
| `STRIPE_WEBHOOK_SECRET` | whsec_xxx |
| `RESEND_API_KEY` | re_xxx |
| `DISCORD_WEBHOOK_URL` | https://discord.com/api/webhooks/xxx |
| `SECRET_12_KEYS` | mot1,mot2,mot3,... |
| `ADMIN_API_KEY` | Clé admin longue et sécurisée |

---

## 🔧 Structure du Projet

```
lhorizon-crypto/
├── index.html              # Landing page principale
├── remerciement.html       # Page de remerciement post-achat
├── claim.html              # Page de claim des 20$ USDC
├── contact.html            # Page de contact
├── admin.html              # Dashboard admin (protégé)
├── cgv.html                # Conditions générales
├── mentions-legales.html   # Mentions légales
├── confidentialite.html    # Politique de confidentialité
├── remboursement.html      # Politique de remboursement
├── sitemap.xml             # Sitemap SEO
├── robots.txt              # Robots.txt
├── vercel.json             # Configuration Vercel
├── manifest.json           # PWA manifest
├── api/                    # Vercel Serverless Functions
│   ├── lead-magnet.js      # POST /api/lead-magnet
│   ├── webhook/
│   │   └── stripe.js       # POST /api/webhook/stripe
│   ├── claim/
│   │   └── verify.js       # POST /api/claim/verify
│   └── admin/
│       └── stats.js        # GET /api/admin/stats
├── assets/
│   ├── logo-horizon-crypto.png
│   ├── ebook-cover.jpg
│   └── og-image.png
├── css/
│   ├── styles.css
│   └── threejs.css
├── js/
│   ├── main.js
│   ├── stripe.js
│   └── threejs-effects.js
├── contracts/
│   └── ProofOfLearning.sol
└── .well-known/
    └── security.txt
```

---

## 💳 Configuration Stripe

### Option 1 : Payment Links (Recommandé)

1. Stripe Dashboard → Products → Create Product
2. Créez 3 produits : Solo (99€), Pro (199€), VIP (250€)
3. Pour chaque produit → Create Payment Link
4. Copiez les liens dans `js/stripe.js` :

```javascript
const STRIPE_PAYMENT_LINKS = {
    solo: 'https://buy.stripe.com/xxx',
    pro: 'https://buy.stripe.com/yyy',
    vip: 'https://buy.stripe.com/zzz'
};
```

### Option 2 : Checkout Sessions (Plus de contrôle)

Déployez le backend sur Vercel Functions ou Railway.

---

## 📧 Configuration Resend (Emails)

1. Créez un compte sur [resend.com](https://resend.com)
2. Vérifiez votre domaine `ebook-horizoncrypto.com`
3. Créez une API Key
4. Ajoutez dans les variables Vercel

---

## 🎮 Configuration Discord Bot

1. [discord.com/developers/applications](https://discord.com/developers/applications)
2. New Application → Bot → Copy Token
3. Invitez le bot sur votre serveur
4. Créez un channel #alerts
5. Copiez le webhook URL

---

## ⛓️ Smart Contract (Base)

### Déploiement

```bash
cd contracts
npm install hardhat @openzeppelin/contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network base
```

### Vérification

```bash
npx hardhat verify --network base DEPLOYED_ADDRESS "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

---

## 🔒 Sécurité

- ⚠️ **Ne jamais commiter les fichiers .env**
- ⚠️ **Utilisez les variables d'environnement Vercel**
- ⚠️ **La clé privée du wallet doit rester secrète**
- ⚠️ **Activez 2FA sur Stripe, Discord et Cloudflare**

---

## 📞 Support

- Email: support@ebook-horizoncrypto.com
- Discord: [Rejoindre le serveur](https://discord.gg/xxx)

---

© 2026 L'Horizon Crypto. Tous droits réservés.
