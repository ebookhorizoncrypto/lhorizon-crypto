'use client';

import { useState } from 'react';
import { Rocket, ShieldCheck, Gamepad2, ArrowRight } from 'lucide-react';

export default function ActiverPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleDiscordLogin = () => {
        setIsLoading(true);
        // Redirect to Discord OAuth
        const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_URL}/api/auth/discord/callback`);
        const scope = encodeURIComponent('identify email guilds.join'); // Request scopes

        // Construct OAuth URL
        window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4">

            {/* Background Ambience */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#f7931a] rounded-full blur-[120px] opacity-10"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#9945ff] rounded-full blur-[120px] opacity-10"></div>
            </div>

            <div className="z-10 max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#5865F2] to-[#404EED] mb-4 shadow-lg shadow-indigo-500/30">
                        <Gamepad2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 font-display">Activation Discord</h1>
                    <p className="text-gray-400 text-sm">
                        Reliez votre compte pour accéder à votre espace membre L'Horizon Crypto.
                    </p>
                </div>

                {/* Benefits Grid */}
                <div className="space-y-4 mb-8">
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-white/5 border border-white/5">
                        <ShieldCheck className="w-5 h-5 text-[#00ff88] mt-0.5 shrink-0" />
                        <div>
                            <h3 className="text-sm font-semibold text-white">Vérification Automatique</h3>
                            <p className="text-xs text-gray-400">Nous vérifions instantanément votre achat.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-white/5 border border-white/5">
                        <Rocket className="w-5 h-5 text-[#f7931a] mt-0.5 shrink-0" />
                        <div>
                            <h3 className="text-sm font-semibold text-white">Accès Immédiat</h3>
                            <p className="text-xs text-gray-400">Vos rôles sont débloqués en quelques secondes.</p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleDiscordLogin}
                    disabled={isLoading}
                    className="w-full group relative flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-[#5865F2]/25 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Connexion en cours...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg">Connecter mon Discord</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                <p className="mt-6 text-center text-xs text-gray-500">
                    En continuant, vous acceptez de rejoindre notre serveur Discord officiel.
                </p>
            </div>

            {/* Footer */}
            <footer className="mt-8 text-center text-xs text-gray-600 z-10">
                &copy; {new Date().getFullYear()} L'Horizon Crypto. Tous droits réservés.
            </footer>
        </div>
    );
}
