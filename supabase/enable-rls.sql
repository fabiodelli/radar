-- Hardening sicurezza: abilita Row Level Security su Radar.
-- Da eseguire UNA VOLTA nel SQL Editor di Supabase.
--
-- Perché: con RLS disabilitato il DB è raggiungibile da chiunque abbia URL + anon key.
-- L'app usa SOLO la service role key lato server, che BYPASSA la RLS: quindi
-- abilitando RLS senza policy, l'app continua a funzionare e l'accesso anon viene negato.

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_runs ENABLE ROW LEVEL SECURITY;

-- Nessuna policy creata di proposito = deny-all per i ruoli non privilegiati (anon/authenticated).
-- La service role continua ad avere pieno accesso (bypassa RLS).
