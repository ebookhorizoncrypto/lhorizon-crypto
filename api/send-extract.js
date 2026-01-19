import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
// Use Resend's test domain if custom domain not verified
const fromEmail = process.env.FROM_EMAIL || 'L\'Horizon Crypto <onboarding@resend.dev>';
const domain = process.env.DOMAIN || 'https://lhorizon-crypto.vercel.app';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Email invalide' });
        }

        // Send the extract email
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Voici votre extrait GRATUIT (+ 2 clés cachées à trouver dedans 👀)",
            html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #ffffff; padding: 40px 20px; line-height: 1.8; }
        .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #f7931a, #ffb347); padding: 40px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; color: #000; }
        .content { padding: 40px; }
        .content h2 { color: #f7931a; margin-top: 0; }
        .button { display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f7931a, #e68a00); color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .highlight-box { background: rgba(247, 147, 26, 0.1); border: 1px solid rgba(247, 147, 26, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0; }
        .keys-box { background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 8px; padding: 20px; text-align: center; }
        .keys-box h3 { color: #00ff88; margin: 0 0 10px 0; }
        .footer { padding: 20px 40px; background: #0a0a0f; text-align: center; font-size: 12px; color: #888; }
        .footer a { color: #f7931a; }
        .story { font-size: 1rem; color: #ccc; }
        .story strong { color: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 L'Horizon Crypto</h1>
        </div>
        <div class="content">
            <h2>Votre extrait gratuit est prêt !</h2>
            
            <p class="story">
                Il y a quelques années, j'étais exactement comme vous.<br><br>
                
                Je voyais les cryptos exploser... <strong>et je ne comprenais rien</strong>.<br><br>
                
                J'ai fait toutes les erreurs possibles : <strong>acheté au plus haut</strong>, <strong>vendu dans la panique</strong>, perdu de l'argent sur des "projets révolutionnaires" qui n'étaient que des arnaques.<br><br>
                
                Puis j'ai décidé d'arrêter de subir et de <strong>comprendre vraiment</strong>.
            </p>
            
            <div class="highlight-box">
                <h3>📚 Ce que vous allez découvrir dans cet extrait :</h3>
                <ul>
                    <li>✅ Les 3 erreurs fatales que font 90% des débutants</li>
                    <li>✅ Comment fonctionne VRAIMENT la blockchain (sans jargon)</li>
                    <li>✅ La stratégie "DCA" que même les pros utilisent</li>
                    <li>✅ <strong>2 mots-clés CACHÉS</strong> à trouver (sur les 12 du guide complet)</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="${domain}/assets/extrait-horizon-crypto.pdf" class="button">📥 TÉLÉCHARGER L'EXTRAIT GRATUIT</a>
            </div>
            
            <div class="keys-box">
                <h3>🔑 Le Défi des 2 Clés</h3>
                <p>J'ai caché <strong>2 mots-clés secrets</strong> dans ces 20 pages.<br>
                Si vous les trouvez, vous avez prouvé que vous êtes prêt(e) pour la suite...</p>
                <p style="color: #00ff88; font-weight: bold;">Le guide complet en contient 12. Trouvez-les tous = 20$ USDC sur votre wallet.</p>
            </div>
            
            <p class="story" style="margin-top: 30px;">
                La crypto n'est pas un casino.<br>
                <strong>C'est un outil de liberté financière</strong> pour ceux qui prennent le temps de comprendre.<br><br>
                
                À vous de jouer,<br>
                <strong>L'équipe L'Horizon Crypto</strong>
            </p>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                <small>
                    PS : Si vous trouvez les 2 clés, répondez à cet email avec votre réponse.<br>
                    Ceux qui réussissent recevront une <strong>surprise exclusive</strong>. 👀
                </small>
            </p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
            <p><a href="${domain}/cgv">CGV</a> | <a href="${domain}/confidentialite">Confidentialité</a></p>
        </div>
    </div>
</body>
</html>`
        });

        console.log(`📧 Extract email sent to ${email}`);

        return res.status(200).json({ success: true, message: 'Email envoyé !' });

    } catch (error) {
        console.error('Error sending extract email:', error);
        return res.status(500).json({ error: 'Erreur lors de l\'envoi' });
    }
}
