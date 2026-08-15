# 🛠️ RegistBar: Auditoría Técnica & Inventario Arquitectónico

---

## 1. Inventario de Componentes y Módulos Críticos

| Archivo / Módulo | Responsabilidad Principal | Estado Actual | Dependencias Clave | Nivel de Riesgo | Observaciones Técnicas | Prioridad |
| :--- | :--- | :---: | :--- | :---: | :--- | :---: |
| [`App.tsx`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/App.tsx) | Enrutador raíz, layout global, contenedor `max-w-4xl`, FAB y estado de vistas activas. | **Estable** | React 19, AuthContext, Hooks modulados | **Bajo** | Refactorizado y modularizado; mantiene responsive limpio. | P2 |
| [`OfflineService.ts`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/OfflineService.ts) | Sincronización bidireccional entre Dexie local y Supabase PostgreSQL. | **Funcional** | Dexie.js (`db.ts`), Supabase Client | **ALTO (P0)** | **Riesgo de Duplicados:** Las inserciones offline carecen de `client_generated_uuid`. Si la conexión se corta durante un `insert`, el reintento duplica la fila. | **P0** |
| [`db.ts`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/db.ts) | Definición de esquema IndexedDB local con Dexie (`RegistBarDB`). | **Estable** | Dexie 4.4 | **Medio** | Requiere agregar índice por `client_uuid` y `sync_status`. | P1 |
| [`supabase/functions/scan-receipt/index.ts`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/supabase/functions/scan-receipt/index.ts) | Extracción OCR multimodal de CuentaRUT, boletas y vouchers POS. | **Estable** | Groq Vision API, Deno, Supabase Client | **Medio** | Valida secretos de forma segura; requiere descuento atómico de cuotas de usuario en DB. | P1 |
| [`supabase/functions/fiscal-advisor/index.ts`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/supabase/functions/fiscal-advisor/index.ts) | Asesoría financiera IA conversacional con contexto de transacciones. | **Estable** | Cerebras/Groq, Supabase Auth JWT | **Bajo** | Sanitiza datos y respeta `America/Santiago`. | P2 |
| [`components/ReportsView.tsx`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/components/ReportsView.tsx) | Cartola mensual, balance neto, exportación PDF y compartir por WhatsApp. | **Estable** | `@capacitor/share`, `jspdf`, `date-fns-tz` | **Bajo** | Corregido con `formatInTimeZone`. Funciona en web y móvil. | P2 |
| [`components/LoginView.tsx`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/components/LoginView.tsx) | Autenticación Email/Password, Google Auth, Biometría y Registro ergonómico. | **Estable** | `@capacitor/haptics`, Supabase Auth | **Bajo** | Optimizado para 375px y contraste WCAG AA. | P2 |
| [`components/DashboardWidgets.tsx`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/components/DashboardWidgets.tsx) | Tarjetas KPI, meta de ahorro con barra de progreso y balance semanal. | **Estable** | `useCurrency`, Supabase | **Bajo** | Indicador de porcentaje reubicado sin cortes. | P3 |
| [`components/SubscriptionPaywall.tsx`](file:///c:/Users/franc/OneDrive/Documentos/dev/registbar/components/SubscriptionPaywall.tsx) | Modal de bloqueo para funciones Pro (OCR ilimitado, Asesor IA). | **Funcional** | Supabase Profile status | **Medio** | El bloqueo es sólo a nivel visual en UI; debe reforzarse en Edge Functions. | P1 |

---

## 2. Diagrama de Flujo de Datos y Sincronización

```text
[ Acción Usuario: Registrar Corte ]
               │
               ▼
   ¿Hay Conexión a Internet?
       ┌───────┴───────┐
       │ SÍ            │ NO
       ▼               ▼
[ Guarda en Supabase ] [ Guarda en Dexie (is_synced: 0) ]
       │               │
       │               ▼
       │      [ Al recuperar señal ]
       │               │
       └───────►───────┴────────► [ Fused Data Layer: Vista Unificada ]
```

---

## 3. Vulnerabilidades y Deuda Técnica Detectadas

1. **Idempotencia en Sincronización (`OfflineService.ts`):**
   * *Hallazgo:* Los registros creados offline reciben un `id` autoincremental en IndexedDB, pero al subirse a Supabase se insertan con el `id` autogenerado por PostgreSQL.
   * *Riesgo:* Si la red falla a mitad de la sincronización de 5 registros, el siguiente intento re-insertará los mismos datos, duplicando el dinero del barbero.
   * *Solución P0:* Añadir un campo `client_uuid` (generado con `crypto.randomUUID()`) como índice único en Supabase con cláusula `upsert({ onConflict: 'client_uuid' })`.

2. **Validación Server-Side de Cuotas:**
   * *Hallazgo:* Los límites del plan gratuito (5 escaneos OCR/mes) se pueden puentear si un usuario con conocimientos técnicos invoca directamente el endpoint `https://<ref>.supabase.co/functions/v1/scan-receipt` con su JWT.
   * *Solución P1:* La Edge Function debe ejecutar una consulta `UPDATE profiles SET ocr_usage_count = ocr_usage_count + 1 WHERE id = user_id AND ocr_usage_count < 5` antes de invocar la API de visión.
