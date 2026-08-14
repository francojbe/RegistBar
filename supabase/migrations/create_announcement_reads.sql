-- Create table for tracking read announcements across devices
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    announcement_id BIGINT REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, announcement_id)
);

-- Enable RLS
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own reads" ON public.announcement_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reads" ON public.announcement_reads
    FOR SELECT USING (auth.uid() = user_id);
