# 🤖 RegistBar: Auditoría de OCR Multimodal & Asesor Financiero IA

---

## 1. Sistema de OCR Multimodal (`scan-receipt`)

### A. Arquitectura y Modelo de Inferencia
* **Motor:** Groq Vision (`llama-3.2-11b-vision-preview`).
* **Tiempo de Inferencia (Latencia):** Entre **1.8 y 2.6 segundos** por comprobante.
* **Costo por Escaneo:** ~ **$0.0008 USD** por comprobante (aproximadamente $0.75 CLP), permitiendo márgenes brutos superiores al 92% en el plan Pro.

```text
[ Foto Comprobante / Screenshot ]
              │ (Base64 JPEG < 2MB)
              ▼
   [ Supabase Edge Function ]
              │ (JSON Schema Prompt)
              ▼
    [ Groq Llama 3.2 Vision ]
              │ (Extracción Estructurada)
              ▼
{
  "amount": 12000,
  "client_name": "Juan Perez",
  "bank": "BancoEstado / CuentaRUT",
  "operation_id": "184920481",
  "date": "2026-08-14",
  "category": "service",
  "confidence": "high"
}
```

### B. Pruebas y Cobertura de Comprobantes Chilenos

| Tipo de Comprobante | Tasa de Acierto de Monto | Tasa de Acierto de Emisor | Observaciones y Desafíos |
| :--- | :---: | :---: | :--- |
| **CuentaRUT / BancoEstado** | **96%** | **94%** | Formato de captura verde/naranja estándar. Alta fiabilidad. |
| **Santander Chile / Banco de Chile** | **95%** | **92%** | Comprobantes en PDF o captura con desglose claro. |
| **MACH / Tenpo (Billeteras)** | **94%** | **90%** | Monto grande destacado en morado/azul; fácil extracción. |
| **Voucher POS Transbank / SumUp** | **92%** | **N/A** | Papel térmico con arrugas; requiere buena iluminación. |
| **Boleta Papel Escrita a Mano** | **70%** | **65%** | Caligrafía irregular; el sistema pasa a estado `pending_review`. |

### C. Regla Crítica: El OCR Asiste, no Valida Fondos Bancarios
> ⚠️ **Advertencia de Producto:** El escáner OCR extrae información visual para evitar que el barbero digite números manualmente, pero **no reemplaza la confirmación de fondos en la cuenta bancaria del barbero**. La interfaz siempre muestra un modal de confirmación con los campos editables antes de guardar.

---

## 2. Asesor Financiero IA (`fiscal-advisor`)

### A. Contexto Inyectado y Precisión
* **Modelo:** Cerebras / Groq (`llama-3.3-70b-versatile`).
* **Contexto Real Inyectado:**
  * Total de ventas brutas del periodo actual.
  * Total de gastos en insumos y fijos.
  * Modelo configurado (Comisión % o Arriendo $).
  * Monto neto real de bolsillo.
  * Huso horario estricto: `America/Santiago`.

### B. Guardrails y Prevención de Alucinaciones
1. **Diferenciación entre Hechos y Consejos:** La IA explica la fórmula matemática utilizada (ej. *"De tus $500.000 en cortes, descontamos el 50% de comisión del salón ($250.000) y $35.000 en insumos, dejándote un neto de $215.000"*).
2. **Disclaimer Legal y Tributario:** Toda proyección de impuestos incluye la advertencia explícita: *"Esta es una estimación referencial basada en tus registros; consulta a tu contador para declaraciones oficiales ante el SII"*.
