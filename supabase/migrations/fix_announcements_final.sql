-- 1. Add 'title' column if it doesn't exist
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS title text;

-- 2. Add 'user_id' column if it doesn't exist (for targeted notifications)
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id);

-- 3. Drop existing policy to ensure we have the correct one
DROP POLICY IF EXISTS "Users see global and personal announcements" ON public.announcements;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.announcements;

-- 4. Create correct RLS policy
CREATE POLICY "Users see global and personal announcements"
ON public.announcements FOR SELECT
TO authenticated
USING (
  (user_id IS NULL) OR (user_id = auth.uid())
);

-- 5. Enable RLS (just in case)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
