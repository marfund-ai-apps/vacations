-- ============================================================
-- SCRIPT: Eliminar todas las solicitudes de vacaciones
-- ALCANCE: vacation_requests, request_date_ranges,
--          request_history, approval_tokens
-- NO TOCA:  users, user_day_adjustments, sessions
-- ============================================================
-- PRECAUCIÓN: Esta operación es irreversible.
-- Ejecutar primero en ambiente de pruebas.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE approval_tokens;
TRUNCATE TABLE request_history;
TRUNCATE TABLE request_date_ranges;
TRUNCATE TABLE vacation_requests;

SET FOREIGN_KEY_CHECKS = 1;

-- Verificación: las tablas de usuarios y ajustes quedan intactas
SELECT 'users' AS tabla, COUNT(*) AS registros FROM users
UNION ALL
SELECT 'user_day_adjustments', COUNT(*) FROM user_day_adjustments
UNION ALL
SELECT 'vacation_requests', COUNT(*) FROM vacation_requests
UNION ALL
SELECT 'approval_tokens', COUNT(*) FROM approval_tokens
UNION ALL
SELECT 'request_history', COUNT(*) FROM request_history
UNION ALL
SELECT 'request_date_ranges', COUNT(*) FROM request_date_ranges;
