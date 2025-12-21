-- SOLUCION PARA SINCRONIZACION DE NOTIFICACIONES
-- Ejecuta este script en el Editor SQL de Supabase para crear la tabla de 'Leídos'

CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    announcement_id bigint REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
    read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, announcement_id)
);

-- Habilitar seguridad
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Users can insert their own reads" ON public.announcement_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own reads" ON public.announcement_reads
    FOR SELECT USING (auth.uid() = user_id);

-- Opcional: Permitir borrar (si quieres 'marcar como no leído' en el futuro)
CREATE POLICY "Users can delete their own reads" ON public.announcement_reads
    FOR DELETE USING (auth.uid() = user_id);
