/**
 * L'Horizon Crypto - Real-time Visitor Tracking
 * Uses Supabase Presence to count active sessions.
 */

const SUPA_URL = 'https://wiylnrufejggmonirbuc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpY3dybWphcGdzZG5xb2RvcWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NTkxMDksImV4cCI6MjA4NDUzNTEwOX0.2ZmdXwcZB3mSTELg1xmyJtZ22XbRMlfeMXXKcmmEka8';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof supabase !== 'undefined') {
        const client = supabase.createClient(SUPA_URL, SUPA_KEY);

        // Join the 'online-users' room
        const channel = client.channel('online-users', {
            config: {
                presence: {
                    key: 'user-' + Math.random().toString(36).substr(2, 9)
                }
            }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                // Count distinct presence keys
                const count = Object.keys(state).length;
                console.log('👥 Live Visitors:', count);

                // Dispatch event for UI updates (e.g. Admin Dashboard)
                window.dispatchEvent(new CustomEvent('visitor-update', { detail: { count } }));

                // Store globally
                window.realtimeVisitorCount = count;
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });
    } else {
        console.warn('⚠️ Supabase client not loaded. Live tracking disabled.');
    }
});
