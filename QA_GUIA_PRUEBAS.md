# 🛡️ Guía de QA y Plan de Pruebas: RegistBar (v1.1.4)

Esta guía detalla los puntos críticos que el equipo de QA debe validar para asegurar que RegistBar sea una herramienta robusta, precisa y premium para los barberos.

## 1. Visión General del Producto
RegistBar es un ERP/Fintech para barberos que permite:
*   Registrar ventas y propinas.
*   Calcular ganancias netas (restando comisiones de salón o arriendos).
*   Gestionar gastos en insumos.
*   Recibir asesoría financiera impulsada por IA.

---

## 2. Flujo Crítico de Negocio (The Golden Paths)

### A. Registro de Servicio (Aha! Moment)
**Objetivo:** Verificar que el registro de una venta sea fluido y preciso.
*   **Prueba:** Registrar un servicio de $15,000 con la comisión configurada en el perfil (ej: 30% o 40%).
*   **Resultado Esperado:** 
    *   Ingreso Líquido: Calculado según la tasa del perfil (ej: para 30% neto es $10,500).
    *   Retención (13.75%): Calculada correctamente sobre el monto líquido.
    *   Sincronización instantánea con el balance semanal del Home.
    *   Aparición automática del servicio en la lista de "Últimos Ingresos".

### B. Gestión de Gastos e Insumos
**Objetivo:** Asegurar que los egresos descuenten correctamente del balance.
*   **Prueba:** Registrar un gasto de $5,000 en "Cuchillas".
*   **Resultado Esperado:** El balance neto (número grande en Home) debe disminuir inmediatamente. El KPI de "Gasto Insumos" debe actualizarse.

### C. Sistema de Metas (Savings)
**Objetivo:** Validar la trazabilidad del ahorro manual.
*   **Prueba:** Agregar un "Aporte Manual" a la meta desde la tarjeta de ahorro.
*   **Resultado Esperado:** 
    *   La barra de progreso debe avanzar. 
    *   Debe crearse una transacción negativa tipo `expense` con el título "Aporte a Ahorro" y la categoría visual "Ahorro".

---

## 3. Pruebas de Onboarding (UX & Retención)

### A. El Checklist del Éxito
**Objetivo:** Validar la guía para nuevos usuarios.
*   **Prueba:** Crear una cuenta nueva de cero.
*   **Validación:**
    1.  ¿Aparece el checklist al inicio?
    2.  Al hacer tap en "Registrar servicio", ¿abre el modal correcto?
    3.  Al completar 3 servicios, ¿el checklist desaparece solo?

### B. Gestión de Notificaciones (Contextual Push)
**Objetivo:** Verificar que la petición de permisos sea oportuna.
*   **Prueba:** Instalar la app por primera vez y NO aceptar notificaciones al inicio (si se pide). Luego, registrar el primer servicio.
*   **Resultado Esperado:** Al recibir el mensaje de "Servicio Guardado", debe aparecer el prompt de solicitud de notificaciones (Solo en Android).

### C. Estados Vacíos (Empty States)
**Objetivo:** Evitar que el usuario se sienta perdido.
*   **Prueba:** Entrar a una cuenta sin transacciones.
*   **Validación:** ¿Se muestra la caja dashed con la flecha animada hacia el botón "+"?

---

## 4. Pruebas de Integración y Seguridad

### A. Autenticación y Perfil
*   **Validación de Biometría:** Intentar login con huella/rostro.
*   **Login Social:** Validar que el login con Google sincronice el alias y email.
*   **Completar Perfil:** Asegurar que si el usuario no tiene `gender` u `ocean/pink` theme, la app lo dirija a `CompleteProfileView`.

### B. Sincronización en la Nube (Supabase)
*   **Prueba de Multi-dispositivo:** Registrar un servicio en un dispositivo y verificar que aparezca en otro en menos de 2 segundos.
*   **FCM Tokens:** Validar en la tabla `user_devices` que el token del dispositivo QA se guarde correctamente al activar notificaciones.

---

## 5. Escenarios de Error y Edge Cases (Robustez)

| Escenario | Comportamiento Esperado |
| :--- | :--- |
| **Sin Conexión (Modo Offline)** | Mostrar toast informativo: "Problema de conexión". No permitir guardar si no hay red. |
| **Monto $0 o Negativo** | Los inputs de precio deben validar montos > 0. |
| **Update Checker (Forced)** | Cambiar `min_version_code` en DB a un valor mayor al de la app. La app debe bloquearse con el modal de "Actualización Requerida". |
| **Deep Links (Recuperar Clave)** | Al hacer clic en email de recuperación, la app debe abrirse directamente en la vista de reseteo de clave. |

---

## 6. Estética y Performance (Checklist Premium)
*   **Animaciones:** Los movimientos entre tabs deben ser suaves (Framer Motion).
*   **Feedback Visual:** Cada acción (guardar, borrar) debe tener un Toast de confirmación (`sonner/toast`).
*   **Carga Inicial:** El Skeleton Loader no debe durar más de 1.5 segundos.
*   **Safe Area:** Validar que los botones superiores e inferiores no queden tapados por el "notch" o la barra de herramientas del teléfono.

---

> [!IMPORTANT]
> **Definición de "Bug Bloqueante" para RegistBar:**
> Cualquier discrepancia de más de $1 CLP en los cálculos financieros se considera un fallo crítico de prioridad máxima.
