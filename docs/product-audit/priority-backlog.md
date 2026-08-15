# 📋 RegistBar: Backlog Priorizado (P0 / P1 / P2 / P3 / P4)

> **Fórmula de Priorización:** $\text{Score} = \frac{\text{Impacto (1-5)} \times \text{Confianza (1-5)} \times \text{Urgencia (1-5)}}{\text{Esfuerzo (1-5)}}$

---

## Tabla de Tareas Priorizadas

| ID | Prioridad | Título de la Tarea | Problema que Resuelve | Archivos Afectados | Esfuerzo | Impacto | Score |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| **SEC-01** | **P0** | **Idempotencia en Sincronización Offline** | Previene que reintentos de red dupliquen ingresos del barbero. | `OfflineService.ts`, `db.ts`, Supabase Schema | 2 | 5 | **37.5** |
| **SEC-02** | **P0** | **Validación de Cuotas de OCR en Edge Function** | Evita que usuarios gratuitos puenteen el límite de 5 escaneos por HTTP. | `supabase/functions/scan-receipt/index.ts` | 2 | 4 | **24.0** |
| **ONB-01** | **P1** | **Onboarding Progresivo de 3 Pasos** | Aumenta la activación inicial sin forzar configuraciones complejas. | `components/OnboardingChecklist.tsx` | 2 | 5 | **30.0** |
| **ANA-01** | **P1** | **Instrumentación de Eventos de Cierre y Retención** | Permite medir retención D1/D7 y uso del cierre por WhatsApp. | `components/ReportsView.tsx`, `App.tsx` | 2 | 4 | **20.0** |
| **REG-01** | **P1** | **Selector Rápido de Servicios Frecuentes en 1 Tap** | Reduce el tiempo de registro manual de 8s a menos de 4s. | `components/NewServiceModal.tsx` | 2 | 4 | **20.0** |
| **PAY-01** | **P2** | **Integración de Pasarela de Pagos (Mercado Pago Chile)** | Permite cobrar $4.990 CLP mensuales de forma automatizada. | `components/SubscriptionPaywall.tsx` | 3 | 5 | **16.6** |
| **AI-01** | **P2** | **Guardrail de Incertidumbre y Verificación en Asesor IA** | Añade advertencias cuando faltan datos de gastos o arriendo. | `supabase/functions/fiscal-advisor/index.ts` | 2 | 3 | **13.5** |
| **REP-01** | **P3** | **Filtro de Cierre Semanal / Mensual en WhatsApp** | Permite enviar el cierre semanal de sillón además del mensual. | `components/ReportsView.tsx` | 1 | 3 | **9.0** |
| **B2B-01** | **P4** | **Panel Multi-Barbero para Dueño de Salón** | Funcionalidad B2B futura (post-validación individual). | *Nuevo módulo B2B* | 5 | 3 | **3.0** |
