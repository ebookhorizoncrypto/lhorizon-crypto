# ⛽ Guide de Configuration Gasless (Base Blockchain)

Ce guide explique comment déployer et configurer votre Smart Contract `ProofOfLearning` pour que vos utilisateurs ne paient aucun frais de gaz (Gasless).

## 1. Architecture

- **User (Client)** : Signe un message d'intention "Je veux claim".
- **Backend (API)** : Vérifie le mot de passe/quiz, et retourne une **Signature Autorisée**.
- **Relayer (OpenZeppelin Defender)** : Reçoit la transaction, paie les frais en ETH (Base), et l'envoie à la blockchain.
- **Smart Contract** : Vérifie la signature du Backend + l'identité de l'utilisateur via `ERC2771`.

## 2. Déploiement du Contrat (TESTNET - Base Sepolia)

Pour tester gratuitement sur **Base Sepolia**, utilisez ces adresses lors du déploiement :

1.  `_usdcAddress` : `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (USDC Mock sur Base Sepolia)
    *   *Note : Si vous n'avez pas de tokens, vous pouvez déployer votre propre token ERC20 de test "FakeUSDC".*
2.  `_trustedForwarder` : **0x5001A14CA6163143316a7C614e30e6041033Ac20** 
    *   *Ceci est l'adresse du Forwarder officiel Biconomy sur Base Sepolia.*
    *   *Si vous utilisez OpenZeppelin Defender, vérifiez l'adresse spécifique dans leur dashboard.*
3.  `_trustedSigner` : L'adresse publique de votre **Wallet Backend** (celui qui signera les autorisations).

### Faucet (Pour avoir de l'ETH de test)
Pour payer le gaz du déploiement et financer le Relayer, réclamez de l'ETH Base Sepolia ici :
- [Coinbase Faucet](https://www.coinbase.com/faucets/base-sepolia-eth)
- [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)

## 3. Configuration OpenZeppelin Defender (Mode Testnet)

### Étape A : Créer un Relayer
1.  Créez un compte sur [defender.openzeppelin.com](https://defender.openzeppelin.com/).
2.  Allez dans **Relayers** > **Create Relayer**.
3.  Nom : `HorizonTestnetRelayer`.
4.  Network : **Base Sepolia** (Assurez-vous de bien choisir le Testnet).
5.  Une fois créé, envoyez de l'ETH test (récupéré au faucet) à l'adresse du Relayer.

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
