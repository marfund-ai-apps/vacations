-- ============================================================
-- SCRIPT: Eliminar todas las solicitudes de vacaciones
-- ALCANCE: vacation_requests, request_date_ranges,
--          request_history, approval_tokens
-- NO TOCA:  users, user_day_adjustments, sessions
-- ============================================================
-- PRECAUCIÓN: Esta operación es irreversible.
-- Se usa DELETE FROM en orden correcto (hijas primero)
-- para respetar las FK sin desactivar las verificaciones.
-- ============================================================

-- 1. Tablas hijas primero (dependen de vacation_requests)
DELETE FROM approval_tokens;
DELETE FROM request_history;
DELETE FROM request_date_ranges;

-- 2. Tabla principal
DELETE FROM vacation_requests;

-- 3. Reiniciar el AUTO_INCREMENT para que el correlativo VAC- arranque limpio
ALTER TABLE vacation_requests AUTO_INCREMENT = 1;

-- Verificación: users y ajustes deben conservar sus registros
SELECT 'users'                AS tabla, COUNT(*) AS registros FROM users
UNION ALL
SELECT 'user_day_adjustments',          COUNT(*)              FROM user_day_adjustments
UNION ALL
SELECT 'vacation_requests',             COUNT(*)              FROM vacation_requests
UNION ALL
SELECT 'approval_tokens',               COUNT(*)              FROM approval_tokens
UNION ALL
SELECT 'request_history',               COUNT(*)              FROM request_history
UNION ALL
SELECT 'request_date_ranges',           COUNT(*)              FROM request_date_ranges;
