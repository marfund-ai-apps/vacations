-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: marfund-ia_gestion_vacaciones_ai:3306
-- Generation Time: Apr 25, 2026 at 05:19 PM
-- Server version: 9.6.0
-- PHP Version: 8.2.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `marfund-vacations-ai`
--

-- --------------------------------------------------------

--
-- Table structure for table `approval_tokens`
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
-- Table structure for table `request_date_ranges`
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
-- Table structure for table `request_history`
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
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
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
  `base_vacation_days` decimal(5,2) NOT NULL DEFAULT '15.00',
  `assistant_email` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_day_adjustments`
--

CREATE TABLE `user_day_adjustments` (
  `id` int NOT NULL,
  `adjustment_number` varchar(20) DEFAULT NULL,
  `user_id` int NOT NULL,
  `adjusted_by` int DEFAULT NULL,
  `days_added` decimal(5,2) NOT NULL,
  `adjustment_type` enum('manual','monthly_auto','initial_balance') NOT NULL DEFAULT 'manual',
  `reason` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `vacation_requests`
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
-- Stand-in structure for view `v_employee_days_summary`
-- (See below for the actual view)
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
-- Structure for view `v_employee_days_summary`
--
DROP TABLE IF EXISTS `v_employee_days_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `v_employee_days_summary`  AS SELECT `u`.`id` AS `employee_id`, `u`.`full_name` AS `full_name`, `u`.`email` AS `email`, `u`.`employee_number` AS `employee_number`, `u`.`position` AS `position`, `vr`.`request_type` AS `request_type`, `vr`.`status` AS `status`, year(`vr`.`created_at`) AS `fiscal_year`, sum(`rdr`.`business_days`) AS `total_business_days`, count(distinct `vr`.`id`) AS `total_requests` FROM ((`users` `u` left join `vacation_requests` `vr` on(((`u`.`id` = `vr`.`employee_id`) and (`vr`.`status` = 'approved')))) left join `request_date_ranges` `rdr` on((`vr`.`id` = `rdr`.`request_id`))) GROUP BY `u`.`id`, `u`.`full_name`, `u`.`email`, `u`.`employee_number`, `u`.`position`, `vr`.`request_type`, `vr`.`status`, year(`vr`.`created_at`) ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `approval_tokens`
--
ALTER TABLE `approval_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `request_id` (`request_id`);

--
-- Indexes for table `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_request_date_ranges_request` (`request_id`);

--
-- Indexes for table `request_history`
--
ALTER TABLE `request_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `request_id` (`request_id`),
  ADD KEY `performed_by` (`performed_by`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `google_id` (`google_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `manager_id` (`manager_id`);

--
-- Indexes for table `user_day_adjustments`
--
ALTER TABLE `user_day_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `adjustment_number` (`adjustment_number`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `adjusted_by` (`adjusted_by`);

--
-- Indexes for table `vacation_requests`
--
ALTER TABLE `vacation_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_number` (`request_number`),
  ADD KEY `idx_vacation_requests_employee` (`employee_id`),
  ADD KEY `idx_vacation_requests_manager` (`manager_id`),
  ADD KEY `idx_vacation_requests_status` (`status`),
  ADD KEY `idx_vacation_requests_year` (`created_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `approval_tokens`
--
ALTER TABLE `approval_tokens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `request_history`
--
ALTER TABLE `request_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_day_adjustments`
--
ALTER TABLE `user_day_adjustments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `vacation_requests`
--
ALTER TABLE `vacation_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `approval_tokens`
--
ALTER TABLE `approval_tokens`
  ADD CONSTRAINT `approval_tokens_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`);

--
-- Constraints for table `request_date_ranges`
--
ALTER TABLE `request_date_ranges`
  ADD CONSTRAINT `request_date_ranges_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `request_history`
--
ALTER TABLE `request_history`
  ADD CONSTRAINT `request_history_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `vacation_requests` (`id`),
  ADD CONSTRAINT `request_history_ibfk_2` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_day_adjustments`
--
ALTER TABLE `user_day_adjustments`
  ADD CONSTRAINT `user_day_adjustments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `user_day_adjustments_ibfk_2` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `vacation_requests`
--
ALTER TABLE `vacation_requests`
  ADD CONSTRAINT `vacation_requests_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `vacation_requests_ibfk_2` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
