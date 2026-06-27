-- Radar — Schema Supabase
-- Esegui questo file nel SQL Editor di Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELLA: prospects
-- ============================================================
CREATE TABLE prospects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chiave stabile Google (unico campo Places persistibile)
  place_id             TEXT UNIQUE NOT NULL,

  -- Dati propri (non provengono da Google, persistibili)
  comune               TEXT,
  categoria            TEXT,
  website_url          TEXT,
  website_status       TEXT CHECK (website_status IN ('none','social_only','dated','decent','recent')),
  email_generic        TEXT,
  email_nominative     TEXT,
  email_type           TEXT CHECK (email_type IN ('generic','nominative','none')),
  canale_consigliato   TEXT CHECK (canale_consigliato IN ('email','visita','telefono','telefono_e_email')),

  -- Score e dossier calcolati dal pipeline
  weakness_score       INTEGER DEFAULT 0,
  angolo_suggerito     TEXT,
  signals              JSONB DEFAULT '{}'::jsonb,

  -- Campi gestiti da Fabio (non sovrascrivere in upsert)
  flag_potenziale      TEXT CHECK (flag_potenziale IN ('basso','medio','alto')),
  note                 TEXT,
  servizi_proponibili  TEXT[] DEFAULT '{}',
  stato                TEXT NOT NULL DEFAULT 'nuovo'
                         CHECK (stato IN (
                           'nuovo','da_vagliare','vagliato','da_contattare',
                           'contattato','follow_up','in_trattativa',
                           'cliente','scartato','suppression'
                         )),
  prossimo_followup    DATE,
  lia_note             TEXT,
  screenshot_url       TEXT,

  -- Provenienza dati (GDPR)
  provenienza          JSONB DEFAULT '[]'::jsonb,

  -- Timestamp
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_screened_at     TIMESTAMPTZ,
  last_checked_at      TIMESTAMPTZ
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indici per le query principali
CREATE INDEX idx_prospects_stato          ON prospects (stato);
CREATE INDEX idx_prospects_comune         ON prospects (comune);
CREATE INDEX idx_prospects_weakness_score ON prospects (weakness_score DESC);
CREATE INDEX idx_prospects_categoria      ON prospects (categoria);
CREATE INDEX idx_prospects_followup       ON prospects (prossimo_followup)
  WHERE prossimo_followup IS NOT NULL;

-- ============================================================
-- TABELLA: screening_runs
-- ============================================================
CREATE TABLE screening_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query        JSONB NOT NULL,    -- {categorie: string[], comuni: string[], threshold: int}
  eseguita_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  n_trovati    INTEGER DEFAULT 0,
  n_nuovi      INTEGER DEFAULT 0
);

-- ============================================================
-- RLS: strumento personale, uso service role key server-side
-- Disabilitato per semplicità; la protezione è nel middleware auth.
-- ============================================================
ALTER TABLE prospects DISABLE ROW LEVEL SECURITY;
ALTER TABLE screening_runs DISABLE ROW LEVEL SECURITY;
