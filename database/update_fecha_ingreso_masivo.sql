-- ============================================================
-- Carga masiva de fecha_ingreso por código de colaborador (employee_number)
-- Fecha: 23/07/2026
-- Fuente: CSV "fecha ingreso" cruzado con la BD actual (match por nombre -> código)
-- Formato de fecha convertido de "d-mmm-yy" (es) a 'YYYY-MM-DD'
--
-- REVISAR antes de correr:
--  * 1134 Liz Herrera  <-  "Elizabeth Herrera Figueroa" (match por apodo/apellido/email lherrera). CONFIRMAR.
--  * Sin fecha en el CSV (no se tocan): 1100 Recursos Humanos, 1101 Automatizaciones IA, 1102 José Ruiz.
-- ============================================================

-- Entre paréntesis, el bono esperado con referencia 2026: min(max(2026 - año - 3, 0), 10)
UPDATE users SET fecha_ingreso = '2022-09-05' WHERE employee_number = '1110'; -- Amy Jones            (1)
UPDATE users SET fecha_ingreso = '2013-03-01' WHERE employee_number = '1111'; -- Ana Beatriz Rivas    (10)
UPDATE users SET fecha_ingreso = '2007-03-01' WHERE employee_number = '1112'; -- Patricia Cabrera     (10)
UPDATE users SET fecha_ingreso = '2012-09-01' WHERE employee_number = '1113'; -- Dámaris Eguizabal    (10)
UPDATE users SET fecha_ingreso = '2009-05-01' WHERE employee_number = '1114'; -- Edgar Chalí          (10)
UPDATE users SET fecha_ingreso = '2015-10-01' WHERE employee_number = '1115'; -- Ximena Flamenco      (8)
UPDATE users SET fecha_ingreso = '2016-06-15' WHERE employee_number = '1116'; -- Cristina Monzón      (7)
UPDATE users SET fecha_ingreso = '2005-12-01' WHERE employee_number = '1117'; -- María José Gonzalez  (10)
UPDATE users SET fecha_ingreso = '2017-01-01' WHERE employee_number = '1118'; -- Claudia Ruiz         (6)
UPDATE users SET fecha_ingreso = '2021-06-16' WHERE employee_number = '1119'; -- Claudia Ocaña        (2)
UPDATE users SET fecha_ingreso = '2018-08-01' WHERE employee_number = '1120'; -- Elisa Blanda         (5)
UPDATE users SET fecha_ingreso = '2023-12-08' WHERE employee_number = '1121'; -- André Herrera        (0)
UPDATE users SET fecha_ingreso = '2022-10-24' WHERE employee_number = '1122'; -- Lilian Boteo         (1)
UPDATE users SET fecha_ingreso = '2014-03-17' WHERE employee_number = '1123'; -- Carlos Rodríguez     (9)
UPDATE users SET fecha_ingreso = '2020-04-21' WHERE employee_number = '1124'; -- Lluvia Soto          (3)
UPDATE users SET fecha_ingreso = '2021-12-01' WHERE employee_number = '1125'; -- Judith Morales       (2)
UPDATE users SET fecha_ingreso = '2022-07-15' WHERE employee_number = '1126'; -- Karla Zaldaña        (1)
UPDATE users SET fecha_ingreso = '2022-10-24' WHERE employee_number = '1128'; -- Daniela Sansur       (1)
UPDATE users SET fecha_ingreso = '2022-10-24' WHERE employee_number = '1129'; -- María José Hernández (1)
UPDATE users SET fecha_ingreso = '2023-06-15' WHERE employee_number = '1131'; -- Ximena Yañez         (0)
UPDATE users SET fecha_ingreso = '2023-04-22' WHERE employee_number = '1132'; -- Concepción Pérez     (0)
UPDATE users SET fecha_ingreso = '2023-06-12' WHERE employee_number = '1133'; -- Olga Centeno         (0)
UPDATE users SET fecha_ingreso = '2024-05-15' WHERE employee_number = '1134'; -- Liz Herrera *CONFIRMAR* (0)
UPDATE users SET fecha_ingreso = '2025-03-03' WHERE employee_number = '1136'; -- Mariana Borja        (0)
UPDATE users SET fecha_ingreso = '2025-07-17' WHERE employee_number = '1137'; -- Matilde Tox          (0)
UPDATE users SET fecha_ingreso = '2025-04-01' WHERE employee_number = '1138'; -- María José Ávila     (0)
UPDATE users SET fecha_ingreso = '2025-05-05' WHERE employee_number = '1139'; -- Frily Gálvez         (0)
UPDATE users SET fecha_ingreso = '2026-06-22' WHERE employee_number = '1140'; -- Ixchel Anaya         (0)
UPDATE users SET fecha_ingreso = '2026-04-20' WHERE employee_number = '1141'; -- Karen Altamirano     (0)
UPDATE users SET fecha_ingreso = '2026-04-13' WHERE employee_number = '1142'; -- Cristina Fernández   (0)

-- Recalcular el bono para todos (referencia FIJA 2026)
UPDATE users
SET dias_beneficio_anno_laboral = LEAST(GREATEST(2026 - YEAR(fecha_ingreso) - 3, 0), 10)
WHERE fecha_ingreso IS NOT NULL;

-- Verificación sugerida:
-- SELECT employee_number, full_name, fecha_ingreso, dias_beneficio_anno_laboral
-- FROM users WHERE fecha_ingreso IS NOT NULL ORDER BY employee_number;
