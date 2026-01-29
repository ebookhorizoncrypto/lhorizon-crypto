import { createClient } from '@supabase/supabase-js';

// Init Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder'
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const event = req.body;

        // Verify it's an "invitee.created" event
        if (event.event === 'invitee.created') {
            const payload = event.payload;

            // Extract useful info
            const appointment = {
                email: payload.email,
                name: payload.name,
                event_uri: payload.event,
                invitee_uri: payload.uri,
                status: payload.status,
                start_time: payload.scheduled_event.start_time,
                end_time: payload.scheduled_event.end_time,
                created_at: payload.created_at,
                calendly_event_type: payload.event_type_name || 'Coaching VIP'
            };

            // Insert into Supabase
            const { error } = await supabase
                .from('appointments')
                .upsert(appointment, { onConflict: 'invitee_uri' });

            if (error) {
                console.error('Supabase Error:', error);
                return res.status(500).json({ error: 'Database error' });
            }

            console.log(`✅ Appointment saved: ${appointment.email} at ${appointment.start_time}`);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
}
