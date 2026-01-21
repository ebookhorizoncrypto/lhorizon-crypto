import { Resend } from 'resend';

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

        // Check API key
        if (!process.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured');
            return res.status(500).json({ error: 'Configuration error: RESEND_API_KEY missing' });
        }

        const resend = new Resend(process.env.RESEND_API_KEY);

        // Use FROM_EMAIL or fallback to Resend test domain
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        const domain = process.env.DOMAIN || 'https://lhorizon-crypto.vercel.app';

        console.log('Sending email to:', email);
        console.log('From:', fromEmail);

        // Send the extract email (with attachment simulation via link)
        // Since Resend Attachments can be complex in serverless without buffering, we link to the file.
        // User provided a .docx, usually we serve PDF. But let's point to the file we placed in assets.
        // Ideally this should be a PDF. For now, linking to the docx or assumes it's converted.
        // User asked to put "Extrait - Ebook Horizon Crypto .docx" in the right place.
        // I renamed it to "extrait-ebook.docx" in assets folder.

        const result = await resend.emails.send({
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 L'Horizon Crypto</h1>
        </div>
        <div class="content">
            <h2>Votre extrait gratuit est prêt !</h2>
            
            <p>Il y a quelques années, j'étais exactement comme vous. Je voyais les cryptos exploser... <strong>et je ne comprenais rien</strong>.</p>
            
            <p>J'ai fait toutes les erreurs possibles : <strong>acheté au plus haut</strong>, <strong>vendu dans la panique</strong>, perdu de l'argent sur des "projets révolutionnaires" qui n'étaient que des arnaques.</p>
            
            <p>Puis j'ai décidé d'arrêter de subir et de <strong>comprendre vraiment</strong>.</p>
            
            <div class="highlight-box">
                <h3>📚 Ce que vous allez découvrir :</h3>
                <ul>
                    <li>✅ Les 3 erreurs fatales que font 90% des débutants</li>
                    <li>✅ Comment fonctionne VRAIMENT la blockchain</li>
                    <li>✅ <strong>2 mots-clés CACHÉS</strong> à trouver</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="${domain}/assets/extrait-ebook.docx" class="button">📥 TÉLÉCHARGER L'EXTRAIT GRATUIT</a>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <p>Prêt à passer au niveau supérieur ?</p>
                <a href="https://ebook-horizoncrypto.com/offres" style="color: #f7931a; font-weight: bold; font-size: 1.1em;">Découvrir nos offres complètes →</a>
            </div>
            
            <div class="keys-box" style="margin-top: 30px;">
                <h3>🔑 Le Défi des 2 Clés</h3>
                <p>J'ai caché <strong>2 mots-clés secrets</strong> dans ces 20 pages.</p>
                <p style="color: #00ff88; font-weight: bold;">Le guide complet en contient 12. Trouvez-les tous = 100$ USDC sur votre wallet.</p>
            </div>
            
            <p>À vous de jouer,<br><strong>L'équipe L'Horizon Crypto</strong></p>
        </div>
        <div class="footer">
            <p>© 2026 L'Horizon Crypto. Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>`
        });

        console.log('Email sent successfully:', result);

        return res.status(200).json({ success: true, message: 'Email envoyé !' });

    } catch (error) {
        console.error('Error sending extract email:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
        return res.status(500).json({ error: error.message || 'Erreur lors de l\'envoi' });
    }
}
