# 📶 RegistBar: Auditoría de Persistencia Offline & Sincronización

---

## 1. Esquema de Persistencia Local (Dexie.js / IndexedDB)

```typescript
// Esquema actual en db.ts:
export interface LocalTransaction {
  id?: number;
  user_id: string;
  is_synced: 0 | 1; // 0 = pendiente de sincronizar, 1 = sincronizado
  payload: any;
  created_at: number;
}
```

---

## 2. Evaluación de Escenarios de Conectividad

| Escenario de Red | Comportamiento Actual | Estado | Riesgo / Observación |
| :--- | :--- | :---: | :--- |
| **Sin conexión al abrir la app** | Carga transacciones desde IndexedDB y caché local. | ✅ Correcto | La app abre al instante sin pantalla blanca. |
| **Registrar corte en modo avión** | Se almacena en Dexie con `is_synced: 0`. | ✅ Correcto | El barbero no se bloquea; el balance local se actualiza. |
| **Recuperación de señal de red** | `OfflineService.syncPendingTransactions()` se dispara automáticamente. | ⚠️ Precaución | Si falla la red a mitad de camino, puede haber reintentos duplicados. |
| **Dos cambios sobre el mismo registro** | Supabase aplica la última actualización (`Last-Write-Wins`). | ✅ Aceptable | Para un solo barbero en un móvil, el conflicto multi-dispositivo es mínimo. |

---

## 3. Plan de Mejora P0: Idempotencia y Blindaje de Sincronización

```text
ESTADO ACTUAL (Vulnerable a duplicación):
[ Local ID: 12 ] ──(POST /transactions)──► [ Supabase ID: 89432 ]
* Si la respuesta HTTP se pierde en un túnel o metro, el cliente reintenta y crea ID: 89433 (Duplicado).

ESTADO PROPUESTO BLINDADO (Idempotente):
[ Local Client UUID: 7a3f-... ] ──(UPSERT onConflict: client_uuid)──► [ Supabase ]
* Reintentos infinitos jamás duplicarán el dinero ni los registros del barbero.
```

### Acciones Recomendadas:
1. Agregar columna `client_uuid UUID UNIQUE` en la tabla `transactions` de Supabase.
2. Mostrar un indicador visual sutil en el dashboard:
   * 🟢 *Sincronizado*
   * 🟡 *3 movimientos pendientes de subir* (guardados de forma segura en tu teléfono).
