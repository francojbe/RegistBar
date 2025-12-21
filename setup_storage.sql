-- 1. Crear el bucket 'receipts' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Configurar políticas de seguridad (RLS) para el Storage
-- Permitir al usuario ver sus propios archivos (Select)
CREATE POLICY "Permitir ver propias facturas"
ON storage.objects FOR SELECT
USING ( bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Permitir al usuario subir archivos a su propia carpeta (Insert)
CREATE POLICY "Permitir subir facturas propias"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1] );

-- 3. Agregar columna 'receipt_url' a la tabla transactions si no existe
ALTER TABLE "public"."transactions" 
ADD COLUMN IF NOT EXISTS "receipt_url" text;
