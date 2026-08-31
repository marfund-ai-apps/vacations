-- ============================================================
-- Migración: auto-split de vacaciones (base + bono)
-- Vincula las dos partidas de una solicitud dividida para aprobarse/anularse juntas.
-- Correr UNA sola vez.
-- ============================================================
ALTER TABLE vacation_requests
  ADD COLUMN split_group_id VARCHAR(36) NULL AFTER request_number;

-- Índice para agrupar rápido
CREATE INDEX idx_vr_split_group ON vacation_requests (split_group_id);
