import discord
from discord.ext import commands, tasks
import requests
from datetime import datetime, time
import pytz
import asyncio
import os
import traceback
from google import genai
from google.genai import types
from flask import Flask
from threading import Thread

app = Flask('')

@app.route('/')
def home():
    return "Bot Crypto VIP + Solo is alive!"

def run_web():
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run_web)
    t.daemon = True
    t.start()

# ============================================================
#                    CONFIGURATION
# ============================================================

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ------ CANAUX VIP/PRO (avec analyses Gemini) ------
CHANNEL_FEAR_GREED = int(os.getenv("CHANNEL_FEAR_GREED", "0"))
CHANNEL_SETUP = int(os.getenv("CHANNEL_SETUP", "0"))
CHANNEL_WATCHLIST = int(os.getenv("CHANNEL_WATCHLIST", "0"))
CHANNEL_OPPORTUNITIES = int(os.getenv("CHANNEL_OPPORTUNITIES", "0"))

# ------ CANAUX SOLO (alertes simples sans analyse) ------
CHANNEL_SOLO_FEAR_GREED = int(os.getenv("CHANNEL_SOLO_FEAR_GREED", "0"))
CHANNEL_SOLO_PRIX = int(os.getenv("CHANNEL_SOLO_PRIX", "0"))
CHANNEL_SOLO_ALERTES = int(os.getenv("CHANNEL_SOLO_ALERTES", "0"))

# ------ CANAL NEWS (visible par tous) ------
CHANNEL_ACTUS_CRYPTO = int(os.getenv("CHANNEL_ACTUS_CRYPTO", "0"))

# Stockage des news deja envoyees (pour eviter les doublons)
sent_news_ids = set()

# Flag pour eviter les doublons au demarrage
startup_posts_sent = False

TIMEZONE = pytz.timezone("Europe/Paris")

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

# Configuration Gemini
print(f"[CONFIG] GEMINI_API_KEY set: {GEMINI_API_KEY is not None and len(str(GEMINI_API_KEY or '')) > 0}")
print(f"[CONFIG] DISCORD_TOKEN set: {DISCORD_TOKEN is not None and len(str(DISCORD_TOKEN or '')) > 0}")
print(f"[CONFIG] VIP Channels - FG: {CHANNEL_FEAR_GREED}, Setup: {CHANNEL_SETUP}, Watch: {CHANNEL_WATCHLIST}, Opport: {CHANNEL_OPPORTUNITIES}")
print(f"[CONFIG] SOLO Channels - FG: {CHANNEL_SOLO_FEAR_GREED}, Prix: {CHANNEL_SOLO_PRIX}, Alertes: {CHANNEL_SOLO_ALERTES}")
print(f"[CONFIG] NEWS Channel: {CHANNEL_ACTUS_CRYPTO}")

# Configuration du client Gemini (nouvelle API google.genai)
gemini_client = None
try:
    if GEMINI_API_KEY:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[CONFIG] Gemini client initialized successfully")
    else:
        print("[CONFIG] WARNING: GEMINI_API_KEY not set!")
except Exception as e:
    print(f"[CONFIG] ERROR initializing Gemini client: {e}")

# Liste des cryptos HYPE pour les alertes Solo
HYPE_COINS = [
    "solana",           # SOL
    "binancecoin",      # BNB
    "hyperliquid",      # HYPE
    "sui",              # SUI
    "pepe",             # PEPE
    "dogecoin",         # DOGE
    "shiba-inu",        # SHIB
    "render-token",     # RENDER
    "injective-protocol", # INJ
    "celestia",         # TIA
    "jupiter-exchange-solana", # JUP
    "bonk",             # BONK
    "arbitrum",         # ARB
    "optimism",         # OP
    "avalanche-2",      # AVAX
]

# ============================================================
#                    HELPER FUNCTIONS
# ============================================================

async def get_channel_safe(channel_id):
    """Recupere un canal de maniere securisee avec fallback"""
    if channel_id == 0:
        return None

    # Essayer d'abord avec le cache
    channel = bot.get_channel(channel_id)
    if channel:
        return channel

    # Si pas dans le cache, essayer de fetch
    try:
        channel = await bot.fetch_channel(channel_id)
        return channel
    except discord.NotFound:
        print(f"[ERROR] Canal {channel_id} non trouve")
        return None
    except discord.Forbidden:
        print(f"[ERROR] Acces refuse au canal {channel_id}")
        return None
    except Exception as e:
        print(f"[ERROR] Erreur recuperation canal {channel_id}: {e}")
        return None

# ============================================================
#                    FONCTIONS API
# ============================================================

def get_fear_greed():
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=7", timeout=10)
        data = r.json()["data"]
        current = data[0]
        history = data[1:7]
        return {
            "value": int(current["value"]),
            "sentiment": current["value_classification"],
            "history": [{"value": int(d["value"]), "date": d["timestamp"]} for d in history]
        }
    except Exception as e:
        print(f"[API] Erreur Fear and Greed: {e}")
        return None

def get_btc_data():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false",
            timeout=10
        )
        data = r.json()
        return {
            "name": "Bitcoin",
            "symbol": "BTC",
            "price": data["market_data"]["current_price"]["usd"],
            "change_24h": data["market_data"]["price_change_percentage_24h"],
            "change_7d": data["market_data"]["price_change_percentage_7d"],
            "change_30d": data["market_data"]["price_change_percentage_30d"],
            "high_24h": data["market_data"]["high_24h"]["usd"],
            "low_24h": data["market_data"]["low_24h"]["usd"],
            "ath": data["market_data"]["ath"]["usd"],
            "ath_change": data["market_data"]["ath_change_percentage"]["usd"],
            "market_cap": data["market_data"]["market_cap"]["usd"],
            "volume": data["market_data"]["total_volume"]["usd"],
        }
    except Exception as e:
        print(f"[API] Erreur BTC: {e}")
        return None

def get_eth_data():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&community_data=false&developer_data=false",
            timeout=10
        )
        data = r.json()
        return {
            "name": "Ethereum",
            "symbol": "ETH",
            "price": data["market_data"]["current_price"]["usd"],
            "change_24h": data["market_data"]["price_change_percentage_24h"],
            "change_7d": data["market_data"]["price_change_percentage_7d"],
            "change_30d": data["market_data"]["price_change_percentage_30d"],
            "high_24h": data["market_data"]["high_24h"]["usd"],
            "low_24h": data["market_data"]["low_24h"]["usd"],
            "ath": data["market_data"]["ath"]["usd"],
            "ath_change": data["market_data"]["ath_change_percentage"]["usd"],
            "market_cap": data["market_data"]["market_cap"]["usd"],
            "volume": data["market_data"]["total_volume"]["usd"],
        }
    except Exception as e:
        print(f"[API] Erreur ETH: {e}")
        return None

def get_global_data():
    try:
        r = requests.get("https://api.coingecko.com/api/v3/global", timeout=10)
        data = r.json()["data"]
        return {
            "total_market_cap": data["total_market_cap"]["usd"],
            "total_volume": data["total_volume"]["usd"],
            "btc_dominance": data["market_cap_percentage"]["btc"],
            "eth_dominance": data["market_cap_percentage"]["eth"],
            "market_cap_change_24h": data["market_cap_change_percentage_24h_usd"],
        }
    except Exception as e:
        print(f"[API] Erreur Global: {e}")
        return None

def get_top_cryptos_advanced():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d",
            timeout=15
        )
        return r.json()
    except Exception as e:
        print(f"[API] Erreur Top Cryptos: {e}")
        return []

def get_trending_cryptos():
    try:
        r = requests.get("https://api.coingecko.com/api/v3/search/trending", timeout=10)
        return r.json()["coins"]
    except Exception as e:
        print(f"[API] Erreur Trending: {e}")
        return []

def get_crypto_news():
    try:
        r = requests.get(
            "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular",
            timeout=10
        )
        data = r.json()
        return data.get("Data", [])[:5]
    except Exception as e:
        print(f"[API] Erreur News: {e}")
        return []

def get_latest_important_news():
    """Recupere les dernieres news importantes avec plus de details"""
    all_news = []

    # Source 1: CryptoCompare (news populaires)
    try:
        r = requests.get(
            "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest",
            timeout=10
        )
        data = r.json()
        news_list = data.get("Data", [])[:15]
        for news in news_list:
            all_news.append({
                "id": news.get("id"),
                "title": news.get("title", ""),
                "body": news.get("body", "")[:500],
                "url": news.get("url", ""),
                "source": news.get("source", ""),
                "published": news.get("published_on", 0),
                "categories": news.get("categories", ""),
                "tags": news.get("tags", ""),
            })
    except Exception as e:
        print(f"[API] Erreur CryptoCompare News: {e}")

    # Source 2: CoinGecko Status Updates (events importants) - peut etre deprecie
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/status_updates?per_page=10",
            timeout=10
        )
        data = r.json()
        if isinstance(data, dict) and "status_updates" in data:
            for item in data.get("status_updates", []):
                all_news.append({
                    "id": f"cg_{item.get('created_at', '')}",
                    "title": item.get("project", {}).get("name", "") + ": " + (item.get("description", "")[:100] if item.get("description") else "Update"),
                    "body": item.get("description", "")[:500],
                    "url": item.get("project", {}).get("links", {}).get("homepage", [""])[0] if item.get("project", {}).get("links", {}).get("homepage") else "",
                    "source": "CoinGecko",
                    "published": 0,
                    "categories": item.get("category", ""),
                    "tags": "",
                })
    except Exception as e:
        print(f"[API] Erreur CoinGecko Status: {e}")

    return all_news

def filter_important_news(news_list):
    """Filtre les news importantes selon des mots-cles"""
    important_keywords = [
        "SEC", "ETF", "regulation", "regulatory", "government", "federal", "law", "legal",
        "ban", "approve", "approved", "approval", "reject", "lawsuit", "investigation",
        "CFTC", "DOJ", "FBI", "treasury", "congress", "senate", "EU", "europe",
        "BlackRock", "Fidelity", "Grayscale", "MicroStrategy", "Tesla", "Coinbase",
        "Binance", "Kraken", "Gemini", "PayPal", "Visa", "Mastercard", "JPMorgan",
        "Goldman", "Bank of America", "Deutsche Bank", "HSBC",
        "hack", "hacked", "exploit", "breach", "stolen", "attack", "vulnerability",
        "crash", "surge", "soar", "plunge", "all-time high", "ATH", "record",
        "halving", "merge", "upgrade", "fork", "launch", "listing", "delist",
        "bankruptcy", "collapse", "insolvent", "FTX", "bankrupt",
        "adoption", "accept", "payment", "partnership", "institutional", "whale",
        "billion", "million", "fund", "investment", "acquire",
        "Bitcoin", "BTC", "Ethereum", "ETH", "Solana", "SOL", "XRP", "Ripple",
        "stablecoin", "USDT", "USDC", "Tether",
    ]

    important_news = []
    for news in news_list:
        title = news.get("title", "").lower()
        body = news.get("body", "").lower()
        categories = news.get("categories", "").lower()

        score = 0
        matched_keywords = []

        for keyword in important_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in title:
                score += 3
                matched_keywords.append(keyword)
            elif keyword_lower in body:
                score += 1
                matched_keywords.append(keyword)

        if "regulation" in categories or "exchange" in categories:
            score += 2
        if "bitcoin" in categories or "ethereum" in categories:
            score += 1

        if score >= 3:
            news["importance_score"] = score
            news["matched_keywords"] = list(set(matched_keywords))[:5]
            important_news.append(news)

    important_news.sort(key=lambda x: x["importance_score"], reverse=True)
    return important_news[:5]

def get_defi_opportunities():
    try:
        r = requests.get("https://yields.llama.fi/pools", timeout=15)
        data = r.json()["data"]
        good_yields = [
            p for p in data
            if p.get("apy") and p["apy"] > 5 and p["apy"] < 50
            and p.get("tvlUsd", 0) > 10000000
            and "USD" in p.get("symbol", "").upper()
        ]
        return sorted(good_yields, key=lambda x: x["tvlUsd"], reverse=True)[:5]
    except Exception as e:
        print(f"[API] Erreur DeFi: {e}")
        return []

def get_macro_data():
    macro = {}
    try:
        r = requests.get("https://api.exchangerate-api.com/v4/latest/USD", timeout=10)
        data = r.json()
        macro["eur_usd"] = data["rates"]["EUR"]
    except:
        macro["eur_usd"] = None
    try:
        r = requests.get("https://api.etherscan.io/api?module=gastracker&action=gasoracle", timeout=10)
        data = r.json()
        if data.get("status") == "1":
            macro["eth_gas"] = {
                "low": data["result"]["SafeGasPrice"],
                "avg": data["result"]["ProposeGasPrice"],
                "high": data["result"]["FastGasPrice"],
            }
    except:
        macro["eth_gas"] = None
    return macro

def get_top_movers():
    """Recupere les plus gros mouvements 24h"""
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h",
            timeout=15
        )
        data = r.json()
        if isinstance(data, list):
            sorted_data = sorted(data, key=lambda x: abs(x.get("price_change_percentage_24h", 0) or 0), reverse=True)
            return sorted_data[:5]
        return []
    except Exception as e:
        print(f"[API] Erreur Top Movers: {e}")
        return []

def get_hype_coins_data():
    """Recupere les donnees des cryptos hype"""
    try:
        ids = ",".join(HYPE_COINS)
        r = requests.get(
            f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d",
            timeout=15
        )
        data = r.json()
        if isinstance(data, list):
            return data
        else:
            print(f"[API] Erreur API Hype Coins: {data}")
            return []
    except Exception as e:
        print(f"[API] Erreur Hype Coins: {e}")
        return []

# ============================================================
#                    FONCTIONS GEMINI (VIP/PRO)
# ============================================================

def ask_gemini(prompt, max_output_tokens=800):
    """Appelle l'API Gemini avec gestion d'erreurs robuste"""
    global gemini_client

    if not gemini_client:
        print("[GEMINI] Client non initialise - tentative de reinitialisation...")
        try:
            if GEMINI_API_KEY:
                gemini_client = genai.Client(api_key=GEMINI_API_KEY)
                print("[GEMINI] Client reinitialise avec succes")
            else:
                print("[GEMINI] Pas de cle API disponible")
                return None
        except Exception as e:
            print(f"[GEMINI] Echec reinitialisation: {e}")
            return None

    try:
        system = "Tu es un analyste crypto senior. Tu donnes des analyses educatives, jamais de conseils financiers. Ton ton est pro mais accessible. Tu reponds en francais. Tu es concis."
        full_prompt = f"{system}\n\n{prompt}"

        print(f"[GEMINI] Envoi requete ({len(full_prompt)} chars)...")

        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash-latest',
            contents=full_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_output_tokens,
                temperature=0.7
            )
        )

        # Extraire le texte de la reponse
        if response and hasattr(response, 'text') and response.text:
            result = response.text.strip()
            print(f"[GEMINI] Reponse recue ({len(result)} chars)")
            return result
        elif response and hasattr(response, 'candidates') and response.candidates:
            # Fallback: essayer d'extraire depuis candidates
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                parts_text = ''.join([part.text for part in candidate.content.parts if hasattr(part, 'text')])
                if parts_text:
                    print(f"[GEMINI] Reponse extraite des candidates ({len(parts_text)} chars)")
                    return parts_text.strip()

        print(f"[GEMINI] Reponse vide ou format inattendu: {type(response)}")
        return None

    except Exception as e:
        print(f"[GEMINI ERROR] {type(e).__name__}: {e}")
        print(f"[GEMINI ERROR] Traceback: {traceback.format_exc()}")
        return None

def generate_fear_greed_analysis(data):
    history_text = ", ".join([str(h["value"]) for h in data["history"]])
    prompt = f"L'indice Fear and Greed crypto est a {data['value']}/100 ({data['sentiment']}). Les 6 derniers jours: {history_text}. Donne une analyse courte (8 lignes max): signification, tendance, contexte historique, comportement smart money, point attention."
    return ask_gemini(prompt)

def generate_dual_setup(btc, eth, global_data):
    prompt = f"MARCHE: MCap ${global_data['total_market_cap']:,.0f}, 24h {global_data['market_cap_change_24h']:.2f}%, BTC.D {global_data['btc_dominance']:.1f}%. BITCOIN: ${btc['price']:,.0f}, 24h {btc['change_24h']:+.2f}%, 7j {btc['change_7d']:+.2f}%. ETHEREUM: ${eth['price']:,.2f}, 24h {eth['change_24h']:+.2f}%, 7j {eth['change_7d']:+.2f}%. Donne: contexte global, setup BTC (support, resistance, scenarios, biais), setup ETH (support, resistance, scenarios, biais)."
    return ask_gemini(prompt, 1000)

def generate_advanced_watchlist(cryptos, trending):
    movers = [c for c in cryptos if c.get("price_change_percentage_24h_in_currency") and abs(c["price_change_percentage_24h_in_currency"]) > 5][:5]
    movers_text = ", ".join([f"{c['name']} ({c['price_change_percentage_24h_in_currency']:+.1f}%)" for c in movers]) or "Aucun"
    trending_names = [t["item"]["name"] for t in trending[:5]] if trending else []
    prompt = f"MOVERS: {movers_text}. TRENDING: {', '.join(trending_names)}. Selectionne 4 tokens a SURVEILLER avec pour chacun: nom, pourquoi, niveau cle, risque. Pas de conseil achat."
    return ask_gemini(prompt, 1000)

def generate_opportunities_analysis(defi_yields, news, macro, global_data):
    yields_text = ", ".join([f"{y['project']} {y['apy']:.1f}%" for y in defi_yields[:3]]) or "Aucune"
    news_text = news[0].get('title', 'Pas de news') if news else "Pas de news"
    gas_text = f"{macro['eth_gas']['avg']} Gwei" if macro.get("eth_gas") else "N/A"
    prompt = f"MACRO: MCap 24h {global_data['market_cap_change_24h']:+.2f}%, Gas ETH {gas_text}. NEWS: {news_text}. DEFI: {yields_text}. Donne: sentiment macro, top opportunite defi, timing gas, news a retenir."
    return ask_gemini(prompt, 1000)

def generate_news_analysis(news_item):
    """Genere une analyse courte d'une news importante EN FRANCAIS"""
    title = news_item.get("title", "")
    body = news_item.get("body", "")[:400]

    prompt = f"""NEWS CRYPTO (en anglais): "{title}"

DETAILS: {body}

Ta mission: Faire un RESUME EN FRANCAIS pour une communaute francophone.

Donne une analyse COURTE (4-5 lignes max) en FRANCAIS:
- Resume de la news en 1-2 phrases simples
- Impact: Bullish / Bearish / Neutre
- Cryptos concernees

Sois CONCIS et PRECIS. Utilise un langage simple. Pas de conseil financier."""

    return ask_gemini(prompt, 400)

# ============================================================
#              ENVOI MESSAGES VIP/PRO (avec analyses)
# ============================================================

async def send_fear_greed_vip():
    """Fear & Greed avec analyse Gemini pour VIP"""
    channel = await get_channel_safe(CHANNEL_FEAR_GREED)
    if not channel:
        print(f"[VIP] Canal Fear Greed non trouve (ID: {CHANNEL_FEAR_GREED})")
        return

    data = get_fear_greed()
    if not data:
        print("[VIP] Pas de donnees Fear & Greed")
        return

    print("[VIP] Generation analyse Fear & Greed...")
    analysis = generate_fear_greed_analysis(data)
    if not analysis:
        analysis = "Analyse IA temporairement indisponible."

    value = data["value"]
    if value < 25:
        emoji, zone, color = "🔴", "PEUR EXTREME", 0xff0000
    elif value < 45:
        emoji, zone, color = "🟠", "PEUR", 0xff8c00
    elif value < 55:
        emoji, zone, color = "🟡", "NEUTRE", 0xffff00
    elif value < 75:
        emoji, zone, color = "🟢", "AVIDITE", 0x00ff00
    else:
        emoji, zone, color = "🟢", "AVIDITE EXTREME", 0x00ff00

    history_visual = " > ".join([str(h["value"]) for h in reversed(data["history"])] + [str(value)])
    embed = discord.Embed(title="📊 ANALYSE FEAR & GREED", description=datetime.now(TIMEZONE).strftime('%d/%m/%Y'), color=color)
    embed.add_field(name=f"{emoji} Indice", value=f"**{value}/100** - {zone}", inline=False)
    embed.add_field(name="📈 7 jours", value=history_visual, inline=False)
    embed.add_field(name="🤖 Analyse IA", value=analysis[:1024], inline=False)
    embed.set_footer(text="🔒 VIP/PRO - NFA - DYOR")

    try:
        await channel.send(embed=embed)
        print(f"[VIP] Fear Greed envoye: {value}")
    except Exception as e:
        print(f"[VIP] Erreur envoi Fear Greed: {e}")

async def send_btc_eth_setup_vip():
    """Setup BTC/ETH avec analyse Gemini pour VIP"""
    channel = await get_channel_safe(CHANNEL_SETUP)
    if not channel:
        print(f"[VIP] Canal Setup non trouve (ID: {CHANNEL_SETUP})")
        return

    btc = get_btc_data()
    eth = get_eth_data()
    global_data = get_global_data()

    if not btc or not eth or not global_data:
        print(f"[VIP] Donnees manquantes - BTC: {btc is not None}, ETH: {eth is not None}, Global: {global_data is not None}")
        return

    print("[VIP] Generation analyse Setup BTC/ETH...")
    analysis = generate_dual_setup(btc, eth, global_data)
    if not analysis:
        analysis = "Analyse IA temporairement indisponible."

    btc_emoji = "🟢" if btc["change_24h"] > 0 else "🔴"
    eth_emoji = "🟢" if eth["change_24h"] > 0 else "🔴"
    embed = discord.Embed(title="🎯 SETUP DU JOUR - BTC & ETH", description=datetime.now(TIMEZONE).strftime('%d/%m/%Y'), color=0xf7931a)
    embed.add_field(name=f"BTC {btc_emoji}", value=f"${btc['price']:,.0f} ({btc['change_24h']:+.2f}%)", inline=True)
    embed.add_field(name=f"ETH {eth_emoji}", value=f"${eth['price']:,.2f} ({eth['change_24h']:+.2f}%)", inline=True)
    embed.add_field(name="MCap", value=f"{global_data['market_cap_change_24h']:+.2f}%", inline=True)
    embed.add_field(name="🤖 Analyse IA", value=analysis[:1024], inline=False)
    embed.set_footer(text="🔒 VIP/PRO - NFA - DYOR")

    try:
        await channel.send(embed=embed)
        print("[VIP] Setup envoye")
    except Exception as e:
        print(f"[VIP] Erreur envoi Setup: {e}")

async def send_watchlist_vip():
    """Watchlist avec analyse Gemini pour VIP"""
    channel = await get_channel_safe(CHANNEL_WATCHLIST)
    if not channel:
        print(f"[VIP] Canal Watchlist non trouve (ID: {CHANNEL_WATCHLIST})")
        return

    cryptos = get_top_cryptos_advanced()
    trending = get_trending_cryptos()

    if not cryptos:
        print("[VIP] Pas de donnees cryptos pour watchlist")
        return

    print("[VIP] Generation analyse Watchlist...")
    analysis = generate_advanced_watchlist(cryptos, trending)
    if not analysis:
        analysis = "Analyse IA temporairement indisponible."

    embed = discord.Embed(title="👁️ WATCHLIST PRO", description=datetime.now(TIMEZONE).strftime('%d/%m/%Y'), color=0x9b59b6)
    embed.add_field(name="🤖 Analyse IA", value=analysis[:1024], inline=False)
    embed.set_footer(text="🔒 VIP/PRO - Watchlist = pas un signal - DYOR")

    try:
        await channel.send(embed=embed)
        print("[VIP] Watchlist envoyee")
    except Exception as e:
        print(f"[VIP] Erreur envoi Watchlist: {e}")

async def send_opportunities_vip():
    """Opportunites avec analyse Gemini pour VIP"""
    channel = await get_channel_safe(CHANNEL_OPPORTUNITIES)
    if not channel:
        print(f"[VIP] Canal Opportunites non trouve (ID: {CHANNEL_OPPORTUNITIES})")
        return

    defi = get_defi_opportunities()
    news = get_crypto_news()
    macro = get_macro_data()
    global_data = get_global_data()

    if not global_data:
        print("[VIP] Pas de donnees globales pour opportunites")
        return

    print("[VIP] Generation analyse Opportunites...")
    analysis = generate_opportunities_analysis(defi, news, macro, global_data)
    if not analysis:
        analysis = "Analyse IA temporairement indisponible."

    market_emoji = "🟢" if global_data["market_cap_change_24h"] > 0 else "🔴"
    embed = discord.Embed(title="💎 OPPORTUNITES & MACRO", description=datetime.now(TIMEZONE).strftime('%d/%m/%Y'), color=0xe74c3c)
    embed.add_field(name=f"{market_emoji} Marche", value=f"{global_data['market_cap_change_24h']:+.2f}%", inline=True)
    embed.add_field(name="BTC.D", value=f"{global_data['btc_dominance']:.1f}%", inline=True)
    embed.add_field(name="🤖 Analyse IA", value=analysis[:1024], inline=False)
    embed.set_footer(text="🔒 VIP/PRO - DYOR")

    try:
        await channel.send(embed=embed)
        print("[VIP] Opportunites envoyees")
    except Exception as e:
        print(f"[VIP] Erreur envoi Opportunites: {e}")

# ============================================================
#              ENVOI MESSAGES SOLO (alertes simples)
# ============================================================

async def send_fear_greed_solo():
    """Fear & Greed simple sans analyse pour Solo"""
    channel = await get_channel_safe(CHANNEL_SOLO_FEAR_GREED)
    if not channel:
        print(f"[SOLO] Canal Fear Greed non trouve (ID: {CHANNEL_SOLO_FEAR_GREED})")
        return

    data = get_fear_greed()
    if not data:
        print("[SOLO] Pas de donnees Fear & Greed")
        return

    value = data["value"]
    if value < 25:
        emoji, zone, color = "🔴", "PEUR EXTREME", 0xff0000
    elif value < 45:
        emoji, zone, color = "🟠", "PEUR", 0xff8c00
    elif value < 55:
        emoji, zone, color = "🟡", "NEUTRE", 0xffff00
    elif value < 75:
        emoji, zone, color = "🟢", "AVIDITE", 0x00ff00
    else:
        emoji, zone, color = "💚", "AVIDITE EXTREME", 0x00ff00

    history_visual = " → ".join([str(h["value"]) for h in reversed(data["history"])] + [f"**{value}**"])

    embed = discord.Embed(title=f"{emoji} FEAR & GREED INDEX", color=color)
    embed.add_field(name="Indice actuel", value=f"# {value}/100\n**{zone}**", inline=False)
    embed.add_field(name="📊 Historique 7 jours", value=history_visual, inline=False)
    embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')} - SOLO")

    try:
        await channel.send(embed=embed)
        print(f"[SOLO] Fear Greed alerte: {value}")
    except Exception as e:
        print(f"[SOLO] Erreur envoi Fear Greed: {e}")

async def send_price_solo():
    """Alerte prix BTC/ETH simple pour Solo"""
    channel = await get_channel_safe(CHANNEL_SOLO_PRIX)
    if not channel:
        print(f"[SOLO] Canal Prix non trouve (ID: {CHANNEL_SOLO_PRIX})")
        return

    btc = get_btc_data()
    eth = get_eth_data()
    global_data = get_global_data()

    if not btc or not eth or not global_data:
        print("[SOLO] Donnees manquantes pour alerte prix")
        return

    btc_emoji = "🟢" if btc["change_24h"] > 0 else "🔴"
    eth_emoji = "🟢" if eth["change_24h"] > 0 else "🔴"
    market_emoji = "🟢" if global_data["market_cap_change_24h"] > 0 else "🔴"

    embed = discord.Embed(title="📈 PRIX CRYPTO", color=0xf7931a)
    embed.add_field(
        name=f"{btc_emoji} BITCOIN",
        value=f"**${btc['price']:,.0f}**\n24h: {btc['change_24h']:+.2f}%\nH: ${btc['high_24h']:,.0f} | L: ${btc['low_24h']:,.0f}",
        inline=True
    )
    embed.add_field(
        name=f"{eth_emoji} ETHEREUM",
        value=f"**${eth['price']:,.2f}**\n24h: {eth['change_24h']:+.2f}%\nH: ${eth['high_24h']:,.2f} | L: ${eth['low_24h']:,.2f}",
        inline=True
    )
    embed.add_field(
        name=f"{market_emoji} MARCHE",
        value=f"MCap: {global_data['market_cap_change_24h']:+.2f}%\nBTC.D: {global_data['btc_dominance']:.1f}%",
        inline=True
    )
    embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')} - SOLO")

    try:
        await channel.send(embed=embed)
        print("[SOLO] Prix alerte envoyee")
    except Exception as e:
        print(f"[SOLO] Erreur envoi Prix: {e}")

async def send_hype_coins_solo():
    """Alerte prix des cryptos HYPE pour Solo"""
    channel = await get_channel_safe(CHANNEL_SOLO_ALERTES)
    if not channel:
        print(f"[SOLO] Canal Alertes non trouve (ID: {CHANNEL_SOLO_ALERTES})")
        return

    coins = get_hype_coins_data()
    if not coins or not isinstance(coins, list) or len(coins) == 0:
        print("[SOLO] Pas de donnees hype coins disponibles")
        return

    valid_coins = [c for c in coins if isinstance(c, dict)]
    if not valid_coins:
        print("[SOLO] Aucun coin valide")
        return

    coins_sorted = sorted(valid_coins, key=lambda x: x.get("price_change_percentage_24h_in_currency", 0) or 0, reverse=True)

    embed = discord.Embed(
        title="🔥 HYPE COINS - ALERTES PRIX",
        description="Cryptos tendance du moment",
        color=0xff6b35
    )

    for coin in coins_sorted[:12]:
        change_24h = coin.get("price_change_percentage_24h_in_currency", 0) or 0
        change_7d = coin.get("price_change_percentage_7d_in_currency", 0) or 0

        emoji = "🟢" if change_24h > 0 else "🔴"
        trend = "📈" if change_7d > 5 else ("📉" if change_7d < -5 else "➡️")

        price = coin.get("current_price", 0) or 0
        if price >= 100:
            price_str = f"${price:,.2f}"
        elif price >= 1:
            price_str = f"${price:,.3f}"
        else:
            price_str = f"${price:,.6f}"

        embed.add_field(
            name=f"{emoji} {coin.get('symbol', '?').upper()}",
            value=f"{price_str}\n24h: **{change_24h:+.2f}%**\n7j: {change_7d:+.2f}% {trend}",
            inline=True
        )

    embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')} - SOLO")

    try:
        await channel.send(embed=embed)
        print("[SOLO] Hype coins alerte envoyee")
    except Exception as e:
        print(f"[SOLO] Erreur envoi Hype coins: {e}")

async def send_movers_solo():
    """Alerte top movers pour Solo"""
    channel = await get_channel_safe(CHANNEL_SOLO_ALERTES)
    if not channel:
        print(f"[SOLO] Canal Alertes non trouve (ID: {CHANNEL_SOLO_ALERTES})")
        return

    movers = get_top_movers()
    if not movers:
        print("[SOLO] Pas de donnees top movers")
        return

    embed = discord.Embed(
        title="🚀 TOP MOVERS 24H",
        description="Plus gros mouvements du Top 50",
        color=0x9b59b6
    )

    for i, coin in enumerate(movers, 1):
        change = coin.get("price_change_percentage_24h", 0) or 0
        emoji = "🟢" if change > 0 else "🔴"

        embed.add_field(
            name=f"{emoji} #{i} {coin['symbol'].upper()}",
            value=f"${coin['current_price']:,.4f}\n**{change:+.2f}%**",
            inline=True
        )

    if len(movers) % 3 != 0:
        for _ in range(3 - (len(movers) % 3)):
            embed.add_field(name="\u200b", value="\u200b", inline=True)

    embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')} - SOLO")

    try:
        await channel.send(embed=embed)
        print("[SOLO] Movers alerte envoyee")
    except Exception as e:
        print(f"[SOLO] Erreur envoi Movers: {e}")

async def send_trending_solo():
    """Alerte cryptos trending pour Solo"""
    channel = await get_channel_safe(CHANNEL_SOLO_ALERTES)
    if not channel:
        print(f"[SOLO] Canal Alertes non trouve (ID: {CHANNEL_SOLO_ALERTES})")
        return

    trending = get_trending_cryptos()
    if not trending:
        print("[SOLO] Pas de donnees trending")
        return

    embed = discord.Embed(
        title="🔍 TRENDING - Top Recherches",
        description="Les plus recherchees sur CoinGecko",
        color=0x00d4aa
    )

    btc = get_btc_data()
    btc_price_usd = btc["price"] if btc else 100000

    for i, item in enumerate(trending[:6], 1):
        coin = item.get("item", {})
        name = coin.get("name", "?")
        symbol = coin.get("symbol", "?")
        market_cap_rank = coin.get("market_cap_rank", "N/A")
        price_btc = coin.get("price_btc", 0)
        price_usd = price_btc * btc_price_usd if price_btc else 0

        embed.add_field(
            name=f"#{i} {symbol.upper()}",
            value=f"{name}\nRank: #{market_cap_rank}\n≈ ${price_usd:,.6f}",
            inline=True
        )

    embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')} - SOLO")

    try:
        await channel.send(embed=embed)
        print("[SOLO] Trending alerte envoyee")
    except Exception as e:
        print(f"[SOLO] Erreur envoi Trending: {e}")

# ============================================================
#              ENVOI NEWS (visible par tous)
# ============================================================

async def send_important_news():
    """Envoie les news importantes avec analyse Gemini"""
    global sent_news_ids

    channel = await get_channel_safe(CHANNEL_ACTUS_CRYPTO)
    if not channel:
        print(f"[NEWS] Canal actus-crypto non trouve (ID: {CHANNEL_ACTUS_CRYPTO})")
        return

    all_news = get_latest_important_news()
    if not all_news:
        print("[NEWS] Aucune news recuperee")
        return

    important_news = filter_important_news(all_news)
    if not important_news:
        print("[NEWS] Aucune news importante trouvee")
        return

    news_sent_count = 0

    for news in important_news:
        news_id = str(news.get("id", ""))

        if news_id in sent_news_ids:
            continue

        if news_sent_count >= 1:
            break

        print(f"[NEWS] Generation analyse pour: {news.get('title', '')[:50]}...")
        analysis = generate_news_analysis(news)

        keywords = news.get("matched_keywords", [])
        keywords_lower = [k.lower() for k in keywords]

        if any(k in keywords_lower for k in ["hack", "exploit", "crash", "bankruptcy", "collapse"]):
            emoji = "🚨"
            color = 0xff0000
        elif any(k in keywords_lower for k in ["etf", "approved", "approval", "adoption", "institutional"]):
            emoji = "🟢"
            color = 0x00ff00
        elif any(k in keywords_lower for k in ["sec", "regulation", "regulatory", "lawsuit", "investigation"]):
            emoji = "⚖️"
            color = 0xffa500
        elif any(k in keywords_lower for k in ["ath", "record", "surge", "soar"]):
            emoji = "🚀"
            color = 0x00ff00
        else:
            emoji = "📰"
            color = 0x3498db

        embed = discord.Embed(
            title=f"{emoji} {news.get('title', 'News Crypto')[:200]}",
            color=color,
            url=news.get("url", "")
        )

        if keywords:
            embed.add_field(
                name="🏷️ Tags",
                value=" - ".join([f"`{k}`" for k in keywords[:5]]),
                inline=False
            )

        if analysis:
            analysis_text = analysis[:1000] if len(analysis) > 1000 else analysis
            embed.add_field(
                name="🤖 Resume IA (FR)",
                value=analysis_text,
                inline=False
            )
        else:
            embed.add_field(
                name="🤖 Resume",
                value="Resume non disponible",
                inline=False
            )

        source = news.get("source", "")
        if source:
            embed.set_footer(text=f"📡 {source} - {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')}")
        else:
            embed.set_footer(text=f"🕐 {datetime.now(TIMEZONE).strftime('%d/%m/%Y %H:%M')}")

        try:
            await channel.send(embed=embed)
            sent_news_ids.add(news_id)
            news_sent_count += 1
            print(f"[NEWS] Envoyee: {news.get('title', '')[:50]}...")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[NEWS] Erreur envoi: {e}")

    if len(sent_news_ids) > 100:
        sent_news_ids = set(list(sent_news_ids)[-100:])

    if news_sent_count > 0:
        print(f"[NEWS] {news_sent_count} news envoyee(s)")
    else:
        print("[NEWS] Aucune nouvelle news a envoyer")

# ============================================================
#                    TACHES PLANIFIEES
# ============================================================

# ------ VIP/PRO ------
@tasks.loop(time=time(hour=8, minute=0, tzinfo=TIMEZONE))
async def morning_post_vip():
    print("[VIP] Posts du matin...")
    await send_fear_greed_vip()
    await asyncio.sleep(10)
    await send_btc_eth_setup_vip()

@tasks.loop(time=time(hour=12, minute=0, tzinfo=TIMEZONE))
async def noon_post_vip():
    print("[VIP] Post du midi...")
    await send_watchlist_vip()

@tasks.loop(time=time(hour=18, minute=0, tzinfo=TIMEZONE))
async def evening_post_vip():
    print("[VIP] Post du soir...")
    await send_opportunities_vip()

# ------ SOLO ------
@tasks.loop(time=time(hour=8, minute=30, tzinfo=TIMEZONE))
async def morning_alert_solo():
    print("[SOLO] Alertes du matin...")
    await send_fear_greed_solo()
    await asyncio.sleep(5)
    await send_price_solo()
    await asyncio.sleep(5)
    await send_hype_coins_solo()

@tasks.loop(time=time(hour=12, minute=30, tzinfo=TIMEZONE))
async def noon_alert_solo():
    print("[SOLO] Alerte du midi...")
    await send_price_solo()
    await asyncio.sleep(5)
    await send_hype_coins_solo()

@tasks.loop(time=time(hour=18, minute=30, tzinfo=TIMEZONE))
async def evening_alert_solo():
    print("[SOLO] Alertes du soir...")
    await send_fear_greed_solo()
    await asyncio.sleep(5)
    await send_movers_solo()
    await asyncio.sleep(5)
    await send_trending_solo()

@tasks.loop(time=time(hour=21, minute=0, tzinfo=TIMEZONE))
async def night_alert_solo():
    print("[SOLO] Alerte nocturne...")
    await send_hype_coins_solo()

# ------ NEWS (3 fois par jour: 7h, 13h, 19h) ------
@tasks.loop(time=time(hour=7, minute=0, tzinfo=TIMEZONE))
async def morning_news():
    """News du matin"""
    print("[NEWS] News du matin...")
    await send_important_news()

@tasks.loop(time=time(hour=13, minute=0, tzinfo=TIMEZONE))
async def afternoon_news():
    """News de l'apres-midi"""
    print("[NEWS] News de l'apres-midi...")
    await send_important_news()

@tasks.loop(time=time(hour=19, minute=0, tzinfo=TIMEZONE))
async def evening_news():
    """News du soir"""
    print("[NEWS] News du soir...")
    await send_important_news()

# ============================================================
#                    COMMANDES MANUELLES
# ============================================================

# ------ COMMANDES VIP ------
@bot.command(name="fg")
async def cmd_fg(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Generation Fear Greed VIP...")
        await send_fear_greed_vip()

@bot.command(name="setup")
async def cmd_setup(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Generation Setup VIP...")
        await send_btc_eth_setup_vip()

@bot.command(name="watch")
async def cmd_watch(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Generation Watchlist VIP...")
        await send_watchlist_vip()

@bot.command(name="opport")
async def cmd_opport(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Generation Opportunites VIP...")
        await send_opportunities_vip()

@bot.command(name="testvip")
async def cmd_testvip(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Test complet VIP...")
        await send_fear_greed_vip()
        await asyncio.sleep(5)
        await send_btc_eth_setup_vip()
        await asyncio.sleep(5)
        await send_watchlist_vip()
        await asyncio.sleep(5)
        await send_opportunities_vip()
        await ctx.send("✅ Test VIP termine!")

# ------ COMMANDES SOLO ------
@bot.command(name="solofg")
async def cmd_solo_fg(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Alerte Fear Greed Solo...")
        await send_fear_greed_solo()

@bot.command(name="soloprix")
async def cmd_solo_prix(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Alerte Prix Solo...")
        await send_price_solo()

@bot.command(name="solohype")
async def cmd_solo_hype(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Alerte Hype Coins Solo...")
        await send_hype_coins_solo()

@bot.command(name="solomovers")
async def cmd_solo_movers(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Alerte Top Movers Solo...")
        await send_movers_solo()

@bot.command(name="solotrending")
async def cmd_solo_trending(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Alerte Trending Solo...")
        await send_trending_solo()

@bot.command(name="testsolo")
async def cmd_testsolo(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Test complet Solo...")
        await send_fear_greed_solo()
        await asyncio.sleep(3)
        await send_price_solo()
        await asyncio.sleep(3)
        await send_hype_coins_solo()
        await asyncio.sleep(3)
        await send_movers_solo()
        await asyncio.sleep(3)
        await send_trending_solo()
        await ctx.send("✅ Test Solo termine!")

# ------ COMMANDES NEWS ------
@bot.command(name="news")
async def cmd_news(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Verification des news...")
        await send_important_news()

# ------ COMMANDE TEST GEMINI ------
@bot.command(name="testai")
async def cmd_testai(ctx):
    """Teste si Gemini fonctionne"""
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Test de l'IA Gemini...")
        result = ask_gemini("Dis bonjour en francais en une phrase courte.")
        if result:
            await ctx.send(f"✅ Gemini fonctionne!\n**Reponse:** {result[:500]}")
        else:
            await ctx.send("❌ Gemini ne fonctionne pas. Verifiez les logs.")

# ------ COMMANDE TEST ALL ------
@bot.command(name="testall")
async def cmd_testall(ctx):
    if ctx.author.guild_permissions.administrator:
        await ctx.send("🔄 Test COMPLET (VIP + Solo + News)...")
        # VIP
        await send_fear_greed_vip()
        await asyncio.sleep(5)
        await send_btc_eth_setup_vip()
        await asyncio.sleep(5)
        await send_watchlist_vip()
        await asyncio.sleep(5)
        await send_opportunities_vip()
        await asyncio.sleep(5)
        # Solo
        await send_fear_greed_solo()
        await asyncio.sleep(3)
        await send_price_solo()
        await asyncio.sleep(3)
        await send_hype_coins_solo()
        await asyncio.sleep(3)
        await send_movers_solo()
        await asyncio.sleep(3)
        await send_trending_solo()
        await asyncio.sleep(3)
        # News
        await send_important_news()
        await ctx.send("✅ Test COMPLET termine!")

@bot.command(name="status")
async def cmd_status(ctx):
    """Affiche le status du bot et la config"""
    if ctx.author.guild_permissions.administrator:
        embed = discord.Embed(title="🤖 Status du Bot", color=0x3498db)

        # Status Gemini
        gemini_status = "✅ Pret" if gemini_client else "❌ Non initialise"
        embed.add_field(name="Gemini API", value=gemini_status, inline=True)

        # Verifier les canaux
        vip_fg = await get_channel_safe(CHANNEL_FEAR_GREED)
        vip_setup = await get_channel_safe(CHANNEL_SETUP)
        vip_watch = await get_channel_safe(CHANNEL_WATCHLIST)
        vip_opport = await get_channel_safe(CHANNEL_OPPORTUNITIES)
        solo_fg = await get_channel_safe(CHANNEL_SOLO_FEAR_GREED)
        solo_prix = await get_channel_safe(CHANNEL_SOLO_PRIX)
        solo_alertes = await get_channel_safe(CHANNEL_SOLO_ALERTES)
        news_ch = await get_channel_safe(CHANNEL_ACTUS_CRYPTO)

        embed.add_field(name="VIP Fear&Greed", value=f"{'✅' if vip_fg else '❌'} `{CHANNEL_FEAR_GREED}`", inline=True)
        embed.add_field(name="VIP Setup", value=f"{'✅' if vip_setup else '❌'} `{CHANNEL_SETUP}`", inline=True)
        embed.add_field(name="VIP Watchlist", value=f"{'✅' if vip_watch else '❌'} `{CHANNEL_WATCHLIST}`", inline=True)
        embed.add_field(name="VIP Opportunites", value=f"{'✅' if vip_opport else '❌'} `{CHANNEL_OPPORTUNITIES}`", inline=True)
        embed.add_field(name="Solo Fear&Greed", value=f"{'✅' if solo_fg else '❌'} `{CHANNEL_SOLO_FEAR_GREED}`", inline=True)
        embed.add_field(name="Solo Prix", value=f"{'✅' if solo_prix else '❌'} `{CHANNEL_SOLO_PRIX}`", inline=True)
        embed.add_field(name="Solo Alertes", value=f"{'✅' if solo_alertes else '❌'} `{CHANNEL_SOLO_ALERTES}`", inline=True)
        embed.add_field(name="News", value=f"{'✅' if news_ch else '❌'} `{CHANNEL_ACTUS_CRYPTO}`", inline=True)

        await ctx.send(embed=embed)

# ============================================================
#                    DEMARRAGE DU BOT
# ============================================================

@bot.event
async def on_ready():
    global startup_posts_sent
    print(f"[BOT] Connecte en tant que {bot.user}")
    print(f"[BOT] Serveurs: {[g.name for g in bot.guilds]}")

    # Demarrer les taches planifiees
    if not morning_post_vip.is_running():
        morning_post_vip.start()
    if not noon_post_vip.is_running():
        noon_post_vip.start()
    if not evening_post_vip.is_running():
        evening_post_vip.start()
    if not morning_alert_solo.is_running():
        morning_alert_solo.start()
    if not noon_alert_solo.is_running():
        noon_alert_solo.start()
    if not evening_alert_solo.is_running():
        evening_alert_solo.start()
    if not night_alert_solo.is_running():
        night_alert_solo.start()
    if not morning_news.is_running():
        morning_news.start()
    if not afternoon_news.is_running():
        afternoon_news.start()
    if not evening_news.is_running():
        evening_news.start()

    print("[BOT] Toutes les taches planifiees sont lancees")

    # Envoyer les posts au demarrage (une seule fois)
    if not startup_posts_sent:
        startup_posts_sent = True
        print("[BOT] Envoi des posts de demarrage...")
        await asyncio.sleep(5)

        # VIP
        await send_fear_greed_vip()
        await asyncio.sleep(10)
        await send_btc_eth_setup_vip()
        await asyncio.sleep(10)
        await send_watchlist_vip()
        await asyncio.sleep(10)
        await send_opportunities_vip()
        await asyncio.sleep(5)

        # Solo
        await send_fear_greed_solo()
        await asyncio.sleep(5)
        await send_price_solo()
        await asyncio.sleep(5)
        await send_hype_coins_solo()
        await asyncio.sleep(5)

        # News
        await send_important_news()

        print("[BOT] Posts de demarrage termines")

# Demarrer le serveur web pour le healthcheck
keep_alive()

# Lancer le bot
bot.run(DISCORD_TOKEN)
