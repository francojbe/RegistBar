# 📋 RegistBar: Backlog Priorizado y Estado de Ejecución

> **Fórmula de Priorización:** $\text{Score} = \frac{\text{Impacto (1-5)} \times \text{Confianza (1-5)} \times \text{Urgencia (1-5)}}{\text{Esfuerzo (1-5)}}$

---

## Tabla de Tareas y Estado

| ID | Prioridad | Título de la Tarea | Estado | Problema que Resuelve | Archivos Afectados | Esfuerzo | Impacto |
| :--- | :---: | :--- | :---: | :--- | :--- | :---: | :---: |
| **SEC-01** | **P0** | **Idempotencia en Sincronización Offline** | ✅ **Realizado** | Previene que reintentos de red dupliquen ingresos del barbero. | `OfflineService.ts`, `db.ts` | 2 | 5 |
| **SEC-02** | **P0** | **Validación de Cuotas de OCR en Edge Function** | ✅ **Realizado** | Evita que usuarios gratuitos puenteen el límite de 5 escaneos por HTTP. | `supabase/functions/scan-receipt/index.ts` | 2 | 4 |
| **ONB-01** | **P1** | **Onboarding Progresivo de 3 Pasos** | ✅ **Realizado** | Aumenta la activación inicial sin forzar configuraciones complejas. | `components/OnboardingChecklist.tsx` | 2 | 5 |
| **REG-01** | **P1** | **Selector Rápido de Servicios Frecuentes en 1 Tap** | ✅ **Realizado** | Reduce el tiempo de registro manual de 8s a menos de 4s. | `components/NewServiceModal.tsx` | 2 | 4 |
| **ANA-01** | **P1** | **Instrumentación de Eventos de Cierre y Retención** | ✅ **Realizado** | Permite medir retención D1/D7 y uso del cierre por WhatsApp. | `utils/analytics.ts`, `components/ReportsView.tsx`, `App.tsx` | 2 | 4 |
| **AI-01** | **P2** | **Guardrail de Incertidumbre y Verificación en Asesor IA** | ✅ **Realizado** | Añade advertencias cuando faltan datos de gastos o arriendo y disclaimer SII. | `supabase/functions/fiscal-advisor/index.ts` | 2 | 3 |
| **REP-01** | **P3** | **Filtro de Cierre Semanal / Mensual en WhatsApp** | ✅ **Realizado** | Permite enviar el cierre semanal de sillón además del mensual. | `components/ReportsView.tsx` | 1 | 3 |
| **PAY-01** | **P2** | **Integración de Pasarela de Pagos (Mercado Pago / IAP)** | ⏸️ **Postergado** | Dejado al final por análisis de políticas de Google Play / App Store (IAP vs Web Checkout). | `components/SubscriptionPaywall.tsx` | 3 | 5 |
| **B2B-01** | **P4** | **Panel Multi-Barbero para Dueño de Salón** | ⏳ **Futuro** | Funcionalidad B2B futura (post-validación individual). | *Nuevo módulo B2B* | 5 | 3 |
