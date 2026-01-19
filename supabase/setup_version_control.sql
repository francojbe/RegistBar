-- 1. Crear la tabla de control de versiones
CREATE TABLE IF NOT EXISTS public.app_version_control (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL, -- 'android', 'ios', etc.
    min_version_code INTEGER DEFAULT 1, -- Versión mínima requerida
    latest_version_code INTEGER DEFAULT 1, -- Versión más nueva disponible
    force_update BOOLEAN DEFAULT false, -- Si es TRUE, bloquea la app
    update_message TEXT DEFAULT 'Nueva versión disponible', -- Mensaje para el usuario
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform) -- Solo una fila por plataforma
);

-- 2. Habilitar seguridad (Row Level Security)
ALTER TABLE public.app_version_control ENABLE ROW LEVEL SECURITY;

-- 3. Permitir que CUALQUIERA lea esta tabla (necesario para que la app sepa si actualizar)
CREATE POLICY "Public read access" ON public.app_version_control
    FOR SELECT TO anon, authenticated USING (true);

-- 4. Permitir que solo el SERVICIO (Dashboard) pueda modificarla
CREATE POLICY "Service role write access" ON public.app_version_control
    FOR ALL TO service_role USING (true);

-- 5. Insertar la configuración inicial para Android (Versión 1.0.7 = Código 8)
INSERT INTO public.app_version_control (platform, min_version_code, latest_version_code, force_update, update_message)
VALUES ('android', 8, 8, false, '¡Tenemos mejoras! Actualiza para disfrutar de lo último.')
ON CONFLICT (platform) DO NOTHING;
