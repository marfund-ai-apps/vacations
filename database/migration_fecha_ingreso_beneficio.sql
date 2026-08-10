-- ============================================================
-- Migración: Fecha de Ingreso y Días de Beneficio por Años Laborales
-- Correr UNA sola vez en producción.
-- ============================================================

-- 1) Nuevas columnas en users
ALTER TABLE users
  ADD COLUMN fecha_ingreso DATE NULL AFTER position,
  ADD COLUMN dias_beneficio_anno_laboral INT NOT NULL DEFAULT 0 AFTER fecha_ingreso;

-- 2) Backfill inicial (SOLO la primera vez) — referencia FIJA: 1 de enero de 2026
--    Regla: bono asignado en enero, por año calendario, a partir del 1.er enero
--    posterior al 3.er aniversario. Fórmula: min(max(2026 - YEAR(fecha_ingreso) - 3, 0), 10)
--    Ej.: ingreso 2022 -> 1 · 2020 -> 3 · 2013 o antes -> 10 (tope) · 2023+ -> 0
UPDATE users
SET dias_beneficio_anno_laboral = LEAST(GREATEST(2026 - CAST(YEAR(fecha_ingreso) AS SIGNED) - 3, 0), 10)
WHERE fecha_ingreso IS NOT NULL;
