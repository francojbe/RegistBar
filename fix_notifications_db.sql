-- TABLA PARA SINCRONIZAR NOTIFICACIONES LEIDAS
-- Ejecuta esto en el SQL Editor de Supabase para corregir el problema de notificaciones que reaparecen.

-- 1. Crear la tabla de lecturas si no existe
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    announcement_id BIGINT REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, announcement_id)
);

-- 2. Habilitar seguridad (RLS)
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de acceso (Permitir a los usuarios insertar y ver SU propia data)
DROP POLICY IF EXISTS "Users can insert their own reads" ON public.announcement_reads;
CREATE POLICY "Users can insert their own reads" ON public.announcement_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reads" ON public.announcement_reads;
CREATE POLICY "Users can view their own reads" ON public.announcement_reads
    FOR SELECT USING (auth.uid() = user_id);

-- 4. Confirmación
SELECT 'Tabla announcement_reads configurada correctamente' as result;
