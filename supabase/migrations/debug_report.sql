-- Consulta de Depuración DETALLADA para: francojbe@gmail.com
-- Muestra los totales Y la lista de transacciones individuales para auditar.

WITH target_user AS (
    SELECT id FROM auth.users WHERE email = 'francojbe@gmail.com' LIMIT 1
),
monthly_data AS (
    SELECT *
    FROM transactions
    WHERE user_id = (SELECT id FROM target_user)
      AND date >= '2025-12-01 00:00:00' 
      AND date <= '2025-12-31 23:59:59'
)
SELECT 
    'RESUMEN' as tipo_fila,
    TO_CHAR(SUM(CASE WHEN type = 'income' THEN COALESCE(gross_amount, amount) ELSE 0 END), 'FM999,999,999') as monto_bruto,
    TO_CHAR(SUM(amount), 'FM999,999,999') as monto_liquido,
    '---' as titulo,
    '---' as fecha
FROM monthly_data

UNION ALL

SELECT 
    'DETALLE' as tipo_fila,
    TO_CHAR(COALESCE(gross_amount, amount), 'FM999,999,999') as monto_bruto,
    TO_CHAR(amount, 'FM999,999,999') as monto_liquido,
    title as titulo,
    TO_CHAR(date, 'DD-MM-YYYY HH24:MI') as fecha
FROM monthly_data
ORDER BY tipo_fila DESC, fecha DESC;
