
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Self-insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
