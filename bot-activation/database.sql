-- ═══════════════════════════════════════════════════════════════
--              TABLE CUSTOMERS POUR L'HORIZON
-- ═══════════════════════════════════════════════════════════════

-- Supprime la table si elle existe (attention en prod !)
-- DROP TABLE IF EXISTS customers;

-- Crée la table customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Infos client
    email TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT,
    
    -- Infos Discord
    discord_id TEXT,
    discord_username TEXT,
    
    -- Abonnement
    access_level TEXT DEFAULT 'SOLO' CHECK (access_level IN ('SOLO', 'PRO', 'VIP', 'expired', 'cancelled')),
    subscription_status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    
    -- Tracking
    role_assigned BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_discord_id ON customers(discord_id);
CREATE INDEX IF NOT EXISTS idx_customers_expires_at ON customers(expires_at);
CREATE INDEX IF NOT EXISTS idx_customers_access_level ON customers(access_level);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
--              POLITIQUES RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════

-- Active RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Politique: le service role peut tout faire
CREATE POLICY "Service role full access" ON customers
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
--              EXEMPLE DE DONNÉES (pour tester)
-- ═══════════════════════════════════════════════════════════════

-- INSERT INTO customers (email, access_level, expires_at)
-- VALUES ('test@example.com', 'SOLO', NOW() + INTERVAL '30 days');
