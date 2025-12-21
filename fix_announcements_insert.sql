-- Allow authenticated users (like the admin) to insert new announcements
CREATE POLICY "Enable insert for authenticated users"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (true);
