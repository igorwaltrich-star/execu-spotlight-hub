-- Restrict Realtime channel subscriptions. This app only uses postgres_changes
-- (which already respects per-row RLS on source tables). Deny Broadcast and
-- Presence by default so no user can subscribe to arbitrary topics and
-- receive other users' data.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow postgres_changes for authenticated" ON realtime.messages;
CREATE POLICY "Allow postgres_changes for authenticated"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.messages.extension = 'postgres_changes');
