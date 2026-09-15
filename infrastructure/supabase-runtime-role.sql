-- Run AFTER Alembic upgrade, as the Supabase database administrator.
-- Runtime role has DML access only to app tables. It cannot access auth schema.
-- This role is trusted backend-only; FastAPI enforces per-user ownership.
-- RLS deliberately denies all browser Data API access to these tables.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='travel_app') THEN
  CREATE ROLE travel_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO travel_app;
ALTER ROLE travel_app SET statement_timeout = '20s';
ALTER ROLE travel_app SET lock_timeout = '5s';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.users;
CREATE POLICY backend_only ON public.users FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.profiles;
CREATE POLICY backend_only ON public.profiles FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destinations TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.destinations;
CREATE POLICY backend_only ON public.destinations FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.trips;
CREATE POLICY backend_only ON public.trips FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_destinations TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.trip_destinations;
CREATE POLICY backend_only ON public.trip_destinations FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_snapshots TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.weather_snapshots;
CREATE POLICY backend_only ON public.weather_snapshots FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_forecasts TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.weather_forecasts;
CREATE POLICY backend_only ON public.weather_forecasts FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.activities;
CREATE POLICY backend_only ON public.activities FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.itineraries;
CREATE POLICY backend_only ON public.itineraries FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_items TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.itinerary_items;
CREATE POLICY backend_only ON public.itinerary_items FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_lists TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.packing_lists;
CREATE POLICY backend_only ON public.packing_lists FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_items TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.packing_items;
CREATE POLICY backend_only ON public.packing_items FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_alerts TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.weather_alerts;
CREATE POLICY backend_only ON public.weather_alerts FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.notifications;
CREATE POLICY backend_only ON public.notifications FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_destinations TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.saved_destinations;
CREATE POLICY backend_only ON public.saved_destinations FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_history TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.search_history;
CREATE POLICY backend_only ON public.search_history FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.ai_conversations;
CREATE POLICY backend_only ON public.ai_conversations FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.ai_messages;
CREATE POLICY backend_only ON public.ai_messages FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.audit_logs;
CREATE POLICY backend_only ON public.audit_logs FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_plans TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.trip_plans;
CREATE POLICY backend_only ON public.trip_plans FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_shares TO travel_app;
DROP POLICY IF EXISTS backend_only ON public.trip_shares;
CREATE POLICY backend_only ON public.trip_shares FOR ALL TO travel_app USING (true) WITH CHECK (true);
GRANT SELECT ON public.alembic_version TO travel_app;
-- Set a strong random password separately in a secure admin session:
-- ALTER ROLE travel_app PASSWORD '<generated password>';
-- Never commit the actual password. Revoke unused Data API default grants in Supabase.

-- Future application migrations must explicitly grant backend access and enable RLS.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
