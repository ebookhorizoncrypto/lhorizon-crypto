/**
 * L'Horizon Crypto - Real-time Visitor Tracking
 * Uses Supabase Presence to count active sessions.
 */

const SUPA_URL = 'https://dicwrmjapgsdnqodoqfb.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpY3dybWphcGdzZG5xb2RvcWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NTkxMDksImV4cCI6MjA4NDUzNTEwOX0.2ZmdXwcZB3mSTELg1xmyJtZ22XbRMlfeMXXKcmmEka8';

document.addEventListener('DOMContentLoaded', () => {
    // Check for global supabase object (handled specifically for CDN)
    const supabaseClient = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);

    if (supabaseClient) {
        console.log('🔹 Supabase Client Found. Initializing...');

        try {
            const client = supabaseClient.createClient(SUPA_URL, SUPA_KEY);

            // Join a public channel
            const channel = client.channel('public-tracking', {
                config: {
                    presence: {
                        key: 'user-' + Math.random().toString(36).substr(2, 9)
                    },
                    broadcast: { self: true } // Explicitly enable broadcast
                }
            });

            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    const count = Object.keys(state).length;
                    console.log('✅ Presence Sync:', count);
                    window.dispatchEvent(new CustomEvent('visitor-update', { detail: { count } }));
                })
                .on('presence', { event: 'join' }, ({ key }) => console.log('👤 Joined:', key))
                .on('presence', { event: 'leave' }, ({ key }) => console.log('👋 Left:', key))
                .subscribe(async (status, err) => {
                    console.log('📡 Channel Status:', status);
                    if (err) console.error('❌ Channel Error Details:', err);

                    if (status === 'SUBSCRIBED') {
                        await channel.track({ online_at: new Date().toISOString() });
                    }
                });

        } catch (err) {
            console.error('❌ Supabase Init Error:', err);
        }

    } else {
        console.error('❌ Supabase script not loaded. Check your internet connection or CDN URL.');
    }
});
