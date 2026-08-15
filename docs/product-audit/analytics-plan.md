# 📊 RegistBar: Plan de Instrumentación Analítica & Métricas de PMF

---

## 1. Taxonomía de Eventos Clave (Product Analytics)

| Evento | Momento de Disparo | Parámetros Registrados (Sin PII) | Objetivo de Negocio |
| :--- | :--- | :--- | :--- |
| `app_install_opened` | Primera apertura de la app. | `platform` (pwa/android), `app_version` | Medir descargas efectivas. |
| `onboarding_completed` | Configuración de modelo económico. | `expense_model` (comisión/arriendo), `currency` | Tasa de finalización del onboarding. |
| `first_transaction_logged` | Primer ingreso o corte registrado. | `method` (manual/ocr), `payment_type` (efectivo/transferencia) | **Momento "Aha!" del barbero (< 3 min).** |
| `ocr_scan_attempted` | Usuario toca escanear foto. | `source` (camera/gallery) | Adopción del escáner. |
| `ocr_scan_confirmed` | Usuario guarda la transacción extraída. | `duration_seconds`, `was_edited` (true/false) | Tasa de acierto y fricción del OCR. |
| `daily_close_viewed` | Abre la pestaña de Reportes/Cierre. | `period_month`, `transaction_count` | Hábito de control financiero. |
| `whatsapp_share_clicked` | Toca "Compartir Cierre por WhatsApp". | `platform`, `net_balance_bucket` | **Acción de Retención y Rendición.** |
| `ai_advisor_prompted` | Envía pregunta o toca chip de IA. | `prompt_type` (chip/custom), `is_pro` | Enganchamiento con el Asesor IA. |

---

## 2. Métricas del Cuadro de Mando (Dashboard de Tracción)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ EMBLEMÁTICAS (NORTH STAR METRICS)                                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Transacciones Registradas por Usuario Activo Semanal (WAU) (Meta: >12)│
│ 2. Cierres Compartidos por WhatsApp por Semana (Meta: > 4 cierres/sem) │
│ 3. Retención Día 7 (Meta: > 45%)                                       │
│ 4. Retención Día 30 (Meta: > 28%)                                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Principios de Privacidad en Analítica
* **Cero Telemetría de Montos Exactos o RUT:** Solo se registran rangos o categorías para preservar el secreto financiero del profesional.
* **Cero Almacenamiento de Imágenes:** Las fotos de comprobantes nunca se envían a plataformas de telemetría.
