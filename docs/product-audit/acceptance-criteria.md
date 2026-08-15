# ✅ RegistBar: Criterios de Aceptación & Fórmulas Financieras

---

## 1. Fórmulas Matemáticas Financieras Oficiales

### A. Modelo de Comisión Porcentual
$$\text{Ingreso Bruto} = \sum \text{Servicios} + \sum \text{Propinas}$$
$$\text{Comisión Salón} = \left(\sum \text{Servicios}\right) \times \left(\frac{\% \text{ Salón}}{100}\right)$$
$$\text{Egresos Totales} = \sum \text{Insumos} + \sum \text{Otros Gastos} + \text{Comisión Salón}$$
$$\mathbf{Balance\ Neto\ de\ Bolsillo} = \text{Ingreso Bruto} - \text{Egresos Totales}$$

### B. Modelo de Arriendo de Sillón (Fijo)
$$\text{Ingreso Bruto} = \sum \text{Servicios} + \sum \text{Propinas}$$
$$\text{Deducción Arriendo} = \text{Monto Arriendo (Semanal o Mensual prorrateado)}$$
$$\text{Egresos Totales} = \sum \text{Insumos} + \sum \text{Otros Gastos} + \text{Deducción Arriendo}$$
$$\mathbf{Balance\ Neto\ de\ Bolsillo} = \text{Ingreso Bruto} - \text{Egresos Totales}$$

---

## 2. Casos de Prueba QA y Criterios de Aprobación

| ID Prueba | Caso de Prueba | Resultado Esperado | Criterio de Aprobación |
| :--- | :--- | :--- | :--- |
| **TC-01** | Registro con Comisión 50/50 ($20.000 corte, $2.000 propina). | Bruto: $22.000, Salón: $10.000, Neto: $12.000. | ✅ La propina no se divide con el salón. |
| **TC-02** | Registro con Arriendo Semanal ($50.000 arriendo, $300.000 ventas, $20.000 insumos). | Bruto: $300.000, Egresos: $70.000, Neto: $230.000. | ✅ Arriendo e insumos se deducen del total. |
| **TC-03** | Escaneo OCR CuentaRUT borrosa. | Modal muestra campos extraídos con advertencia de confirmación. | ✅ El usuario puede editar antes de guardar. |
| **TC-04** | Registro en modo avión y reconexión abrupta. | La transacción aparece de inmediato en local y se sube sin duplicarse al conectar. | ✅ Idempotencia confirmada en Supabase. |
