-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: marfund-ia_gestion_vacaciones_ai:3306
-- Tiempo de generación: 21-02-2026 a las 02:14:56
-- Versión del servidor: 9.6.0
-- Versión de PHP: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `marfund-vacations-ai`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `approval_tokens`
--

CREATE TABLE `approval_tokens` (
  `id` int NOT NULL,
  `request_id` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `action` enum('approve','reject') DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `request_date_ranges`
--

CREATE TABLE `request_date_ranges` (
  `id` int NOT NULL,
  `request_id` int NOT NULL,
  `date_from` date NOT NULL,
  `date_to` date NOT NULL,
  `business_days` decimal(5,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `request_history`
--

CREATE TABLE `request_history` (
  `id` int NOT NULL,
  `request_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `performed_by` int DEFAULT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `sessions`
--

INSERT INTO `sessions` (`session_id`, `expires`, `data`) VALUES
('qBBS8xC9lv-11w0-LesTDW6HTzanmnqF', 1772244801, '{\"cookie\":{\"originalMaxAge\":604800000,\"expires\":\"2026-02-28T02:12:58.113Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\"},\"passport\":{\"user\":1}}');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `google_id` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `employee_number` varchar(50) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `role` enum('employee','manager','hr_admin','super_admin') DEFAULT 'employee',
  `manager_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `base_vacation_days` int DEFAULT '15',
  `assistant_email` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `google_id`, `email`, `full_name`, `avatar_url`, `employee_number`, `position`, `role`, `manager_id`, `is_active`, `created_at`, `updated_at`, `base_vacation_days`, `assistant_email`) VALUES
(1, '112189718387039906737', 'automatizaciones.ia@marfund.org', 'Automatizaciones IA', 'https://lh3.googleusercontent.com/a/ACg8ocJrHNhdWctE6NcZ3rlVgUhry2bRlU8jyWkMI2aE_Em1JsoXAAc=s96-c', NULL, NULL, 'manager', NULL, 1, '2026-02-21 00:34:56', '2026-02-21 01:26:27', 15, NULL),
(2, 'disabled_arivas@marfund.org', 'arivas@marfund.org', 'Ana Beatriz Rivas Chacón', NULL, '1111', 'Coordinadora Fase 3', 'manager', 16, 1, '2026-02-21 01:26:14', '2026-02-21 01:26:20', 15, NULL),
(3, 'disabled_pcabrera@marfund.org', 'pcabrera@marfund.org', 'Silvia Patricia Cabrera Chaverri ', NULL, '1112', 'Directora Administrativa', 'manager', 8, 1, '2026-02-21 01:26:14', '2026-02-21 01:26:20', 15, NULL),
(4, 'disabled_deguizabal@marfund.org', 'deguizabal@marfund.org', 'Dámaris Lisseth Eguizabal Orellana', NULL, '1113', 'Experta Auditoría Fase 3', 'employee', 2, 1, '2026-02-21 01:26:14', '2026-02-21 01:26:20', 15, NULL),
(5, 'disabled_echali47@gmail.com', 'echali47@gmail.com', 'Edgar Yovani Chali Simon', NULL, '1114', 'Encargado de Oficina', 'employee', 3, 1, '2026-02-21 01:26:14', '2026-02-21 01:26:20', 15, NULL),
(6, 'disabled_xflamenco@marfund.org', 'xflamenco@marfund.org', 'María Ximena Flamenco Rieckmann', NULL, '1115', 'Oficial de proyectos Fase 3', 'employee', 2, 1, '2026-02-21 01:26:14', '2026-02-21 01:26:20', 15, NULL),
(7, 'disabled_cmonzon@marfund.org', 'cmonzon@marfund.org', 'María Cristina Monzón García', NULL, '1116', 'Auxiliar Contable 1', 'employee', 3, 1, '2026-02-21 01:26:15', '2026-02-21 01:26:21', 15, NULL),
(8, 'disabled_mjgonzalez@marfund.org', 'mjgonzalez@marfund.org', 'María José González Fuster', NULL, '1117', 'Directora General', 'manager', NULL, 1, '2026-02-21 01:26:15', '2026-02-21 01:26:20', 15, NULL),
(9, 'disabled_cruiz@marfund.org', 'cruiz@marfund.org', 'Claudia Lorena del Rosario Ruiz Alvarado', NULL, '1118', 'Directora RRI', 'manager', 8, 1, '2026-02-21 01:26:15', '2026-02-21 01:26:21', 15, NULL),
(10, 'disabled_cocana@marfund.org', 'cocana@marfund.org', 'Claudia Vanessa Alejandra Ocaña Alvarado', NULL, '1119', 'Asistente RRI', 'employee', 9, 1, '2026-02-21 01:26:15', '2026-02-21 01:26:21', 15, NULL),
(11, 'disabled_eblanda@marfund.org', 'eblanda@marfund.org', 'Elisa Blanda', NULL, '1120', 'Oficial de proyectos SGP', 'employee', 16, 1, '2026-02-21 01:26:15', '2026-02-21 01:26:21', 15, NULL),
(12, 'disabled_aherrera@marfund.org', 'aherrera@marfund.org', 'André Nahir Ezwan Herrera', NULL, '1121', 'Asistente RRI Belize', 'employee', 9, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:22', 15, NULL),
(13, 'disabled_lboteo@marfund.org', 'lboteo@marfund.org', 'Lilian Ivette Boteo Barillas ', NULL, '1122', 'Asistente Administrativa', 'employee', 3, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:22', 15, NULL),
(14, 'disabled_crodriguez@marfund.org', 'crodriguez@marfund.org', 'Carlos Leonel Rodriguez Olivet', NULL, '1123', 'Representante Legal', 'employee', 8, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:22', 15, NULL),
(15, 'disabled_lsoto@marfund.org', 'lsoto@marfund.org', 'Lluvia Iyanú Soto Jiménez', NULL, '1124', 'Asistente Dirección General', 'manager', 8, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:25', 15, NULL),
(16, 'disabled_jmorales@marfund.org', 'jmorales@marfund.org', 'Judith Adriana Morales López', NULL, '1125', 'Directora de Proyectos SGP/F3', 'manager', 8, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:23', 15, NULL),
(17, 'disabled_kzaldana@marfund.org', 'kzaldana@marfund.org', 'Karla Patricia Zaldaña Orantes', NULL, '1126', 'Asistente de proyectos SGP/F3', 'employee', 16, 1, '2026-02-21 01:26:16', '2026-02-21 01:26:23', 15, NULL),
(18, 'disabled_ajones@marfund.org', 'ajones@marfund.org', 'Amy Louise Jones', NULL, '1127', 'Directora Proyecto MAR+Invest', 'manager', 16, 1, '2026-02-21 01:26:17', '2026-02-21 01:26:25', 15, NULL),
(19, 'disabled_dsansur@marfund.org', 'dsansur@marfund.org', 'Ana Daniela Sansur Pavón', NULL, '1128', 'Oficial proyectos F3 Honduras', 'employee', 2, 1, '2026-02-21 01:26:17', '2026-02-21 01:26:23', 15, NULL),
(20, 'disabled_mhernandez@marfund.org', 'mhernandez@marfund.org', 'María José Hernández Dueñas', NULL, '1129', 'Oficial proyectos F3 México', 'employee', 2, 1, '2026-02-21 01:26:17', '2026-02-21 01:26:24', 15, NULL),
(21, 'disabled_ecobb@marfund.org', 'ecobb@marfund.org', 'Eliceo Joel Cobb', NULL, '1130', 'Oficial proyectos F3 Belize', 'employee', 2, 1, '2026-02-21 01:26:17', '2026-02-21 01:26:24', 15, NULL),
(22, 'disabled_xyanez@marfund.org', 'xyanez@marfund.org', 'Ximena Yáñez Soto', NULL, '1131', 'Asistente MAR+Invest', 'employee', 8, 1, '2026-02-21 01:26:17', '2026-02-21 01:26:24', 15, NULL),
(23, 'disabled_cperez@marfund.org', 'cperez@marfund.org', 'María Concepción Pérez del Valle', NULL, '1132', 'Asistente MAR+Invest', 'employee', 18, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:25', 15, NULL),
(24, 'disabled_ocenteno@marfund.org', 'ocenteno@marfund.org', 'Olga Aparicia Centeno Guevara', NULL, '1133', 'Asistente de proyectos F3', 'employee', 2, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:25', 15, NULL),
(25, 'disabled_lherrera@marfund.org', 'lherrera@marfund.org', 'Elizabeth Herrera Figueroa de Durán', NULL, '1134', 'Asistente Dirección General', 'manager', 15, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:25', 15, NULL),
(26, 'disabled_rchavez@marfund.org', 'rchavez@marfund.org', 'Roxana Chávez Elorriaga', NULL, '1135', 'Comunicación MAR+Invest', 'employee', 25, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:25', 15, NULL),
(27, 'disabled_mborja@marfund.org', 'mborja@marfund.org', 'Mariana Borja Hernández', NULL, '1136', 'Asistente de proyectos', 'employee', 16, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:26', 15, NULL),
(28, 'disabled_mtox@marfund.org', 'mtox@marfund.org', 'Wendy Matilde Tox Mauricio', NULL, '1137', 'Auxiliar Contable 1', 'employee', 3, 1, '2026-02-21 01:26:18', '2026-02-21 01:26:26', 15, NULL),
(29, 'disabled_mjavila@marfund.org', 'mjavila@marfund.org', 'María José Ávila Breve', NULL, '1138', 'Asistente RRI Honduras', 'employee', 9, 1, '2026-02-21 01:26:19', '2026-02-21 01:26:26', 15, NULL),
(30, 'disabled_fgalvez@marfund.org', 'fgalvez@marfund.org', 'Frily Omar Gálvez Salinas', NULL, '1139', 'Oficial proyectos F3 Guatemala', 'employee', 2, 1, '2026-02-21 01:26:19', '2026-02-21 01:26:26', 15, NULL),
(31, 'disabled_webmaster@marfund.org', 'webmaster@marfund.org', 'José Jaime Ruiz', NULL, '1140', 'Encargado de sistemas', 'employee', 1, 1, '2026-02-21 01:26:19', '2026-02-21 01:26:27', 16, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `vacation_requests`
--

CREATE TABLE `vacation_requests` (
  `id` int NOT NULL,
  `request_number` varchar(20) NOT NULL,
  `employee_id` int NOT NULL,
  `request_type` enum('vacation','permission','justified_absence') NOT NULL,
  `reason` text,
  `notes` text,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `manager_id` int NOT NULL,
  `manager_comments` text,
  `manager_decision_date` timestamp NULL DEFAULT NULL,
  `notified_employee` tinyint(1) DEFAULT '0',
  `notified_manager` tinyint(1) DEFAULT '0',
  `notified_hr` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `v_employee_days_summary`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `v_employee_days_summary` (
`email` varchar(255)
,`employee_id` int
,`employee_number` varchar(50)
,`fiscal_year` year
,`full_name` varchar(255)
,`position` varchar(255)
,`request_type` enum('vacation','permission','justified_absence')
,`status` enum('pending','approved','rejected','cancelled')
,`total_business_days` decimal(27,2)
,`total_requests` bigint
);

-- --------------------------------------------------------

--
-- Estructura para la vista `v_employee_days_summary`
--
DROP TABLE IF EXISTS `v_employee_days_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `v_employee_days_summary`  AS SELECT `u`.`id` AS `employee_id`, `u`.`full_name` AS `full_name`, `u`.`email` AS `email`, `u`.`employee_number` AS `employee_number`, `u`.`position` AS `position`, `vr`.`request_type` AS `request_type`, `vr`.`status` AS `status`, year(`vr`.`created_at`) AS `fiscal_year`, sum(`rdr`.`business_days`) AS `total_business_days`, count(distinct `vr`.`id`) AS `total_requests` FROM ((`users` `u` left join `vacation_requests` `vr` on(((`u`.`id` = `vr`.`employee_id`) and (`vr`.`status` = 'approved')))) left join `request_date_ranges` `rdr` on((`vr`.`id` = `rdr`.`request_id`))) GROUP BY `u`.`id`, `u`.`full_name`, `u`.`email`, `u`.`employee_number`, `u`.`position`, `vr`.`request_type`, `vr`.`status`, year(`vr`.`created_at`) ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `approval_tokens`
--
ALTER TABLE `approval_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `request_id` (`request_id`);

--
-- Indices de la tabla `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_request_date_ranges_request` (`request_id`);

--
-- Indices de la tabla `request_history`
--
ALTER TABLE `request_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `request_id` (`request_id`),
  ADD KEY `performed_by` (`performed_by`);

--
-- Indices de la tabla `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `google_id` (`google_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `manager_id` (`manager_id`);

--
-- Indices de la tabla `vacation_requests`
--
ALTER TABLE `vacation_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_number` (`request_number`),
  ADD KEY `idx_vacation_requests_employee` (`employee_id`),
  ADD KEY `idx_vacation_requests_manager` (`manager_id`),
  ADD KEY `idx_vacation_requests_status` (`status`),
  ADD KEY `idx_vacation_requests_year` (`created_at`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `approval_tokens`
--
ALTER TABLE `approval_tokens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `request_history`
--
ALTER TABLE `request_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT de la tabla `vacation_requests`
--
ALTER TABLE `vacation_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `approval_tokens`
--
ALTER TABLE `approval_tokens`
  ADD CONSTRAINT `approval_tokens_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`);

--
-- Filtros para la tabla `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  ADD CONSTRAINT `request_date_ranges_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `request_history`
--
ALTER TABLE `request_history`
  ADD CONSTRAINT `request_history_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`),
  ADD CONSTRAINT `request_history_ibfk_2` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`);

--
-- Filtros para la tabla `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `vacation_requests`
--
ALTER TABLE `vacation_requests`
  ADD CONSTRAINT `vacation_requests_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `vacation_requests_ibfk_2` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
