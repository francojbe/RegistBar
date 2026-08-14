-- Add user_id column to announcements table to allow targeted notifications
ALTER TABLE public.announcements
ADD COLUMN user_id uuid references auth.users(id);

-- Add logic to announcements queries so users can see:
-- 1. Global announcements (user_id IS NULL)
-- 2. Their own announcements (user_id = auth.uid())

-- We might need to update RLS policies if they exist.
-- Let's drop existing policy and create a comprehensive one
DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON public.announcements;

CREATE POLICY "Users see global and personal announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (
  (user_id IS NULL) OR (user_id = auth.uid())
);
