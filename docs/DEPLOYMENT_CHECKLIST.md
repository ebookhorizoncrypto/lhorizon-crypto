# 🚀 Checklist de Déploiement : L'Horizon Crypto

Ce document récapitule les étapes exactes pour passer de la version "Test Local / Simulation" à la version "Production" (Réelle).

## 1. Smart Contract (Blockchain)
- [ ] **Déployer** le contrat `ProofOfLearning.sol` sur **Base Mainnet** (via Remix ou Hardhat).
    - *Constructeur arguments :*
        - `_usdcAddress`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Vrai USDC sur Base)
        - `_trustedForwarder`: `0x...` (Adresse Biconomy ou OZ Defender Mainnet si Gasless, sinon `0x00...00`)
        - `_trustedSigner`: L'adresse publique de votre wallet backend.
- [ ] **Alimenter** le contrat en USDC. (Envoyez des USDC sur l'adresse du contrat une fois déployé).
- [ ] **Noter l'adresse** du contrat déployé (ex: `0xABC...`).

## 2. Backend (Vercel)
- [ ] **Configurez les Variables d'Environnement** sur Vercel (Settings > Environment Variables) :
    - `STRIPE_REWARD_SIGNER_PRIVATE_KEY` : La clé privée du wallet qui signera les autorisations (le `trustedSigner` du contrat).
    - `NEXT_PUBLIC_CONTRACT_ADDRESS` : L'adresse `0xABC...` notée à l'étape 1.
- [ ] **Déployer** le projet sur Vercel (`vercel deploy` ou push git).

## 3. Frontend (Code `claim.html`)
Vous devez modifier **2 lignes** dans le fichier `claim.html` avant de mettre le site en ligne :

### A. L'Adresse du Contrat
Remplacer l'adresse de test par la vraie adresse obtenue à l'étape 1.
```javascript
// Ligne ~665
const CONTRACT_ADDRESS = "0xABC..."; // <-- Votre vraie adresse ici
```

### B. L'URL de l'API
Remplacer l'URL locale (`127.0.0.1`) par l'URL de production de votre site.
```javascript
// Ligne ~760
// const apiResponse = await fetch('http://127.0.0.1:3001/api/sign-claim', ...
const apiResponse = await fetch('/api/sign-claim', ... // <-- URL relative slash
```
*Note : En utilisant juste `/api/sign-claim`, le navigateur utilisera automatiquement le domaine actuel (ex: `ebook-horizoncrypto.com/api/sign-claim`).*

## 4. Vérification Finale
1.  Le contrat a des USDC ? ✅
2.  Le contrat connait l'adresse `trustedSigner` (votre backend) ? ✅
3.  Vercel a la clé privée correspondant au `trustedSigner` ? ✅
4.  Le fichier HTML pointe vers le bon contrat ? ✅

C'est tout ! 🚀
