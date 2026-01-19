# ⛽ Guide de Configuration Gasless (Base Blockchain)

Ce guide explique comment déployer et configurer votre Smart Contract `ProofOfLearning` pour que vos utilisateurs ne paient aucun frais de gaz (Gasless).

## 1. Architecture

- **User (Client)** : Signe un message d'intention "Je veux claim".
- **Backend (API)** : Vérifie le mot de passe/quiz, et retourne une **Signature Autorisée**.
- **Relayer (OpenZeppelin Defender)** : Reçoit la transaction, paie les frais en ETH (Base), et l'envoie à la blockchain.
- **Smart Contract** : Vérifie la signature du Backend + l'identité de l'utilisateur via `ERC2771`.

## 2. Déploiement du Contrat

Lors du déploiement, vous devrez fournir 3 adresses :

1.  `_usdcAddress` : `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC sur Base)
2.  `_trustedForwarder` : **Adresse du Forwarder OpenZeppelin sur Base**.
    *   *Note : Vous pouvez trouver l'adresse officielle des Forwarders OpenZeppelin [ici](https://docs.openzeppelin.com/defender/v2/tutorial/relayers).*
    *   Si vous utilisez Biconomy, utilisez leur adresse de Forwarder.
3.  `_trustedSigner` : L'adresse publique de votre **Wallet Backend** (celui qui signera les autorisations).

## 3. Configuration OpenZeppelin Defender (Recommandé)

C'est la solution la plus simple pour le "Sponsoring de Gaz".

### Étape A : Créer un Relayer
1.  Créez un compte sur [defender.openzeppelin.com](https://defender.openzeppelin.com/).
2.  Allez dans **Relayers** > **Create Relayer**.
3.  Nom : `HorizonCryptoRelayer`.
4.  Network : **Base Mainnet**.
5.  Une fois créé, **envoyez de l'ETH (Base)** à l'adresse du Relayer (c'est lui qui paiera le gaz). 0.05 ETH suffit largement pour commencer.

### Étape B : Setup Autotask (API de Relai)
1.  Allez dans **Autotasks** > **Create Autotask**.
2.  Trigger : **Webhook** (Cela vous donnera une URL secrète).
3.  Connectez-le à votre Relayer créé ci-dessus.
4.  Code de l'Autotask (Exemple simplifié) :
    ```javascript
    const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
    const ethers = require('ethers');

    exports.handler = async function(event) {
      const provider = new DefenderRelayProvider(event);
      const signer = new DefenderRelaySigner(event, provider, { speed: 'fast' });
      
      // Les données envoyées par votre Frontend
      const { request, signature } = event.request.body;
      
      // Envoi de la transaction via le Forwarder
      // (Implementation spécifique selon le Forwarder utilisé)
      const tx = await signer.sendTransaction({
        to: request.to, 
        data: request.data,
        gasLimit: 200000 
      });
      
      return tx;
    }
    ```

## 4. Intégration Frontend & Backend

### Backend (Node.js)
Votre backend doit signer une autorisation quand l'utilisateur réussit le quiz.
```javascript
const wallet = new ethers.Wallet(PRIVATE_KEY); // _trustedSigner
const messageHash = ethers.utils.solidityKeccak256(
    ['address', 'bytes32', 'address'],
    [userAddress, emailHash, contractAddress]
);
const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));
// Renvoyer cette 'signature' au frontend
```

### Frontend
Le frontend, au lieu d'appeler `contract.claimReward()`, doit :
1.  Récupérer la `signature` depuis votre API.
2.  Construire une méta-transaction (EIP-712).
3.  Envoyer cette demande au **Webhook OpenZeppelin Defender** créé à l'étape 3.

## 5. Alternative : Biconomy
Si OpenZeppelin semble trop technique, **Biconomy** offre un SDK "Plug & Play" (Gasless SDK).
1.  Inscrivez votre Smart Contract sur le Dashboard Biconomy.
2.  Activez le "Gas Tank" et déposez des fonds.
3.  Dans le frontend, utilisez `@biconomy/core` pour envelopper votre provider ethers.js.
4.  L'appel de fonction devient automatiquement "Gasless".

---

**Résumé Sécurité :**
- Même si le Relayer est compromis, il ne peut pas voler de fonds car il ne peut pas forger la `signature` du Backend.
- Seul le Backend (qui détient la clé privée du `_trustedSigner`) peut autoriser un paiement de 20$.
