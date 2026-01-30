import discord
from discord.ext import commands, tasks
import requests
from datetime import datetime, time
import pytz
import asyncio
import os
from openai import OpenAI
from flask import Flask
from threading import Thread
import traceback

# ============================================================
#                    SERVEUR WEB (Keep Alive)
# ============================================================
app = Flask('')

@app.route('/')
def home():
    return "Horizon Elite 2026 : Système Opérationnel ✅"

@app.route('/health')
def health():
    return {"status": "ok", "time": datetime.now().isoformat()}

def run_web():
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run_web)
    t.daemon = True
    t.start()
    print("[WEB] Serveur keep-alive démarré")

# ============================================================
#                    CONFIGURATION
# ============================================================
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
XAI_API_KEY = os.getenv("XAI_API_KEY")
LUNARCRUSH_API_KEY = os.getenv("LUNARCRUSH_API_KEY")  # 🆕 LunarCrush
ADMIN_USER_ID = int(os.getenv("ADMIN_USER_ID", "0"))

# Configuration des canaux
CHANNELS = {
    "marche": int(os.getenv("CHANNEL_MARCHE", "0")),
    "opportunities": int(os.getenv("CHANNEL_OPPORTUNITIES", "0")),
    "sentiment": int(os.getenv("CHANNEL_SENTIMENT", "0")),
    "setup": int(os.getenv("CHANNEL_SETUP", "0")),
    "solo_alertes": int(os.getenv("CHANNEL_SOLO_ALERTES", "0")),
    "solo_fg": int(os.getenv("CHANNEL_SOLO_FEAR_GREED", "0")),
    "solo_prix": int(os.getenv("CHANNEL_SOLO_PRIX", "0")),
    "watchlist": int(os.getenv("CHANNEL_WATCHLIST", "0")),
    "fg": int(os.getenv("CHANNEL_FEAR_GREED", "0")),
    "flash_news": int(os.getenv("CHANNEL_FLASH_NEWS", "0")),
    "actus_crypto": int(os.getenv("CHANNEL_ACTUS_CRYPTO", "0")),
    "vip_lounge": int(os.getenv("CHANNEL_VIP_LOUNGE", "0")),
    "admin_social": int(os.getenv("CHANNEL_ADMIN_SOCIAL", "0"))  # 🆕 Posts réseaux sociaux
}

# 🆕 Configuration Ebook/Produit pour les posts
EBOOK_CONFIG = {
    "name": "Guide Horizon Elite",
    "link": os.getenv("EBOOK_LINK", "https://ton-lien-ebook.com"),  # À configurer sur Render
    "price": os.getenv("EBOOK_PRICE", "99€"),
    "cashback": os.getenv("EBOOK_CASHBACK", "20$ de crypto en cashback"),
    "offer": "À partir de 99€ + 20$ de crypto en cashback directement sur ton wallet 🎁",
}

TIMEZONE = pytz.timezone("Europe/Paris")

# ============================================================
#              FLAGS ET CACHES GLOBAUX
# ============================================================
startup_done = False
sent_news_ids = set()
sent_alert_ids = set()
last_news_sent_time = None
NEWS_MIN_DELAY_MINUTES = 60

last_btc_price = None
last_eth_price = None
last_fear_greed = None
last_btc_dominance = None

# Mots-clés URGENTS (strict)
URGENT_KEYWORDS = [
    "SEC lawsuit", "SEC sues", "SEC charges", "ETF approved", "ETF rejected", "ETF denied",
    "banned crypto", "crypto ban", "executive order crypto",
    "hacked for", "million stolen", "billion stolen", "exploit drains",
    "exchange hack", "bridge hack", "protocol hack",
    "flash crash", "billion liquidated", "mass liquidation",
    "bankrupt", "bankruptcy", "files for bankruptcy", "insolvent",
    "all-time high", "new ATH", "record high", "breaks record",
    "BlackRock Bitcoin", "BlackRock ETF", "Fidelity ETF",
    "halving complete", "Bitcoin halving", "network attack", "51% attack",
]

ALERT_THRESHOLDS = {
    "btc_change_1h": 3.0,
    "eth_change_1h": 4.0,
    "fear_greed_change": 10,
    "dominance_change": 1.5,
}

# 🆕 LIENS TRADINGVIEW pour graphiques
TRADINGVIEW_CHARTS = {
    "BTC": "https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT",
    "ETH": "https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT",
    "SOL": "https://www.tradingview.com/chart/?symbol=BINANCE:SOLUSDT",
    "BNB": "https://www.tradingview.com/chart/?symbol=BINANCE:BNBUSDT",
    "XRP": "https://www.tradingview.com/chart/?symbol=BINANCE:XRPUSDT",
    "ADA": "https://www.tradingview.com/chart/?symbol=BINANCE:ADAUSDT",
    "DOGE": "https://www.tradingview.com/chart/?symbol=BINANCE:DOGEUSDT",
    "AVAX": "https://www.tradingview.com/chart/?symbol=BINANCE:AVAXUSDT",
    "LINK": "https://www.tradingview.com/chart/?symbol=BINANCE:LINKUSDT",
    "MATIC": "https://www.tradingview.com/chart/?symbol=BINANCE:MATICUSDT",
}

def get_tradingview_link(symbol):
    """Génère un lien TradingView pour un symbole"""
    symbol_upper = symbol.upper()
    if symbol_upper in TRADINGVIEW_CHARTS:
        return TRADINGVIEW_CHARTS[symbol_upper]
    return f"https://www.tradingview.com/chart/?symbol=BINANCE:{symbol_upper}USDT"

# Logs de configuration
print("=" * 60)
print("🚀 HORIZON ELITE BOT V4 - CONFIGURATION")
print("=" * 60)
print(f"[CONFIG] DISCORD_TOKEN: {'✅' if DISCORD_TOKEN else '❌'}")
print(f"[CONFIG] XAI_API_KEY: {'✅' if XAI_API_KEY else '❌'}")
print(f"[CONFIG] LUNARCRUSH_API_KEY: {'✅' if LUNARCRUSH_API_KEY else '❌ (optionnel)'}")
print("=" * 60)

# ============================================================
#                    DISCORD BOT SETUP
# ============================================================
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
bot = commands.Bot(command_prefix="!", intents=intents)

client_xai = None
if XAI_API_KEY:
    try:
        client_xai = OpenAI(api_key=XAI_API_KEY, base_url="https://api.x.ai/v1")
        print("[GROK] Client xAI initialisé ✅")
    except Exception as e:
        print(f"[GROK] Erreur: {e}")

# ============================================================
#                    FONCTIONS API DATA
# ============================================================
def get_btc_price():
    """Récupère BTC/ETH avec variations"""
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
            timeout=10
        )
        data = r.json()
        return {
            "btc_price": data['bitcoin']['usd'],
            "btc_change": data['bitcoin'].get('usd_24h_change', 0) or 0,
            "eth_price": data['ethereum']['usd'],
            "eth_change": data['ethereum'].get('usd_24h_change', 0) or 0,
        }
    except Exception as e:
        print(f"[API] Erreur prix: {e}")
        return None

def get_global_data():
    """Récupère les données globales"""
    try:
        r = requests.get("https://api.coingecko.com/api/v3/global", timeout=10)
        data = r.json()['data']
        return {
            "total_market_cap": data['total_market_cap']['usd'],
            "btc_dominance": data['market_cap_percentage']['btc'],
            "eth_dominance": data['market_cap_percentage']['eth'],
            "market_cap_change_24h": data['market_cap_change_percentage_24h_usd']
        }
    except Exception as e:
        print(f"[API] Erreur global: {e}")
        return None

def get_fear_greed():
    """Récupère le Fear & Greed"""
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=7", timeout=10)
        data = r.json()['data']
        current = data[0]
        return {
            "value": int(current['value']),
            "sentiment": current['value_classification'],
            "history": [int(d['value']) for d in data[1:7]]
        }
    except Exception as e:
        print(f"[API] Erreur F&G: {e}")
        return None

def get_crypto_news_with_links():
    """Récupère les news"""
    try:
        r = requests.get("https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest", timeout=10)
        news_list = r.json().get("Data", [])[:15]
        return [{
            "id": str(n.get("id", "")),
            "title": n.get("title", ""),
            "body": n.get("body", "")[:400],
            "url": n.get("url", ""),
            "source": n.get("source", ""),
        } for n in news_list]
    except:
        return []

def get_top_movers():
    """Récupère les top movers avec prix"""
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&sparkline=false&price_change_percentage=1h,24h,7d",
            timeout=15
        )
        data = r.json()
        return data if isinstance(data, list) else []
    except:
        return []

def get_trending_coins():
    """Récupère les trending"""
    try:
        r = requests.get("https://api.coingecko.com/api/v3/search/trending", timeout=10)
        return r.json().get("coins", [])[:7]
    except:
        return []

def get_defi_yields():
    """Récupère les yields DeFi"""
    try:
        r = requests.get("https://yields.llama.fi/pools", timeout=15)
        data = r.json()["data"]
        good = [p for p in data if p.get("apy") and 5 < p["apy"] < 100 and p.get("tvlUsd", 0) > 10000000]
        return sorted(good, key=lambda x: x["tvlUsd"], reverse=True)[:5]
    except:
        return []

# ============================================================
#     🆕 COINGLASS API - Liquidations & Funding
# ============================================================
def get_coinglass_data():
    """Récupère liquidations et funding rates (API publique)"""
    data = {
        "liquidations_24h": None,
        "long_liquidations": None,
        "short_liquidations": None,
        "funding_btc": None,
        "funding_eth": None,
        "open_interest_btc": None,
    }
    
    try:
        # Liquidations globales (endpoint public)
        r = requests.get(
            "https://open-api.coinglass.com/public/v2/liquidation_history?time_type=h24&symbol=all",
            timeout=10
        )
        if r.status_code == 200:
            liq_data = r.json().get("data", {})
            if liq_data:
                data["liquidations_24h"] = liq_data.get("total_liquidation_usd", 0)
                data["long_liquidations"] = liq_data.get("long_liquidation_usd", 0)
                data["short_liquidations"] = liq_data.get("short_liquidation_usd", 0)
    except Exception as e:
        print(f"[COINGLASS] Erreur liquidations: {e}")
    
    try:
        # Funding rates (endpoint public)
        r = requests.get(
            "https://open-api.coinglass.com/public/v2/funding",
            timeout=10
        )
        if r.status_code == 200:
            funding_data = r.json().get("data", [])
            for item in funding_data:
                if item.get("symbol") == "BTC":
                    data["funding_btc"] = item.get("fundingRate", 0)
                elif item.get("symbol") == "ETH":
                    data["funding_eth"] = item.get("fundingRate", 0)
    except Exception as e:
        print(f"[COINGLASS] Erreur funding: {e}")
    
    try:
        # Open Interest BTC
        r = requests.get(
            "https://open-api.coinglass.com/public/v2/open_interest?symbol=BTC",
            timeout=10
        )
        if r.status_code == 200:
            oi_data = r.json().get("data", {})
            data["open_interest_btc"] = oi_data.get("openInterest", 0)
    except Exception as e:
        print(f"[COINGLASS] Erreur OI: {e}")
    
    print(f"[COINGLASS] Données récupérées: {data}")
    return data

# ============================================================
#     🆕 LUNARCRUSH API - Social Metrics
# ============================================================
def get_lunarcrush_data():
    """Récupère les métriques sociales (influence, mentions)"""
    if not LUNARCRUSH_API_KEY:
        print("[LUNARCRUSH] ⚠️ Pas de clé API configurée")
        return None
    
    try:
        headers = {"Authorization": f"Bearer {LUNARCRUSH_API_KEY}"}
        
        # Top coins par activité sociale
        r = requests.get(
            "https://lunarcrush.com/api4/public/coins/list/v2",
            headers=headers,
            timeout=15
        )
        
        if r.status_code != 200:
            print(f"[LUNARCRUSH] Erreur API: {r.status_code}")
            return None
        
        data = r.json().get("data", [])[:20]
        
        social_data = []
        for coin in data:
            social_data.append({
                "symbol": coin.get("symbol", ""),
                "name": coin.get("name", ""),
                "price": coin.get("price", 0),
                "galaxy_score": coin.get("galaxy_score", 0),  # Score global LunarCrush
                "alt_rank": coin.get("alt_rank", 0),  # Classement alternatif
                "social_volume": coin.get("social_volume", 0),  # Volume de mentions
                "social_score": coin.get("social_score", 0),  # Score social
                "market_cap": coin.get("market_cap", 0),
                "percent_change_24h": coin.get("percent_change_24h", 0),
            })
        
        print(f"[LUNARCRUSH] ✅ {len(social_data)} coins récupérés")
        return social_data
        
    except Exception as e:
        print(f"[LUNARCRUSH] Erreur: {e}")
        return None

def get_lunarcrush_top_influencers():
    """Récupère les top influenceurs crypto"""
    if not LUNARCRUSH_API_KEY:
        return None
    
    try:
        headers = {"Authorization": f"Bearer {LUNARCRUSH_API_KEY}"}
        r = requests.get(
            "https://lunarcrush.com/api4/public/influencers/list/v1?limit=10",
            headers=headers,
            timeout=15
        )
        
        if r.status_code != 200:
            return None
        
        data = r.json().get("data", [])[:10]
        return [{
            "name": inf.get("display_name", ""),
            "handle": inf.get("twitter_screen_name", ""),
            "followers": inf.get("followers", 0),
            "engagement": inf.get("engagement", 0),
        } for inf in data]
        
    except Exception as e:
        print(f"[LUNARCRUSH] Erreur influenceurs: {e}")
        return None

# ============================================================
#                    FETCH ALL DATA
# ============================================================
def fetch_all_market_data():
    """Récupère TOUTES les données"""
    print("[DATA] Récupération des données...")
    
    prices = get_btc_price()
    global_data = get_global_data()
    fg = get_fear_greed()
    news = get_crypto_news_with_links()
    movers = get_top_movers()
    trending = get_trending_coins()
    defi = get_defi_yields()
    coinglass = get_coinglass_data()  # 🆕
    lunarcrush = get_lunarcrush_data()  # 🆕
    
    if not prices or not global_data or not fg:
        print("[DATA] ⚠️ Données essentielles incomplètes")
        return None
    
    print("[DATA] ✅ Données complètes récupérées")
    return {
        "prices": prices,
        "global": global_data,
        "fear_greed": fg,
        "news": news,
        "movers": movers,
        "trending": trending,
        "defi": defi,
        "coinglass": coinglass,  # 🆕
        "lunarcrush": lunarcrush,  # 🆕
        "timestamp": datetime.now(TIMEZONE).strftime("%d/%m/%Y %H:%M")
    }

# ============================================================
#                    MOTEUR GROK-3
# ============================================================
def ask_grok(prompt, max_tokens=800):
    if not client_xai:
        return "⚠️ Service IA non configuré."
    
    current_date = datetime.now(TIMEZONE).strftime("%d %B %Y à %H:%M")
    
    try:
        response = client_xai.chat.completions.create(
            model="grok-3",
            messages=[
                {"role": "system", "content": f"Tu es l'analyste Horizon Elite, le {current_date}. Style: Expert, FRANÇAIS, concis, emojis. UTILISE UNIQUEMENT les données fournies, N'INVENTE JAMAIS de prix. NFA-DYOR à la fin."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=max_tokens,
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[GROK] Erreur: {e}")
        return None

def ask_grok_mini(prompt):
    if not client_xai:
        return None
    try:
        response = client_xai.chat.completions.create(
            model="grok-3",
            messages=[
                {"role": "system", "content": "Analyste crypto. Français, 2-3 lignes max."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.3
        )
        return response.choices[0].message.content
    except:
        return None

# ============================================================
#     🆕 GÉNÉRATEUR DE POSTS RÉSEAUX SOCIAUX
# ============================================================
SOCIAL_POST_THEMES = [
    "education",      # Apprendre la crypto
    "opportunity",    # Opportunités de marché
    "motivation",     # Mindset & motivation
    "fear",           # Vaincre la peur
    "success",        # Succès & témoignages
    "market",         # Analyse marché actuel
    "community",      # Communauté Horizon
    "beginner",       # Pour les débutants
]

def generate_social_posts(theme="auto", data=None):
    """Génère des posts pour Twitter, Instagram et LinkedIn"""
    
    if not client_xai:
        return None
    
    ebook_link = EBOOK_CONFIG["link"]
    ebook_name = EBOOK_CONFIG["name"]
    ebook_price = EBOOK_CONFIG.get("price", "")
    
    # Contexte marché si disponible
    market_context = ""
    if data:
        prices = data.get('prices', {})
        fg = data.get('fear_greed', {})
        if prices and fg:
            market_context = f"""
CONTEXTE MARCHÉ ACTUEL:
- BTC: ${prices.get('btc_price', 0):,.0f} ({prices.get('btc_change', 0):+.1f}%)
- ETH: ${prices.get('eth_price', 0):,.0f} ({prices.get('eth_change', 0):+.1f}%)
- Fear & Greed: {fg.get('value', 50)}/100 ({fg.get('sentiment', 'Neutre')})
"""
    
    prompt = f"""Tu es un expert en marketing crypto et copywriting. Tu dois créer 3 posts pour les réseaux sociaux de "Horizon Elite", une communauté crypto premium.

OBJECTIF: Rassurer, éduquer, motiver les gens à rejoindre la communauté et télécharger le guide.

LIEN À INCLURE: {ebook_link}
NOM DU GUIDE: {ebook_name}
{f"PRIX: {ebook_price}" if ebook_price else ""}

THÈME DEMANDÉ: {theme if theme != "auto" else "choisis le meilleur selon le contexte marché"}

{market_context}

RÈGLES IMPORTANTES:
1. Style STORYTELLING - raconte une histoire, crée de l'émotion
2. RASSURE - la crypto n'est pas un casino, c'est accessible
3. MOTIVE - donne envie d'agir maintenant
4. PRO mais ACCESSIBLE - pas de jargon compliqué
5. AUTHENTIQUE - pas de promesses irréalistes
6. CTA clair vers le lien

Génère exactement 3 posts avec ce format:

===TWITTER===
[Post de 280 caractères max avec emojis, hashtags #Crypto #Bitcoin, et le lien]

===INSTAGRAM===
[Post plus long, storytelling, avec emojis, call-to-action fort, hashtags à la fin (10-15), et le lien en fin de caption]

===LINKEDIN===
[Post professionnel, éducatif, format aéré avec sauts de ligne, ton expert mais accessible, et le lien]

IMPORTANT:
- Chaque post doit être UNIQUE et adapté à la plateforme
- Twitter: Court, percutant, urgence
- Instagram: Émotionnel, visuel (décris l'image idéale), storytelling
- LinkedIn: Professionnel, valeur ajoutée, crédibilité
- TOUJOURS inclure le lien {ebook_link}
- Ne dis JAMAIS "deviens riche rapidement" ou promesses irréalistes
- Mentionne la communauté Horizon Elite
"""

    try:
        response = client_xai.chat.completions.create(
            model="grok-3",
            messages=[
                {"role": "system", "content": "Tu es un expert copywriter spécialisé crypto. Tu crées des posts engageants, authentiques et professionnels. Jamais de promesses irréalistes."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.7  # Plus créatif
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[SOCIAL] Erreur génération: {e}")
        return None

def generate_image_prompts(theme="auto", data=None):
    """Génère des prompts d'images pour Midjourney/DALL-E/Leonardo AI"""
    
    if not client_xai:
        return None
    
    # Contexte marché
    market_mood = "neutre"
    btc_price = 0
    fg_value = 50
    
    if data:
        prices = data.get('prices', {})
        fg = data.get('fear_greed', {})
        btc_price = prices.get('btc_price', 0)
        fg_value = fg.get('value', 50)
        
        if fg_value < 25:
            market_mood = "peur extrême, marché en baisse, atmosphère tendue mais opportunité"
        elif fg_value < 45:
            market_mood = "prudence, incertitude, réflexion"
        elif fg_value < 55:
            market_mood = "neutre, équilibré, calme"
        elif fg_value < 75:
            market_mood = "optimisme, momentum positif, énergie"
        else:
            market_mood = "euphorie, bull run, excitation maximale"
    
    prompt = f"""Tu es un expert en génération d'images IA (Midjourney, DALL-E, Leonardo AI).

CONTEXTE:
- Marque: Horizon Elite (communauté crypto premium)
- Thème du post: {theme}
- Ambiance marché: {market_mood}
- Fear & Greed: {fg_value}/100
- Prix BTC: ${btc_price:,.0f}

Génère 3 prompts d'images professionnels et impactants:

===PROMPT_TWITTER===
[Prompt pour image carrée 1:1, style moderne, impactant, adapté au thème. Format: description détaillée en anglais, style artistique, couleurs, ambiance. Max 200 mots.]

===PROMPT_INSTAGRAM===
[Prompt pour image portrait 4:5 ou carrée, très visuel, esthétique, storytelling visuel. Inclure des éléments crypto subtils (pas de logos). Style lifestyle/inspirational. Max 200 mots.]

===PROMPT_LINKEDIN===
[Prompt pour image paysage 1200x627, professionnel, corporate mais moderne, inspirant confiance. Peut inclure des graphiques abstraits, données visuelles. Max 200 mots.]

RÈGLES POUR LES PROMPTS:
1. En ANGLAIS (meilleurs résultats IA)
2. Style: moderne, premium, professionnel
3. Couleurs: Bleu nuit, or, violet, néon subtil
4. Éviter: logos crypto explicites, visages réalistes, texte dans l'image
5. Inclure: --ar [ratio] --v 6 --style raw (pour Midjourney)
6. Ambiance: {market_mood}
7. Thème visuel adapté au thème "{theme}"

STYLES SUGGÉRÉS SELON LE THÈME:
- education: bibliothèque futuriste, hologrammes, apprentissage
- opportunity: porte dorée, lumière, horizon, montagne sommet
- motivation: personne de dos regardant l'horizon, lever de soleil
- fear: tempête qui se calme, soleil perçant les nuages, phare
- success: sommet de montagne, trophée abstrait, célébration subtile
- market: graphiques 3D abstraits, données fluides, visualisation
- community: silhouettes connectées, réseau lumineux, ensemble
- beginner: premier pas, chemin illuminé, guide, boussole
"""

    try:
        response = client_xai.chat.completions.create(
            model="grok-3",
            messages=[
                {"role": "system", "content": "Tu es un expert en prompts pour génération d'images IA. Tu crées des prompts détaillés, professionnels et optimisés pour Midjourney/DALL-E/Leonardo AI."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1200,
            temperature=0.8  # Plus créatif pour les images
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[IMAGE] Erreur génération prompts: {e}")
        return None

async def send_social_posts(ctx, theme="auto", include_images=True):
    """Envoie les posts générés dans le canal admin"""
    
    # Récupère les données marché pour contexte
    data = fetch_all_market_data()
    
    # Génère les posts
    posts = generate_social_posts(theme=theme, data=data)
    
    if not posts:
        return False
    
    # Parse les posts
    twitter_post = ""
    instagram_post = ""
    linkedin_post = ""
    
    if "===TWITTER===" in posts:
        parts = posts.split("===TWITTER===")
        if len(parts) > 1:
            twitter_section = parts[1].split("===INSTAGRAM===")[0] if "===INSTAGRAM===" in parts[1] else parts[1]
            twitter_post = twitter_section.strip()
    
    if "===INSTAGRAM===" in posts:
        parts = posts.split("===INSTAGRAM===")
        if len(parts) > 1:
            insta_section = parts[1].split("===LINKEDIN===")[0] if "===LINKEDIN===" in parts[1] else parts[1]
            instagram_post = insta_section.strip()
    
    if "===LINKEDIN===" in posts:
        parts = posts.split("===LINKEDIN===")
        if len(parts) > 1:
            linkedin_post = parts[1].strip()
    
    # Génère les prompts d'images si demandé
    twitter_img_prompt = ""
    instagram_img_prompt = ""
    linkedin_img_prompt = ""
    
    if include_images:
        image_prompts = generate_image_prompts(theme=theme, data=data)
        
        if image_prompts:
            if "===PROMPT_TWITTER===" in image_prompts:
                parts = image_prompts.split("===PROMPT_TWITTER===")
                if len(parts) > 1:
                    twitter_img_prompt = parts[1].split("===PROMPT_INSTAGRAM===")[0].strip() if "===PROMPT_INSTAGRAM===" in parts[1] else parts[1].strip()
            
            if "===PROMPT_INSTAGRAM===" in image_prompts:
                parts = image_prompts.split("===PROMPT_INSTAGRAM===")
                if len(parts) > 1:
                    instagram_img_prompt = parts[1].split("===PROMPT_LINKEDIN===")[0].strip() if "===PROMPT_LINKEDIN===" in parts[1] else parts[1].strip()
            
            if "===PROMPT_LINKEDIN===" in image_prompts:
                parts = image_prompts.split("===PROMPT_LINKEDIN===")
                if len(parts) > 1:
                    linkedin_img_prompt = parts[1].strip()
    
    # Header
    await ctx.send("📱 **POSTS RÉSEAUX SOCIAUX GÉNÉRÉS**\n*Copie-colle directement sur tes réseaux !*\n" + "─" * 40)
    
    # ========== TWITTER ==========
    embed_twitter = discord.Embed(
        title="🐦 POST TWITTER/X",
        description=f"```{twitter_post[:1900]}```" if twitter_post else "❌ Erreur génération",
        color=0x1DA1F2
    )
    embed_twitter.add_field(name="📋 Action", value="Copie ce texte → Colle sur Twitter", inline=False)
    embed_twitter.set_footer(text=f"Caractères: {len(twitter_post)}/280")
    await ctx.send(embed=embed_twitter)
    
    if twitter_img_prompt:
        embed_twitter_img = discord.Embed(
            title="🎨 PROMPT IMAGE TWITTER",
            description=f"```{twitter_img_prompt[:1900]}```",
            color=0x1DA1F2
        )
        embed_twitter_img.add_field(name="🖼️ Format", value="**1:1 (carré)** ou **16:9**", inline=True)
        embed_twitter_img.add_field(name="📋 Usage", value="Copie → Midjourney/Leonardo/DALL-E", inline=True)
        await ctx.send(embed=embed_twitter_img)
    
    await asyncio.sleep(1)
    
    # ========== INSTAGRAM ==========
    embed_insta = discord.Embed(
        title="📸 POST INSTAGRAM",
        description=f"```{instagram_post[:1900]}```" if instagram_post else "❌ Erreur génération",
        color=0xE1306C
    )
    embed_insta.add_field(name="📋 Action", value="Copie ce texte → Colle en caption Instagram", inline=False)
    await ctx.send(embed=embed_insta)
    
    if instagram_img_prompt:
        embed_insta_img = discord.Embed(
            title="🎨 PROMPT IMAGE INSTAGRAM",
            description=f"```{instagram_img_prompt[:1900]}```",
            color=0xE1306C
        )
        embed_insta_img.add_field(name="🖼️ Format", value="**4:5 (portrait)** ou **1:1 (carré)**", inline=True)
        embed_insta_img.add_field(name="📋 Usage", value="Copie → Midjourney/Leonardo/DALL-E", inline=True)
        await ctx.send(embed=embed_insta_img)
    
    await asyncio.sleep(1)
    
    # ========== LINKEDIN ==========
    embed_linkedin = discord.Embed(
        title="💼 POST LINKEDIN",
        description=f"```{linkedin_post[:1900]}```" if linkedin_post else "❌ Erreur génération",
        color=0x0A66C2
    )
    embed_linkedin.add_field(name="📋 Action", value="Copie ce texte → Colle sur LinkedIn", inline=False)
    await ctx.send(embed=embed_linkedin)
    
    if linkedin_img_prompt:
        embed_linkedin_img = discord.Embed(
            title="🎨 PROMPT IMAGE LINKEDIN",
            description=f"```{linkedin_img_prompt[:1900]}```",
            color=0x0A66C2
        )
        embed_linkedin_img.add_field(name="🖼️ Format", value="**1200x627 (paysage)** → --ar 16:9", inline=True)
        embed_linkedin_img.add_field(name="📋 Usage", value="Copie → Midjourney/Leonardo/DALL-E", inline=True)
        await ctx.send(embed=embed_linkedin_img)
    
    # ========== RÉSUMÉ ==========
    summary = discord.Embed(
        title="✅ POSTS & PROMPTS IMAGES PRÊTS !",
        description=f"**Thème:** {theme}\n**Lien inclus:** {EBOOK_CONFIG['link']}",
        color=0x2ecc71
    )
    summary.add_field(
        name="📊 Marché actuel", 
        value=f"BTC ${data['prices']['btc_price']:,.0f} | F&G {data['fear_greed']['value']}" if data else "Non disponible", 
        inline=False
    )
    
    tools_text = """🆓 **Gratuits:**
• [Leonardo AI](https://leonardo.ai) - Haute qualité
• [Bing Create](https://www.bing.com/create) - DALL-E 3
• [Ideogram](https://ideogram.ai) - Bon pour texte

💎 **Premium:**
• [Midjourney](https://midjourney.com) - Le meilleur
• [DALL-E 3](https://openai.com/dall-e-3) - ChatGPT+"""
    summary.add_field(name="🎨 Générateurs d'images", value=tools_text, inline=False)
    
    summary.add_field(
        name="⏰ Heures de pointe", 
        value="• Twitter: 12h-14h, 18h-20h\n• Instagram: 11h-13h, 19h-21h\n• LinkedIn: 8h-10h, 17h-18h", 
        inline=False
    )
    await ctx.send(embed=summary)
    
    return True

# ============================================================
#                    HELPER FUNCTIONS
# ============================================================
async def send_to_channel(channel_name, embed):
    channel_id = CHANNELS.get(channel_name, 0)
    if channel_id == 0:
        return False
    channel = bot.get_channel(channel_id)
    if not channel:
        return False
    try:
        await channel.send(embed=embed)
        print(f"[SEND] ✅ #{channel_name}")
        return True
    except Exception as e:
        print(f"[SEND] ❌ {channel_name}: {e}")
        return False

def format_number(num):
    """Formate les grands nombres"""
    if num >= 1e12:
        return f"${num/1e12:.2f}T"
    elif num >= 1e9:
        return f"${num/1e9:.2f}B"
    elif num >= 1e6:
        return f"${num/1e6:.2f}M"
    else:
        return f"${num:,.0f}"

def get_movers_details(movers, limit=8):
    """Prépare les détails des movers avec vrais prix"""
    sorted_movers = sorted(movers, key=lambda x: abs(x.get("price_change_percentage_24h", 0) or 0), reverse=True)[:limit]
    details = []
    for c in sorted_movers:
        price = c.get('current_price', 0)
        change = c.get('price_change_percentage_24h', 0) or 0
        mcap = c.get('market_cap', 0)
        details.append({
            "symbol": c['symbol'].upper(),
            "name": c.get('name', ''),
            "price": price,
            "change_24h": change,
            "mcap": mcap,
            "chart_link": get_tradingview_link(c['symbol'])
        })
    return details

# ============================================================
#                    MESSAGES SOLO (SIMPLES)
# ============================================================
async def send_solo_prix(data):
    prices = data['prices']
    btc_emoji = "🟢" if prices['btc_change'] > 0 else "🔴"
    eth_emoji = "🟢" if prices['eth_change'] > 0 else "🔴"
    
    embed = discord.Embed(title="📈 PRIX CRYPTO", color=0xf7931a, timestamp=datetime.now(TIMEZONE))
    embed.add_field(name=f"{btc_emoji} BITCOIN", value=f"**${prices['btc_price']:,.2f}**\n24h: {prices['btc_change']:+.2f}%", inline=True)
    embed.add_field(name=f"{eth_emoji} ETHEREUM", value=f"**${prices['eth_price']:,.2f}**\n24h: {prices['eth_change']:+.2f}%", inline=True)
    embed.add_field(name="📊 Charts", value=f"[BTC]({get_tradingview_link('BTC')}) | [ETH]({get_tradingview_link('ETH')})", inline=False)
    embed.set_footer(text="SOLO • CoinGecko")
    await send_to_channel("solo_prix", embed)

async def send_solo_fear_greed(data):
    fg = data['fear_greed']
    value = fg['value']
    
    if value < 25: emoji, color, zone = "🔴", 0xff0000, "PEUR EXTRÊME"
    elif value < 45: emoji, color, zone = "🟠", 0xff8c00, "PEUR"
    elif value < 55: emoji, color, zone = "🟡", 0xffff00, "NEUTRE"
    elif value < 75: emoji, color, zone = "🟢", 0x00ff00, "AVIDITÉ"
    else: emoji, color, zone = "💚", 0x00ff00, "AVIDITÉ EXTRÊME"
    
    history_str = " → ".join([str(h) for h in reversed(fg['history'])] + [f"**{value}**"])
    
    embed = discord.Embed(title=f"{emoji} FEAR & GREED INDEX", color=color, timestamp=datetime.now(TIMEZONE))
    embed.add_field(name="Indice", value=f"**{value}/100** - {zone}", inline=False)
    embed.add_field(name="📊 7 jours", value=history_str, inline=False)
    embed.set_footer(text="SOLO • Alternative.me")
    await send_to_channel("solo_fg", embed)

async def send_solo_alertes(data):
    movers = get_movers_details(data.get('movers', []), 5)
    if not movers:
        return
    
    embed = discord.Embed(title="🚀 TOP MOVERS 24H", color=0x9b59b6, timestamp=datetime.now(TIMEZONE))
    for i, coin in enumerate(movers, 1):
        emoji = "🟢" if coin['change_24h'] > 0 else "🔴"
        embed.add_field(
            name=f"{emoji} #{i} {coin['symbol']}", 
            value=f"${coin['price']:,.4f}\n{coin['change_24h']:+.2f}%\n[Chart]({coin['chart_link']})", 
            inline=True
        )
    embed.set_footer(text="SOLO • CoinGecko")
    await send_to_channel("solo_alertes", embed)

# ============================================================
#                    MESSAGES VIP (AVEC GROK)
# ============================================================
async def send_vip_fear_greed(data):
    fg = data['fear_greed']
    coinglass = data.get('coinglass', {})
    
    # Données CoinGlass pour enrichir l'analyse
    liq_text = ""
    if coinglass and coinglass.get('liquidations_24h'):
        liq_24h = coinglass['liquidations_24h']
        long_liq = coinglass.get('long_liquidations', 0)
        short_liq = coinglass.get('short_liquidations', 0)
        liq_text = f"\nLiquidations 24h: ${liq_24h/1e6:.0f}M (Longs: ${long_liq/1e6:.0f}M, Shorts: ${short_liq/1e6:.0f}M)"
    
    prompt = f"""F&G: {fg['value']}/100 ({fg['sentiment']})
Historique 7j: {fg['history']}{liq_text}

Analyse en 4 lignes: signification, tendance, comportement smart money, point d'attention."""
    
    analysis = ask_grok(prompt, 500)
    
    if fg['value'] < 25: emoji, color = "🔴", 0xff0000
    elif fg['value'] < 45: emoji, color = "🟠", 0xff8c00
    elif fg['value'] < 55: emoji, color = "🟡", 0xffff00
    else: emoji, color = "🟢", 0x00ff00
    
    embed = discord.Embed(title="📊 ANALYSE FEAR & GREED", color=color, timestamp=datetime.now(TIMEZONE))
    embed.add_field(name=f"{emoji} Indice", value=f"**{fg['value']}/100** - {fg['sentiment']}", inline=False)
    
    # 🆕 Ajouter données CoinGlass
    if coinglass and coinglass.get('liquidations_24h'):
        embed.add_field(
            name="💥 Liquidations 24h",
            value=f"Total: **{format_number(coinglass['liquidations_24h'])}**\n🟢 Longs: {format_number(coinglass.get('long_liquidations', 0))} | 🔴 Shorts: {format_number(coinglass.get('short_liquidations', 0))}",
            inline=False
        )
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1024], inline=False)
    
    embed.set_footer(text="🔒 VIP • NFA-DYOR")
    await send_to_channel("fg", embed)

async def send_vip_setup(data):
    prices = data['prices']
    global_data = data['global']
    coinglass = data.get('coinglass', {})
    movers = get_movers_details(data.get('movers', []), 5)
    
    # Préparer les vrais prix
    movers_text = "\n".join([f"• {m['symbol']}: ${m['price']:,.4f} ({m['change_24h']:+.1f}%)" for m in movers[:5]])
    
    funding_text = ""
    if coinglass:
        btc_funding = coinglass.get('funding_btc')
        eth_funding = coinglass.get('funding_eth')
        if btc_funding:
            funding_text = f"\nFunding BTC: {float(btc_funding)*100:.4f}%"
        if eth_funding:
            funding_text += f" | ETH: {float(eth_funding)*100:.4f}%"
    
    prompt = f"""DONNÉES RÉELLES:
BTC: ${prices['btc_price']:,.2f} ({prices['btc_change']:+.2f}%)
ETH: ${prices['eth_price']:,.2f} ({prices['eth_change']:+.2f}%)
BTC.D: {global_data['btc_dominance']:.1f}%
Market Cap 24h: {global_data['market_cap_change_24h']:+.2f}%{funding_text}

TOP MOVERS:
{movers_text}

Setup technique concis: contexte, BTC S/R, ETH S/R, biais."""
    
    analysis = ask_grok(prompt, 600)
    
    embed = discord.Embed(title="🎯 SETUP DU JOUR", color=0xf7931a, timestamp=datetime.now(TIMEZONE))
    
    btc_emoji = "🟢" if prices['btc_change'] > 0 else "🔴"
    eth_emoji = "🟢" if prices['eth_change'] > 0 else "🔴"
    
    embed.add_field(name=f"{btc_emoji} BTC", value=f"${prices['btc_price']:,.0f}\n{prices['btc_change']:+.2f}%", inline=True)
    embed.add_field(name=f"{eth_emoji} ETH", value=f"${prices['eth_price']:,.0f}\n{prices['eth_change']:+.2f}%", inline=True)
    embed.add_field(name="BTC.D", value=f"{global_data['btc_dominance']:.1f}%", inline=True)
    
    # 🆕 Funding rates
    if coinglass and coinglass.get('funding_btc'):
        embed.add_field(
            name="📈 Funding Rates",
            value=f"BTC: `{float(coinglass.get('funding_btc', 0))*100:.4f}%` | ETH: `{float(coinglass.get('funding_eth', 0))*100:.4f}%`",
            inline=False
        )
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1024], inline=False)
    
    # 🆕 Liens TradingView
    embed.add_field(name="📊 Charts", value=f"[BTC]({get_tradingview_link('BTC')}) | [ETH]({get_tradingview_link('ETH')}) | [SOL]({get_tradingview_link('SOL')})", inline=False)
    
    embed.set_footer(text="🔒 VIP • NFA-DYOR")
    await send_to_channel("setup", embed)

async def send_vip_marche(data):
    global_data = data['global']
    prices = data['prices']
    coinglass = data.get('coinglass', {})
    movers = get_movers_details(data.get('movers', []), 6)
    
    movers_text = "\n".join([f"• {m['symbol']}: ${m['price']:,.4f} ({m['change_24h']:+.1f}%, MCap: {format_number(m['mcap'])})" for m in movers])
    
    liq_text = ""
    if coinglass and coinglass.get('liquidations_24h'):
        liq_text = f"\nLiquidations 24h: ${coinglass['liquidations_24h']/1e6:.0f}M"
    
    prompt = f"""MARCHÉ CRYPTO - DONNÉES RÉELLES:
Market Cap: {format_number(global_data['total_market_cap'])} ({global_data['market_cap_change_24h']:+.2f}% 24h)
BTC.D: {global_data['btc_dominance']:.1f}% | ETH.D: {global_data['eth_dominance']:.1f}%{liq_text}

TOP MOVERS:
{movers_text}

Analyse: état du marché, flux capitaux, opportunités, risques."""
    
    analysis = ask_grok(prompt, 600)
    
    market_emoji = "🟢" if global_data['market_cap_change_24h'] > 0 else "🔴"
    
    embed = discord.Embed(title="🌍 ANALYSE MARCHÉ", color=0x3498db, timestamp=datetime.now(TIMEZONE))
    embed.add_field(name=f"{market_emoji} Market Cap", value=f"{format_number(global_data['total_market_cap'])}\n{global_data['market_cap_change_24h']:+.2f}% 24h", inline=True)
    embed.add_field(name="BTC.D", value=f"{global_data['btc_dominance']:.1f}%", inline=True)
    embed.add_field(name="ETH.D", value=f"{global_data['eth_dominance']:.1f}%", inline=True)
    
    # 🆕 Liquidations
    if coinglass and coinglass.get('liquidations_24h'):
        embed.add_field(name="💥 Liquidations 24h", value=format_number(coinglass['liquidations_24h']), inline=True)
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1024], inline=False)
    
    embed.set_footer(text="🔒 VIP • NFA-DYOR")
    await send_to_channel("marche", embed)

async def send_vip_watchlist(data):
    movers = get_movers_details(data.get('movers', []), 8)
    trending = data.get('trending', [])
    lunarcrush = data.get('lunarcrush', [])
    
    # Préparer les vrais prix
    movers_text = "\n".join([f"• {m['symbol']}: ${m['price']:,.6f} ({m['change_24h']:+.1f}%, MCap: {format_number(m['mcap'])})" for m in movers])
    trending_text = ", ".join([t['item']['symbol'].upper() for t in trending[:5]]) if trending else "N/A"
    
    # 🆕 Ajouter données sociales LunarCrush
    social_text = ""
    if lunarcrush:
        top_social = sorted(lunarcrush, key=lambda x: x.get('galaxy_score', 0), reverse=True)[:5]
        social_text = "\n\nTOP SOCIAL (LunarCrush):\n" + "\n".join([
            f"• {s['symbol']}: Galaxy Score {s['galaxy_score']:.0f}, Social Vol: {s['social_volume']:,}" 
            for s in top_social
        ])
    
    prompt = f"""DONNÉES RÉELLES (NE PAS INVENTER DE PRIX):
TOP MOVERS:
{movers_text}

TRENDING: {trending_text}{social_text}

Sélectionne 3 altcoins à SURVEILLER parmi cette liste avec:
- Prix RÉEL (copie depuis les données)
- Pourquoi surveiller
- Niveau de risque"""
    
    analysis = ask_grok(prompt, 700)
    
    embed = discord.Embed(title="👁️ WATCHLIST", color=0x9b59b6, timestamp=datetime.now(TIMEZONE))
    
    # Top movers avec vrais prix
    top3 = " | ".join([f"**{m['symbol']}** ${m['price']:,.4f}" for m in movers[:3]])
    embed.add_field(name="📊 Top Movers", value=top3, inline=False)
    
    # 🆕 Données sociales
    if lunarcrush:
        top_social = sorted(lunarcrush, key=lambda x: x.get('galaxy_score', 0), reverse=True)[:3]
        social_str = " | ".join([f"**{s['symbol']}** 🌟{s['galaxy_score']:.0f}" for s in top_social])
        embed.add_field(name="🐦 Top Social (LunarCrush)", value=social_str, inline=False)
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1024], inline=False)
    
    # 🆕 Liens TradingView
    chart_links = " | ".join([f"[{m['symbol']}]({m['chart_link']})" for m in movers[:5]])
    embed.add_field(name="📊 Charts", value=chart_links, inline=False)
    
    embed.add_field(name="⚠️ Avertissement", value="Watchlist ≠ Conseil d'achat. DYOR.", inline=False)
    embed.set_footer(text="🔒 VIP • NFA-DYOR")
    await send_to_channel("watchlist", embed)

async def send_vip_sentiment(data):
    fg = data['fear_greed']
    news = data.get('news', [])
    lunarcrush = data.get('lunarcrush', [])
    coinglass = data.get('coinglass', {})
    
    news_titles = " | ".join([n['title'][:40] for n in news[:3]])
    
    # 🆕 Données sociales
    social_text = ""
    if lunarcrush:
        top_social = sorted(lunarcrush, key=lambda x: x.get('social_volume', 0), reverse=True)[:5]
        social_text = "\n\nTOP MENTIONS SOCIALES:\n" + ", ".join([f"{s['symbol']} ({s['social_volume']:,} mentions)" for s in top_social])
    
    liq_text = ""
    if coinglass and coinglass.get('liquidations_24h'):
        long_pct = coinglass.get('long_liquidations', 0) / max(coinglass['liquidations_24h'], 1) * 100
        liq_text = f"\nLiquidations: Longs {long_pct:.0f}% vs Shorts {100-long_pct:.0f}%"
    
    prompt = f"""SENTIMENT MARCHÉ:
F&G: {fg['value']}/100 ({fg['sentiment']})
Headlines: {news_titles}{social_text}{liq_text}

Analyse: score sentiment /100, ton des news, signaux contrarian, conclusion."""
    
    analysis = ask_grok(prompt, 500)
    
    embed = discord.Embed(title="🎭 ANALYSE SENTIMENT", color=0xe74c3c, timestamp=datetime.now(TIMEZONE))
    embed.add_field(name="Fear & Greed", value=f"**{fg['value']}/100**", inline=True)
    embed.add_field(name="Sentiment", value=fg['sentiment'], inline=True)
    
    # 🆕 Top mentions sociales
    if lunarcrush:
        top3 = sorted(lunarcrush, key=lambda x: x.get('social_volume', 0), reverse=True)[:3]
        mentions_str = " | ".join([f"**{s['symbol']}** {s['social_volume']:,}" for s in top3])
        embed.add_field(name="🐦 Top Mentions", value=mentions_str, inline=False)
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1024], inline=False)
    
    embed.set_footer(text="🔒 VIP • NFA-DYOR")
    await send_to_channel("sentiment", embed)

# ============================================================
#     📰 ACTUS CRYPTO
# ============================================================
async def send_actus_crypto(data, max_news=3, force=False):
    global sent_news_ids, last_news_sent_time
    
    news = data.get('news', [])
    if not news:
        return 0
    
    channel_id = CHANNELS.get("actus_crypto", 0)
    if channel_id == 0:
        return 0
    channel = bot.get_channel(channel_id)
    if not channel:
        return 0
    
    if not force and last_news_sent_time:
        elapsed = (datetime.now(TIMEZONE) - last_news_sent_time).total_seconds() / 60
        if elapsed < NEWS_MIN_DELAY_MINUTES:
            print(f"[ACTUS] ⏳ Délai ({elapsed:.0f}min < {NEWS_MIN_DELAY_MINUTES}min)")
            return 0
    
    news_sent = 0
    for article in news:
        if news_sent >= max_news:
            break
        
        news_id = article.get("id", "")
        if news_id in sent_news_ids:
            continue
        
        title = article.get("title", "")[:200]
        url = article.get("url", "")
        source = article.get("source", "")
        
        summary = ask_grok_mini(f"News: {title}. Résumé français 2 lignes: fait, impact (🟢/🔴/🟡).")
        
        title_lower = title.lower()
        if any(w in title_lower for w in ["hack", "crash", "ban", "fraud"]):
            color, emoji = 0xff0000, "🚨"
        elif any(w in title_lower for w in ["etf", "approved", "bullish", "ath"]):
            color, emoji = 0x00ff00, "🚀"
        elif any(w in title_lower for w in ["sec", "regulation"]):
            color, emoji = 0xffa500, "⚖️"
        else:
            color, emoji = 0x3498db, "📰"
        
        embed = discord.Embed(title=f"{emoji} {title}", url=url, color=color, timestamp=datetime.now(TIMEZONE))
        if summary:
            embed.add_field(name="🧠 Résumé", value=summary[:500], inline=False)
        if url:
            embed.add_field(name="🔗 Article", value=f"[Lire →]({url})", inline=False)
        embed.set_footer(text=f"📡 {source}")
        
        try:
            await channel.send(embed=embed)
            sent_news_ids.add(news_id)
            news_sent += 1
            last_news_sent_time = datetime.now(TIMEZONE)
            print(f"[ACTUS] ✅ {title[:40]}...")
            if not force:
                break
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[ACTUS] Erreur: {e}")
    
    if len(sent_news_ids) > 150:
        sent_news_ids = set(list(sent_news_ids)[-100:])
    
    return news_sent

# ============================================================
#     💎 VIP OPPORTUNITIES
# ============================================================
async def send_vip_opportunities(data):
    prices = data['prices']
    global_data = data['global']
    fg = data['fear_greed']
    movers = get_movers_details(data.get('movers', []), 10)
    lunarcrush = data.get('lunarcrush', [])
    coinglass = data.get('coinglass', {})
    defi = data.get('defi', [])
    
    # Préparer les vrais prix
    movers_text = "\n".join([f"• {m['symbol']} ({m['name']}): ${m['price']:,.6f} | 24h: {m['change_24h']:+.1f}% | MCap: {format_number(m['mcap'])}" for m in movers[:8]])
    
    social_text = ""
    if lunarcrush:
        top_social = sorted(lunarcrush, key=lambda x: x.get('galaxy_score', 0), reverse=True)[:5]
        social_text = "\n\nTOP SOCIAL (LunarCrush):\n" + "\n".join([f"• {s['symbol']}: Galaxy {s['galaxy_score']:.0f}, Mentions: {s['social_volume']:,}" for s in top_social])
    
    liq_text = ""
    if coinglass and coinglass.get('liquidations_24h'):
        liq_text = f"\n\nLIQUIDATIONS 24h: ${coinglass['liquidations_24h']/1e6:.0f}M"
    
    defi_text = ""
    if defi:
        defi_text = "\n\nDEFI YIELDS:\n" + "\n".join([f"• {d['project']}: {d['apy']:.1f}% APY (TVL: ${d['tvlUsd']/1e6:.0f}M)" for d in defi[:3]])
    
    prompt = f"""📊 DONNÉES MARCHÉ RÉELLES - {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')}:

BTC: ${prices['btc_price']:,.2f} ({prices['btc_change']:+.2f}%)
ETH: ${prices['eth_price']:,.2f} ({prices['eth_change']:+.2f}%)
F&G: {fg['value']}/100 | BTC.D: {global_data['btc_dominance']:.1f}%

TOP MOVERS (PRIX RÉELS):
{movers_text}{social_text}{liq_text}{defi_text}

⚠️ UTILISE UNIQUEMENT LES PRIX CI-DESSUS, N'INVENTE RIEN.

Analyse concise:
- Contexte marché (2 lignes)
- 1-2 cryptos à surveiller avec PRIX RÉEL
- Score /10"""
    
    analysis = ask_grok(prompt, 700)
    
    if fg['value'] < 30:
        color, status = 0xff6600, "⚠️ PRUDENCE"
    elif fg['value'] > 70:
        color, status = 0x00ff00, "🚀 BULLISH"
    else:
        color, status = 0xf1c40f, "📊 NEUTRE"
    
    embed = discord.Embed(
        title=f"💎 OPPORTUNITÉS VIP - {status}",
        description=f"*Analyse de marché* • {datetime.now(TIMEZONE).strftime('%d/%m %H:%M')}",
        color=color,
        timestamp=datetime.now(TIMEZONE)
    )
    
    embed.add_field(
        name="📊 Marché",
        value=f"BTC `${prices['btc_price']:,.0f}` ({prices['btc_change']:+.1f}%) | ETH `${prices['eth_price']:,.0f}` | F&G `{fg['value']}`",
        inline=False
    )
    
    # 🆕 Liquidations CoinGlass
    if coinglass and coinglass.get('liquidations_24h'):
        embed.add_field(
            name="💥 Liquidations 24h",
            value=f"**{format_number(coinglass['liquidations_24h'])}** (L: {format_number(coinglass.get('long_liquidations', 0))} / S: {format_number(coinglass.get('short_liquidations', 0))})",
            inline=False
        )
    
    # 🆕 Top Social LunarCrush
    if lunarcrush:
        top3 = sorted(lunarcrush, key=lambda x: x.get('galaxy_score', 0), reverse=True)[:3]
        social_str = " | ".join([f"**{s['symbol']}** 🌟{s['galaxy_score']:.0f}" for s in top3])
        embed.add_field(name="🐦 Top Social", value=social_str, inline=False)
    
    if analysis:
        embed.add_field(name="🧠 Analyse Grok", value=analysis[:1020] if len(analysis) > 1024 else analysis, inline=False)
    
    # Top Movers avec vrais prix
    top3_movers = " | ".join([f"**{m['symbol']}** ${m['price']:,.4f} ({m['change_24h']:+.1f}%)" for m in movers[:3]])
    embed.add_field(name="🔥 Top Movers", value=top3_movers, inline=False)
    
    # 🆕 Liens TradingView
    charts = " | ".join([f"[{m['symbol']}]({m['chart_link']})" for m in movers[:5]])
    embed.add_field(name="📊 Charts", value=charts, inline=False)
    
    # Disclaimer AMF
    embed.add_field(
        name="⚠️ AVERTISSEMENT",
        value="Ce contenu est informatif uniquement, pas un conseil d'investissement. Les cryptos sont volatiles avec risque de perte. DYOR. NFA.",
        inline=False
    )
    
    embed.set_footer(text="🔒 VIP • Analyse ≠ Conseil • NFA-DYOR")
    await send_to_channel("opportunities", embed)

# ============================================================
#     🚨 ALERTES FLASH NEWS
# ============================================================
async def check_and_send_urgent_news(news_list):
    global sent_alert_ids
    
    channel_id = CHANNELS.get("flash_news", 0)
    if channel_id == 0:
        return
    channel = bot.get_channel(channel_id)
    if not channel:
        return
    
    for article in news_list[:10]:
        news_id = article.get("id", "")
        if news_id in sent_alert_ids:
            continue
        
        title = article.get("title", "")
        is_urgent = any(kw.lower() in title.lower() for kw in URGENT_KEYWORDS)
        if not is_urgent:
            continue
        
        url = article.get("url", "")
        source = article.get("source", "")
        
        analysis = ask_grok_mini(f"🚨 URGENT: {title}. Impact marché en 2 lignes.")
        
        title_lower = title.lower()
        if any(w in title_lower for w in ["hack", "exploit", "crash", "liquidat"]):
            color, alert_type = 0xff0000, "🚨 ALERTE ROUGE"
        elif any(w in title_lower for w in ["etf approved", "approval", "ath"]):
            color, alert_type = 0x00ff00, "🟢 BREAKING BULLISH"
        elif any(w in title_lower for w in ["sec", "regulation", "lawsuit"]):
            color, alert_type = 0xffa500, "⚖️ ALERTE RÉGULATION"
        else:
            color, alert_type = 0xffff00, "⚡ FLASH INFO"
        
        embed = discord.Embed(title=alert_type, description=f"**{title}**", url=url, color=color, timestamp=datetime.now(TIMEZONE))
        if analysis:
            embed.add_field(name="🧠 Impact", value=analysis, inline=False)
        if url:
            embed.add_field(name="🔗 Source", value=f"[{source} →]({url})", inline=False)
        embed.set_footer(text="⚡ ALERTE TEMPS RÉEL")
        
        try:
            if color == 0xff0000:
                await channel.send(content="||@here|| 🚨", embed=embed)
            else:
                await channel.send(embed=embed)
            sent_alert_ids.add(news_id)
            print(f"[FLASH] 🚨 {title[:50]}...")
        except Exception as e:
            print(f"[FLASH] Erreur: {e}")
    
    if len(sent_alert_ids) > 100:
        sent_alert_ids = set(list(sent_alert_ids)[-50:])

async def check_and_send_price_alerts(prices, global_data, fg):
    global last_btc_price, last_eth_price, last_fear_greed, last_btc_dominance
    
    channel_id = CHANNELS.get("flash_news", 0)
    if channel_id == 0:
        return
    channel = bot.get_channel(channel_id)
    if not channel:
        return
    
    alerts = []
    
    # Pas d'alerte au premier check
    if last_fear_greed is not None:
        fg_change = fg['value'] - last_fear_greed
        if abs(fg_change) >= ALERT_THRESHOLDS['fear_greed_change']:
            direction = "↗️ HAUSSE" if fg_change > 0 else "↘️ BAISSE"
            alerts.append({
                "type": f"🎭 SENTIMENT {direction}",
                "message": f"F&G: **{last_fear_greed}** → **{fg['value']}** ({fg_change:+d})\n{fg['sentiment']}",
                "color": 0x00ff00 if fg_change > 0 else 0xff6600
            })
    
    if last_btc_dominance is not None:
        dom_change = global_data['btc_dominance'] - last_btc_dominance
        if abs(dom_change) >= ALERT_THRESHOLDS['dominance_change']:
            direction = "↗️" if dom_change > 0 else "↘️"
            alerts.append({
                "type": f"📊 BTC.D {direction}",
                "message": f"**{last_btc_dominance:.1f}%** → **{global_data['btc_dominance']:.1f}%**\n{'Flux BTC' if dom_change > 0 else 'Alt Season?'}",
                "color": 0xf7931a
            })
    
    last_btc_price = prices['btc_price']
    last_eth_price = prices['eth_price']
    last_fear_greed = fg['value']
    last_btc_dominance = global_data['btc_dominance']
    
    for alert in alerts:
        embed = discord.Embed(title=alert["type"], description=alert["message"], color=alert["color"], timestamp=datetime.now(TIMEZONE))
        embed.set_footer(text="⚡ ALERTE")
        try:
            await channel.send(embed=embed)
            print(f"[ALERT] {alert['type']}")
        except:
            pass

# ============================================================
#     🔄 TÂCHES TEMPS RÉEL
# ============================================================
@tasks.loop(minutes=45)
async def realtime_news_check():
    print(f"[REALTIME] 📰 News - {datetime.now(TIMEZONE).strftime('%H:%M')}")
    try:
        news = get_crypto_news_with_links()
        if news:
            await check_and_send_urgent_news(news)
            sent = await send_actus_crypto({"news": news}, max_news=1, force=False)
            if sent > 0:
                print(f"[REALTIME] ✅ {sent} news")
    except Exception as e:
        print(f"[REALTIME] Erreur: {e}")

@tasks.loop(minutes=15)
async def realtime_price_check():
    print(f"[REALTIME] 💰 Prix - {datetime.now(TIMEZONE).strftime('%H:%M')}")
    try:
        prices = get_btc_price()
        global_data = get_global_data()
        fg = get_fear_greed()
        if prices and global_data and fg:
            await check_and_send_price_alerts(prices, global_data, fg)
    except Exception as e:
        print(f"[REALTIME] Erreur: {e}")

@tasks.loop(hours=2)
async def realtime_opportunities_check():
    print(f"[REALTIME] 💎 Opportunities - {datetime.now(TIMEZONE).strftime('%H:%M')}")
    try:
        data = fetch_all_market_data()
        if data:
            fg_value = data['fear_greed']['value']
            market_change = data['global']['market_cap_change_24h']
            if fg_value < 25 or fg_value > 75 or abs(market_change) > 5:
                print("[REALTIME] 💎 Conditions spéciales!")
                await send_vip_opportunities(data)
    except Exception as e:
        print(f"[REALTIME] Erreur: {e}")

@realtime_news_check.before_loop
@realtime_price_check.before_loop
@realtime_opportunities_check.before_loop
async def before_realtime():
    await bot.wait_until_ready()

# ============================================================
#     🔄 MISE À JOUR GLOBALE
# ============================================================
async def run_global_update(source="scheduled", force_fg=False):
    print(f"\n{'='*60}")
    print(f"🔄 MISE À JOUR - {source}")
    print(f"⏰ {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*60}")
    
    data = fetch_all_market_data()
    if not data:
        print("❌ Échec données")
        return False
    
    # Vérifie si c'est le matin (8h) pour envoyer Fear & Greed
    current_hour = datetime.now(TIMEZONE).hour
    is_morning = (current_hour == 8) or force_fg or ("startup" in source) or ("manual" in source)
    
    print("\n[PHASE 1] SOLO...")
    # Solo Prix et Alertes toujours, F&G seulement le matin
    solo_funcs = [send_solo_prix, send_solo_alertes]
    if is_morning:
        solo_funcs.insert(1, send_solo_fear_greed)  # Ajoute F&G si matin
        print("   📊 Fear & Greed SOLO: ✅ (matin)")
    else:
        print("   📊 Fear & Greed SOLO: ⏭️ (pas le matin)")
    
    for func in solo_funcs:
        try:
            await func(data)
            await asyncio.sleep(2)
        except Exception as e:
            print(f"Erreur: {e}")
    
    print("\n[PHASE 2] VIP...")
    # VIP: F&G seulement le matin, le reste toujours
    vip_funcs = [send_vip_setup, send_vip_marche, send_vip_watchlist, send_vip_sentiment]
    if is_morning:
        vip_funcs.insert(0, send_vip_fear_greed)  # Ajoute F&G VIP si matin
        print("   📊 Fear & Greed VIP: ✅ (matin)")
    else:
        print("   📊 Fear & Greed VIP: ⏭️ (pas le matin)")
    
    for func in vip_funcs:
        try:
            await func(data)
            await asyncio.sleep(4)
        except Exception as e:
            print(f"Erreur: {e}")
    
    print("\n[PHASE 3] ACTUS...")
    try:
        await send_actus_crypto(data, max_news=3, force=True)
    except Exception as e:
        print(f"Erreur: {e}")
    
    print("\n[PHASE 4] OPPORTUNITIES...")
    try:
        await send_vip_opportunities(data)
    except Exception as e:
        print(f"Erreur: {e}")
    
    print(f"\n{'='*60}")
    print("✅ TERMINÉ")
    print(f"{'='*60}\n")
    return True

# ============================================================
#     ⏰ TÂCHES PLANIFIÉES
# ============================================================
@tasks.loop(time=[
    time(hour=8, minute=0, tzinfo=TIMEZONE),
    time(hour=12, minute=0, tzinfo=TIMEZONE),
    time(hour=18, minute=0, tzinfo=TIMEZONE)
])
async def scheduled_update():
    await run_global_update(source=f"scheduled_{datetime.now(TIMEZONE).strftime('%H:%M')}")

@scheduled_update.before_loop
async def before_scheduled():
    await bot.wait_until_ready()

# ============================================================
#     🎮 COMMANDES
# ============================================================
@bot.command(name="testall")
async def cmd_testall(ctx):
    if not ctx.author.guild_permissions.administrator:
        return
    msg = await ctx.send("🔄 **Mise à jour...**")
    success = await run_global_update(source="manual")
    await msg.edit(content="✅ **Terminé!**" if success else "❌ **Erreur**")

@bot.command(name="flash")
async def cmd_flash(ctx):
    if not ctx.author.guild_permissions.administrator:
        return
    msg = await ctx.send("⚡ **Flash...**")
    data = fetch_all_market_data()
    if not data:
        await msg.edit(content="❌ Erreur")
        return
    prices = data['prices']
    fg = data['fear_greed']
    analysis = ask_grok_mini(f"BTC ${prices['btc_price']:,.0f}, F&G {fg['value']}. Situation 2 lignes.")
    embed = discord.Embed(title="⚡ FLASH", description=analysis, color=0xf1c40f)
    embed.add_field(name="BTC", value=f"${prices['btc_price']:,.0f}", inline=True)
    embed.add_field(name="F&G", value=f"{fg['value']}", inline=True)
    embed.add_field(name="📊 Chart", value=f"[TradingView]({get_tradingview_link('BTC')})", inline=True)
    await msg.edit(content=None, embed=embed)

@bot.command(name="opport")
async def cmd_opport(ctx):
    if not ctx.author.guild_permissions.administrator:
        return
    msg = await ctx.send("💎 **Opportunités...**")
    data = fetch_all_market_data()
    if data:
        await send_vip_opportunities(data)
        await msg.edit(content="✅ **Envoyé!**")
    else:
        await msg.edit(content="❌ **Erreur**")

@bot.command(name="news")
async def cmd_news(ctx):
    if not ctx.author.guild_permissions.administrator:
        return
    msg = await ctx.send("📰 **News...**")
    data = fetch_all_market_data()
    if data:
        sent = await send_actus_crypto(data, max_news=3, force=True)
        await msg.edit(content=f"✅ **{sent} news!**")
    else:
        await msg.edit(content="❌ **Erreur**")

@bot.command(name="status")
async def cmd_status(ctx):
    if not ctx.author.guild_permissions.administrator:
        return
    embed = discord.Embed(title="🤖 Status Horizon Elite V4", color=0x3498db)
    embed.add_field(name="Grok", value="✅" if client_xai else "❌", inline=True)
    embed.add_field(name="LunarCrush", value="✅" if LUNARCRUSH_API_KEY else "❌", inline=True)
    embed.add_field(name="Social Posts", value="✅" if client_xai else "❌", inline=True)
    embed.add_field(name="Scheduled", value="✅" if scheduled_update.is_running() else "❌", inline=True)
    embed.add_field(name="News", value="✅" if realtime_news_check.is_running() else "❌", inline=True)
    embed.add_field(name="Prix", value="✅" if realtime_price_check.is_running() else "❌", inline=True)
    embed.add_field(name="Opport", value="✅" if realtime_opportunities_check.is_running() else "❌", inline=True)
    embed.add_field(name="Ebook Link", value="✅" if EBOOK_CONFIG['link'] != "https://ton-lien-ebook.com" else "⚠️ Non configuré", inline=True)
    embed.add_field(name="Heure", value=datetime.now(TIMEZONE).strftime("%H:%M"), inline=True)
    await ctx.send(embed=embed)

@bot.command(name="prix")
async def cmd_prix(ctx):
    prices = get_btc_price()
    if not prices:
        await ctx.send("❌ Erreur")
        return
    embed = discord.Embed(title="💰 Prix", color=0xf7931a)
    embed.add_field(name="BTC", value=f"${prices['btc_price']:,.0f}\n{prices['btc_change']:+.2f}%", inline=True)
    embed.add_field(name="ETH", value=f"${prices['eth_price']:,.0f}\n{prices['eth_change']:+.2f}%", inline=True)
    embed.add_field(name="📊 Charts", value=f"[BTC]({get_tradingview_link('BTC')}) | [ETH]({get_tradingview_link('ETH')})", inline=False)
    await ctx.send(embed=embed)

# ============================================================
#     🆕 COMMANDES POSTS RÉSEAUX SOCIAUX
# ============================================================
@bot.command(name="post")
async def cmd_post(ctx):
    """Génère des posts pour réseaux sociaux (thème auto basé sur le marché)"""
    if not ctx.author.guild_permissions.administrator:
        return
    
    msg = await ctx.send("📱 **Génération des posts en cours...**\n_Analyse du marché + création storytelling..._")
    
    try:
        success = await send_social_posts(ctx, theme="auto")
        if success:
            await msg.edit(content="✅ **Posts générés avec succès !**")
        else:
            await msg.edit(content="❌ **Erreur lors de la génération**")
    except Exception as e:
        print(f"[POST] Erreur: {e}")
        await msg.edit(content=f"❌ **Erreur:** {str(e)[:100]}")

@bot.command(name="posttheme")
async def cmd_posttheme(ctx, theme: str = None):
    """Génère des posts avec un thème spécifique
    
    Thèmes disponibles:
    - education : Apprendre la crypto
    - opportunity : Opportunités de marché
    - motivation : Mindset & motivation
    - fear : Vaincre la peur du marché
    - success : Succès & témoignages
    - market : Analyse marché actuel
    - community : Communauté Horizon
    - beginner : Pour les débutants
    """
    if not ctx.author.guild_permissions.administrator:
        return
    
    valid_themes = ["education", "opportunity", "motivation", "fear", "success", "market", "community", "beginner"]
    
    if not theme:
        # Affiche les thèmes disponibles
        embed = discord.Embed(
            title="📱 THÈMES DISPONIBLES",
            description="Utilise `!posttheme [theme]` avec un des thèmes suivants:",
            color=0x9b59b6
        )
        themes_text = """
🎓 **education** - Apprendre la crypto simplement
💎 **opportunity** - Opportunités de marché actuelles
🔥 **motivation** - Mindset & motivation
😰 **fear** - Vaincre la peur du marché
🏆 **success** - Succès & témoignages
📊 **market** - Analyse marché actuel
👥 **community** - Rejoindre la communauté Horizon
🌱 **beginner** - Spécial débutants
"""
        embed.add_field(name="Thèmes", value=themes_text, inline=False)
        embed.add_field(name="Exemple", value="`!posttheme motivation`", inline=False)
        await ctx.send(embed=embed)
        return
    
    theme = theme.lower()
    if theme not in valid_themes:
        await ctx.send(f"❌ Thème invalide. Thèmes disponibles: {', '.join(valid_themes)}")
        return
    
    msg = await ctx.send(f"📱 **Génération posts thème: {theme}...**")
    
    try:
        success = await send_social_posts(ctx, theme=theme)
        if success:
            await msg.edit(content=f"✅ **Posts '{theme}' générés !**")
        else:
            await msg.edit(content="❌ **Erreur génération**")
    except Exception as e:
        print(f"[POST] Erreur: {e}")
        await msg.edit(content=f"❌ **Erreur:** {str(e)[:100]}")

@bot.command(name="posthelp")
async def cmd_posthelp(ctx):
    """Affiche l'aide pour les commandes de posts"""
    if not ctx.author.guild_permissions.administrator:
        return
    
    embed = discord.Embed(
        title="📱 AIDE - POSTS RÉSEAUX SOCIAUX",
        description="Génère automatiquement des posts pour tes réseaux sociaux !",
        color=0x3498db
    )
    
    embed.add_field(
        name="🚀 Commandes",
        value="""
`!post` - Génère 3 posts + 3 prompts images (Twitter, Instagram, LinkedIn)
`!postnoimg` - Génère 3 posts SANS prompts images
`!posttheme [theme]` - Génère avec un thème spécifique + images
`!posthelp` - Affiche cette aide
""",
        inline=False
    )
    
    embed.add_field(
        name="🎨 Thèmes disponibles",
        value="""
• `education` - Apprendre la crypto
• `opportunity` - Opportunités marché
• `motivation` - Mindset & motivation
• `fear` - Vaincre la peur
• `success` - Témoignages
• `market` - Analyse actuelle
• `community` - Communauté Horizon
• `beginner` - Débutants
""",
        inline=False
    )
    
    embed.add_field(
        name="📋 Comment utiliser",
        value=f"""
1. Tape `!post` ou `!posttheme motivation`
2. Le bot génère 3 posts optimisés + 3 prompts images
3. **Copie** le texte (dans les blocs ```)
4. **Colle** sur ton réseau social
5. **Copie** le prompt image → Colle dans Midjourney/Leonardo/DALL-E
6. Publie avec l'image générée !

**Lien configuré:** {EBOOK_CONFIG['link']}
""",
        inline=False
    )
    
    embed.add_field(
        name="🎨 Générateurs d'images",
        value="""
**Gratuits:** Leonardo AI, Bing Create, Ideogram
**Premium:** Midjourney, DALL-E 3
""",
        inline=False
    )
    
    embed.add_field(
        name="⚙️ Configuration Render",
        value="""
• `EBOOK_LINK` - Lien vers ton ebook/produit
• `EBOOK_PRICE` - Prix (optionnel)
""",
        inline=False
    )
    
    embed.set_footer(text="💡 Les posts et images sont adaptés au contexte marché actuel !")
    await ctx.send(embed=embed)

@bot.command(name="postnoimg")
async def cmd_postnoimg(ctx):
    """Génère des posts SANS prompts d'images"""
    if not ctx.author.guild_permissions.administrator:
        return
    
    msg = await ctx.send("📱 **Génération des posts (sans images)...**")
    
    try:
        success = await send_social_posts(ctx, theme="auto", include_images=False)
        if success:
            await msg.edit(content="✅ **Posts générés (sans images) !**")
        else:
            await msg.edit(content="❌ **Erreur lors de la génération**")
    except Exception as e:
        print(f"[POST] Erreur: {e}")
        await msg.edit(content=f"❌ **Erreur:** {str(e)[:100]}")
# ============================================================
#     🤖 COMMANDE !ASK - QUESTION À GROK (VIP ONLY)
#     Limite: 5 questions par jour par utilisateur
# ============================================================

# Cache pour les limites quotidiennes (reset à minuit)
ask_daily_limits = {}  # {user_id: {"count": X, "date": "YYYY-MM-DD"}}
ASK_DAILY_LIMIT = 5  # Nombre max de questions par jour

def get_gold_price():
    """Récupère le prix de l'or via API gratuite"""
    try:
        # API gratuite pour les métaux précieux
        r = requests.get(
            "https://api.metalpriceapi.com/v1/latest?api_key=demo&base=USD&currencies=XAU",
            timeout=10
        )
        if r.status_code == 200:
            data = r.json()
            # XAU = once d'or, le prix est inversé (USD par once)
            if data.get("success") and "rates" in data:
                xau_rate = data["rates"].get("XAU", 0)
                if xau_rate > 0:
                    gold_price = 1 / xau_rate  # Convertir en USD/once
                    return {"price": gold_price, "unit": "USD/oz"}
        
        # Alternative: API Gold API (backup)
        r2 = requests.get("https://www.goldapi.io/api/XAU/USD", 
                          headers={"x-access-token": "goldapi-demo"}, 
                          timeout=10)
        if r2.status_code == 200:
            data2 = r2.json()
            return {"price": data2.get("price", 0), "unit": "USD/oz"}
            
    except Exception as e:
        print(f"[GOLD] Erreur API: {e}")
    
    return None

def check_ask_limit(user_id):
    """Vérifie si l'utilisateur peut encore poser une question aujourd'hui"""
    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
    
    if user_id not in ask_daily_limits:
        ask_daily_limits[user_id] = {"count": 0, "date": today}
    
    user_data = ask_daily_limits[user_id]
    
    # Reset si nouveau jour
    if user_data["date"] != today:
        ask_daily_limits[user_id] = {"count": 0, "date": today}
        user_data = ask_daily_limits[user_id]
    
    remaining = ASK_DAILY_LIMIT - user_data["count"]
    return remaining > 0, remaining

def increment_ask_count(user_id):
    """Incrémente le compteur de questions pour un utilisateur"""
    today = datetime.now(TIMEZONE).strftime("%Y-%m-%d")
    
    if user_id not in ask_daily_limits:
        ask_daily_limits[user_id] = {"count": 0, "date": today}
    
    if ask_daily_limits[user_id]["date"] != today:
        ask_daily_limits[user_id] = {"count": 0, "date": today}
    
    ask_daily_limits[user_id]["count"] += 1
    return ASK_DAILY_LIMIT - ask_daily_limits[user_id]["count"]

@bot.command(name="ask")
async def cmd_ask(ctx, *, question: str = None):
    """Pose une question à Grok - VIP uniquement dans #vip-lounge (5 questions/jour)"""
    
    # Vérifier si c'est dans le bon canal (VIP Lounge)
    vip_lounge_id = CHANNELS.get("vip_lounge", 0)
    if vip_lounge_id and ctx.channel.id != vip_lounge_id:
        await ctx.send("❌ Cette commande est réservée au salon **#vip-lounge** !", delete_after=5)
        return
    
    # Vérifier les rôles (VIP ou Admin)
    user_roles = [role.name.lower() for role in ctx.author.roles]
    is_admin = ctx.author.guild_permissions.administrator
    is_vip = any(role in user_roles for role in ["vip", "👑 vip", "chasseur de clés", "chasseurs de clés", "elite", "premium"])
    
    if not is_admin and not is_vip:
        await ctx.send("❌ Cette commande est réservée aux membres **VIP** ! 👑", delete_after=5)
        return
    
    # Vérifier la limite quotidienne (admins exemptés)
    if not is_admin:
        can_ask, remaining = check_ask_limit(ctx.author.id)
        if not can_ask:
            embed = discord.Embed(
                title="⏰ Limite atteinte",
                description=f"Tu as utilisé tes **{ASK_DAILY_LIMIT} questions** aujourd'hui.\n\nReviendras demain ! 🌅",
                color=0xff6600
            )
            embed.set_footer(text="💡 La limite se réinitialise à minuit (heure de Paris)")
            await ctx.send(embed=embed, delete_after=15)
            return
    
    # Vérifier qu'une question a été posée
    if not question:
        # Afficher les crédits restants
        if not is_admin:
            _, remaining = check_ask_limit(ctx.author.id)
            credits_text = f"\n\n📊 **Crédits restants aujourd'hui:** {remaining}/{ASK_DAILY_LIMIT}"
        else:
            credits_text = "\n\n👑 **Admin:** Questions illimitées"
        
        embed = discord.Embed(
            title="🤖 Comment utiliser !ask",
            description=f"Pose ta question à notre IA expert crypto !{credits_text}",
            color=0x9b59b6
        )
        embed.add_field(
            name="📝 Usage",
            value="`!ask <ta question>`",
            inline=False
        )
        embed.add_field(
            name="💡 Exemples",
            value="• `!ask que penses-tu du BTC actuellement ?`\n• `!ask quel est le prix de l'or ?`\n• `!ask explique-moi le halving`\n• `!ask analyse technique ETH`",
            inline=False
        )
        embed.set_footer(text=f"👑 Réservé aux VIP • {ASK_DAILY_LIMIT} questions/jour • Powered by Grok")
        await ctx.send(embed=embed)
        return
    
    # Message de chargement
    msg = await ctx.send("🤔 **Analyse en cours...**\n_Grok réfléchit à ta question..._")
    
    # Récupérer le contexte marché pour enrichir la réponse
    prices = get_btc_price()
    fg = get_fear_greed()
    global_data = get_global_data()
    
    # Récupérer le prix de l'or si la question concerne l'or
    gold_data = None
    question_lower = question.lower()
    if any(word in question_lower for word in ["or", "gold", "xau", "métal", "metal", "once"]):
        gold_data = get_gold_price()
    
    # Construire le contexte
    market_context = ""
    if prices and fg and global_data:
        market_context = f"""
CONTEXTE MARCHÉ CRYPTO ACTUEL (données temps réel):
- BTC: ${prices['btc_price']:,.0f} ({prices['btc_change']:+.1f}% 24h)
- ETH: ${prices['eth_price']:,.0f} ({prices['eth_change']:+.1f}% 24h)
- Fear & Greed: {fg['value']}/100 ({fg['sentiment']})
- BTC Dominance: {global_data['btc_dominance']:.1f}%
- Market Cap Total: ${global_data['total_market_cap']/1e12:.2f}T
"""
    
    # Ajouter le prix de l'or si disponible
    if gold_data:
        market_context += f"""
PRIX DE L'OR ACTUEL:
- Or (XAU): ${gold_data['price']:,.2f} par once troy
"""
    elif any(word in question_lower for word in ["or", "gold", "xau", "métal", "metal", "once"]):
        market_context += """
NOTE: Je n'ai pas pu récupérer le prix actuel de l'or. Conseille à l'utilisateur de vérifier sur des sites comme Kitco, Bloomberg ou TradingView pour les prix en temps réel.
"""
    
    # Construire le prompt
    prompt = f"""{market_context}

QUESTION DU MEMBRE VIP: {question}

Réponds en tant qu'expert Horizon Elite:
- Sois précis et utile
- Utilise les données marché fournies si pertinent
- Si la question concerne l'or et que tu n'as pas le prix exact, mentionne-le clairement
- Donne ton analyse honnête
- Reste accessible mais professionnel
- Utilise des emojis avec parcimonie
- Si c'est une question de trading, rappelle NFA-DYOR
- Réponds en français
- Réponse concise (max 300 mots)"""
    
    # Appeler Grok
    try:
        response = ask_grok(prompt, max_tokens=600)
        
        if not response:
            await msg.edit(content="❌ **Erreur:** Impossible de contacter l'IA. Réessaie dans quelques instants.")
            return
        
        # Incrémenter le compteur (sauf admin)
        if not is_admin:
            remaining = increment_ask_count(ctx.author.id)
            credits_footer = f" • 📊 {remaining}/{ASK_DAILY_LIMIT} crédits restants"
        else:
            credits_footer = " • 👑 Admin"
        
        # Créer l'embed de réponse
        embed = discord.Embed(
            title="🤖 Réponse Grok",
            description=response[:4000],
            color=0x9b59b6,
            timestamp=datetime.now(TIMEZONE)
        )
        
        # Ajouter le contexte marché
        market_footer = ""
        if prices:
            market_footer = f"BTC `${prices['btc_price']:,.0f}` | ETH `${prices['eth_price']:,.0f}` | F&G `{fg['value'] if fg else 'N/A'}`"
        if gold_data:
            market_footer += f" | Or `${gold_data['price']:,.0f}/oz`"
        
        if market_footer:
            embed.add_field(name="📊 Marché actuel", value=market_footer, inline=False)
        
        embed.set_footer(text=f"Question de {ctx.author.display_name}{credits_footer} • NFA-DYOR")
        
        await msg.edit(content=None, embed=embed)
        print(f"[ASK] ✅ {ctx.author.display_name}: {question[:50]}... (crédits: {remaining if not is_admin else '∞'})")
        
    except Exception as e:
        print(f"[ASK] Erreur: {e}")
        await msg.edit(content=f"❌ **Erreur:** {str(e)[:100]}")
        
# ============================================================
#     🚀 ÉVÉNEMENTS
# ============================================================
@bot.event
async def on_ready():
    global startup_done
    
    print("\n" + "=" * 60)
    print(f"🤖 BOT CONNECTÉ: {bot.user}")
    print(f"📡 Serveurs: {len(bot.guilds)}")
    print(f"⏰ {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 60)
    
    print("\n🔍 Canaux:")
    for name, cid in CHANNELS.items():
        ch = bot.get_channel(cid) if cid else None
        print(f"   {'✅' if ch else '❌'} {name}")
    
    if not scheduled_update.is_running():
        scheduled_update.start()
    if not realtime_news_check.is_running():
        realtime_news_check.start()
    if not realtime_price_check.is_running():
        realtime_price_check.start()
    if not realtime_opportunities_check.is_running():
        realtime_opportunities_check.start()
    
    print("\n✅ Tâches:")
    print("   • Planifié: 8h, 12h, 18h")
    print("   • News: 45 min (délai 1h)")
    print("   • Prix: 15 min")
    print("   • Opportunities: 2h")
    
    if not startup_done:
        startup_done = True
        print("\n🚀 Démarrage...")
        await asyncio.sleep(5)
        await run_global_update(source="startup")
    
    print("\n🎯 HORIZON ELITE V4 OPÉRATIONNEL\n")

@bot.event
async def on_error(event, *args, **kwargs):
    print(f"[ERROR] {event}:")
    traceback.print_exc()

# ============================================================
#     🚀 LANCEMENT
# ============================================================
if __name__ == "__main__":
    print("\n🚀 Démarrage Horizon Elite V4...")
    keep_alive()
    if not DISCORD_TOKEN:
        print("❌ DISCORD_TOKEN manquant!")
    else:
        bot.run(DISCORD_TOKEN)
