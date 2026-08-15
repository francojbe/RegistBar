# 🔒 RegistBar: Auditoría de Seguridad, RLS & Privacidad de Datos

---

## 1. Inspección de Secretos y Variables de Entorno

| Tipo de Secreto / Credencial | Ubicación Actual | Nivel de Exposición | Riesgo | Estado & Recomendación |
| :--- | :--- | :---: | :---: | :--- |
| `VITE_SUPABASE_URL` | Frontend `.env.local` | Pública por diseño | Ninguno | Clave pública requerida para inicializar el cliente Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Frontend `.env.local` | Pública (Limitada por RLS) | Bajo | Clave pública para usuarios anónimos/autenticados. Protegida por RLS en PostgreSQL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Vault / Secrets | **Server-side exclusivo** | **Crítico** | **Verificado:** NO está expuesto en el frontend, PWA ni en el código del APK. |
| `GROQ_API_KEY` | Supabase Vault / Edge Functions | **Server-side exclusivo** | **Alto** | **Verificado:** Invocada únicamente en `supabase/functions/scan-receipt/index.ts`. |
| `CEREBRAS_API_KEY` | Supabase Vault / Edge Functions | **Server-side exclusivo** | **Alto** | **Verificado:** Invocada únicamente en `supabase/functions/fiscal-advisor/index.ts`. |

---

## 2. Auditoría de Row Level Security (RLS) en Supabase

```sql
-- Estructura de aislamiento por usuario validada:
-- 1. Tabla: transactions
CREATE POLICY "Users can only view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

-- 2. Tabla: profiles
CREATE POLICY "Users can only manage their own profile"
ON public.profiles FOR ALL
USING (auth.uid() = id);
```

### Hallazgos de Seguridad en RLS:
1. **Aislamiento Multi-Tenant Completo:** Un usuario `A` no puede leer, modificar ni listar transacciones de un usuario `B`. Los intentos directos devuelven un conjunto vacío o error `403 Forbidden`.
2. **Imposibilidad de Suplantar `user_id`:** Las políticas `WITH CHECK (auth.uid() = user_id)` impiden que un cliente envíe una transacción asignada a otro barbero.

---

## 3. Privacidad y Tratamiento de Comprobantes Bancarios
* **Procesamiento Efímero de Imágenes:** Las fotos de capturas de transferencias o boletas tomadas por la cámara son convertidas a base64 en memoria del dispositivo, enviadas por HTTPS cifrado a la Edge Function `scan-receipt`, analizadas por el modelo de visión y **descartadas de inmediato**.
* **Cero Almacenamiento de Fotos Sensibles:** No existe una tabla o bucket de almacenamiento público donde queden guardadas capturas bancarias con números de cuenta o RUT de terceros.
* **Biometría Segura:** La librería `capacitor-native-biometric` delega la autenticación en el enclave de seguridad nativo de Android (BiometricPrompt / Keystore), sin almacenar contraseñas en texto plano.
