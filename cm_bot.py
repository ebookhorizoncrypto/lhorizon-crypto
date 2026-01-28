import discord
from discord.ext import commands
import os
from threading import Thread
from flask import Flask
from google import genai
from google.genai import types

# ============================================================
#                    CONFIGURATION
# ============================================================

# Token specifique pour ce bot (L'Oracle)
DISCORD_TOKEN = os.getenv("DISCORD_CM_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") # On peut reutiliser la meme cle AI

# Canaux specifiques (A CONFIGURER SUR RENDER)
CHANNEL_WELCOME = int(os.getenv("CHANNEL_WELCOME", "0"))
CHANNEL_ENTRAIDE = int(os.getenv("CHANNEL_ENTRAIDE", "0"))

# Flask pour Render (Keep Alive)
app = Flask('')

@app.route('/')
def home():
    return "L'Oracle CM Bot is alive!"

def run_web():
    port = int(os.environ.get("PORT", 8081)) # Port different si deploye sur meme machine, sinon Render gere
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run_web)
    t.daemon = True
    t.start()

# ============================================================
#                    CERVEAU DE L'ORACLE (KNOWLEDGE)
# ============================================================

SYSTEM_PROMPT = """
Tu es "L'Oracle de l'Horizon", le Community Manager officiel et omniscient de "L'Horizon Crypto".
Ton role est d'accueillir, guider, et repondre aux questions des membres sur le Discord.

TON PERSONNAGE :
- Ton : Bienveillant, sage, un peu mysterieux mais tres precis. Tu utilises des emojis ✨🔮.
- Tu tutoies les membres.
- Tu ne donnes JAMAIS de conseil financier (NFA). Tu eduques.
- Tu es fier du projet "Proof of Learning".

TES CONNAISSANCES (L'Horizon Crypto) :
1. LE CONCEPT :
   - Ce n'est pas juste un ebook, c'est une mission interactive.
   - "Proof of Learning" : Le lecteur doit trouver 12 mots-clés cachés dans le guide.
   - Recompense : Jusqu'à 100$ USDC (sur Base) une fois les 12 clés trouvées.
   - But : Forcer l'apprentissage pour eviter les pertes (scams, erreurs).

2. LES OFFRES (Prix Lancement -50%) :
   - PACK SOLO (99€) : Guide PDF + Cashback 20$ (~19€). Net ~81€.
   - PACK PRO (299€) : Tout Solo + Discord VIP (3 mois) + Cashback 50$ + Masterclass. Net ~256€.
   - PACK VIP (549€) : Tout Pro + Coaching 1h + Analyse Portfolio + Cashback 100$. Net ~464€.
   - OFFRE DISCORD SEUL : 29€/mois (sans le guide).

3. GARANTIES :
   - "Remboursé si vous ne trouvez pas les 12 clés" (sous conditions d'effort).
   - Pas de KYC (Verification d'identite) obligatoire pour l'achat.
   - Paiement securise Stripe/Crypto.

4. SUPPORT :
   - Email : contact@ebook-horizoncrypto.com
   - Si un utilisateur a un probleme technique, dis-lui d'ouvrir un ticket ou d'envoyer un mail.

COMPORTEMENT :
- Si on te demande "C'est quoi le projet ?", explique le concept de Proof of Learning.
- Si on demande "C'est une arnaque ?", reponds avec assurance sur la transparence (Smart Contract, remboursement).
- Sois concis (max 3-4 phrases sauf si demande complexe).
"""

# ============================================================
#                    INIT CLIENTS
# ============================================================

intents = discord.Intents.default()
intents.message_content = True
intents.members = True # Necessaire pour Welcome

bot = commands.Bot(command_prefix="?", intents=intents) 
# Prefix different du bot principal (!) pour eviter les conflits

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

def ask_oracle(user_message):
    try:
        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=f"{SYSTEM_PROMPT}\n\nUSER QUESTION: {user_message}",
            config=types.GenerateContentConfig(
                max_output_tokens=500,
                temperature=0.8 # Un peu plus creatif pour la conversation
            )
        )
        return response.text
    except Exception as e:
        print(f"Erreur Gemini: {e}")
        return "🔮 Mes visions sont troubles... (Erreur IA, reessaie plus tard)."

# ============================================================
#                    EVENEMENTS DISCORD
# ============================================================

@bot.event
async def on_ready():
    print(f"🔮 L'Oracle est eveille : {bot.user}")
    print(f"🔮 Serveurs connectes : {len(bot.guilds)}")

@bot.event
async def on_member_join(member):
    """Accueille les nouveaux membres"""
    channel = bot.get_channel(CHANNEL_WELCOME)
    if not channel:
        return

    embed = discord.Embed(
        title=f"Bienvenue {member.name} ! 🔮",
        description=f"Tu entres dans **L'Horizon Crypto**.\n\nIci, le savoir est la seule richesse qui ne se perd jamais.\n\n📜 **Commence par lire <#{CHANNEL_ENTRAIDE}> ou le règlement.**\n💎 **Si tu as le guide, tes 12 clés t'attendent.**",
        color=0x627EEA
    )
    embed.set_thumbnail(url=member.display_avatar.url)
    embed.set_footer(text="L'Oracle de l'Horizon")
    
    await channel.send(f"Bienvenue <@{member.id}> !", embed=embed)

@bot.event
async def on_message(message):
    # Ne pas repondre a soi-meme ou aux autres bots
    if message.author.bot:
        return

    # 1. Repondre si mentionne (@L'Oracle)
    if bot.user.mentioned_in(message):
        async with message.channel.typing():
            clean_content = message.content.replace(f"<@{bot.user.id}>", "").strip()
            if not clean_content:
                clean_content = "Bonjour !" # Cas ou on ping juste le bot
            
            reply = ask_oracle(clean_content)
            await message.reply(reply)
        return

    # 2. Repondre si DM (Message Prive)
    if isinstance(message.channel, discord.DMChannel):
        async with message.channel.typing():
            reply = ask_oracle(message.content)
            await message.reply(reply)
        return

    # 3. Repondre dans le salon d'entraide (Optionnel)
    if message.channel.id == CHANNEL_ENTRAIDE:
        # On peut choisir de repondre a tout ou seulement si c'est une question
        if "?" in message.content:
             async with message.channel.typing():
                reply = ask_oracle(message.content)
                await message.reply(reply)
    
    # Traiter les commandes (?)
    await bot.process_commands(message)

# ============================================================
#                    LANCEMENT
# ============================================================

if __name__ == "__main__":
    if not DISCORD_TOKEN:
        print("❌ ERREUR : DISCORD_CM_TOKEN manquant")
    else:
        keep_alive()
        bot.run(DISCORD_TOKEN)
