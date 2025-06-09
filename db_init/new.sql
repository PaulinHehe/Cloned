-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Fri, 07 June 2025 17:27:30 +0200
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `gitanalyser`
--

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL, -- Changed from INT to VARCHAR(255)
  `year` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `groups_students`
--

DROP TABLE IF EXISTS `groups_students`;
CREATE TABLE `groups_students` (
  `id_group` int(11) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers for `groups_students`
--
DELIMITER $$
DROP TRIGGER IF EXISTS `check_group_student_year_consistency`$$
CREATE TRIGGER `check_group_student_year_consistency` BEFORE INSERT ON `groups_students` FOR EACH ROW BEGIN
    DECLARE group_year_id INT;

    -- Get the year associated with the group
    SELECT `year` INTO group_year_id
    FROM `groups`
    WHERE `id` = NEW.id_group;

    -- Check if the student is assigned to the group's year in the years_students table
    IF NOT EXISTS (
        SELECT 1
        FROM `years_students`
        WHERE `id_student` = NEW.id_student
          AND `id_annee` = group_year_id
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A student can only be assigned to a group if they are also assigned to that group''s academic year.';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` int(11) NOT NULL,
  `surname` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `no_etudiant` varchar(8) NOT NULL UNIQUE,
  `class` enum('MIAGE-FA','MIAGE-FI','IM') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_git_accounts`
-- This table stores multiple Git usernames for a single student.
--

DROP TABLE IF EXISTS `student_git_accounts`;
CREATE TABLE `student_git_accounts` (
  `id_student` int(11) NOT NULL,
  `git_username` varchar(255) NOT NULL,
  PRIMARY KEY (`id_student`, `git_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `years`
--

DROP TABLE IF EXISTS `years`;
CREATE TABLE `years` (
  `id` int(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `years_students`
--

DROP TABLE IF EXISTS `years_students`;
CREATE TABLE `years_students` (
  `id_annee` int(4) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repositories`
--

DROP TABLE IF EXISTS `repositories`;
CREATE TABLE `repositories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL UNIQUE,
  `owner` varchar(255) DEFAULT NULL,
  `repo_url` varchar(512) NOT NULL, -- New field from JSON
  `category` enum('projet','TD','-') NOT NULL DEFAULT '-',
  `analysisId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repositories_groups`
--

DROP TABLE IF EXISTS `repositories_groups`;
CREATE TABLE `repositories_groups` (
  `id_repo` int(11) NOT NULL,
  `id_group` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers for `repositories_groups`
--
DELIMITER $$
DROP TRIGGER IF EXISTS `trg_repo_group_insert`$$
CREATE TRIGGER `trg_repo_group_insert` AFTER INSERT ON `repositories_groups` FOR EACH ROW BEGIN
  UPDATE `repositories`
  SET `category` = 'projet'
  WHERE `id` = NEW.id_repo;
END$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `repositories_students`
--

DROP TABLE IF EXISTS `repositories_students`;
CREATE TABLE `repositories_students` (
  `id_repo` int(11) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers for `repositories_students`
--
DELIMITER $$
DROP TRIGGER IF EXISTS `trg_repo_student_insert`$$
CREATE TRIGGER `trg_repo_student_insert` AFTER INSERT ON `repositories_students` FOR EACH ROW BEGIN
  UPDATE `repositories`
  SET `category` = 'TD'
  WHERE `id` = NEW.id_repo;
END$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `configurable_deadlines`
-- This table stores the configurable deadlines from your JSON.
--

DROP TABLE IF EXISTS `configurable_deadlines`;
CREATE TABLE `configurable_deadlines` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `type` ENUM('IM', 'MIAGE', 'PROJECT') NOT NULL,
  `event_date` DATE NOT NULL,
  `event_time` TIME NOT NULL,
  `description` VARCHAR(255),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


--
-- Indexes for dumped tables
--

--
-- Indexes for table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_groups_year` (`year`),
  ADD UNIQUE KEY `name_year_unique` (`name`, `year`);

--
-- Indexes for table `groups_students`
--
ALTER TABLE `groups_students`
  ADD PRIMARY KEY (`id_group`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- Indexes for table `repositories`
--
ALTER TABLE `repositories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `repositories_groups`
--
ALTER TABLE `repositories_groups`
  ADD PRIMARY KEY (`id_repo`,`id_group`),
  ADD KEY `id_group` (`id_group`);

--
-- Indexes for table `repositories_students`
--
ALTER TABLE `repositories_students`
  ADD PRIMARY KEY (`id_repo`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `no_etudiant` (`no_etudiant`);

--
-- Indexes for table `student_git_accounts`
--
ALTER TABLE `student_git_accounts`
  ADD KEY `id_student` (`id_student`);

--
-- Indexes for table `years`
--
ALTER TABLE `years`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `years_students`
--
ALTER TABLE `years_students`
  ADD PRIMARY KEY (`id_annee`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `configurable_deadlines`
--
ALTER TABLE `configurable_deadlines`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repositories`
--
ALTER TABLE `repositories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `groups`
--
ALTER TABLE `groups`
  ADD CONSTRAINT `fk_groups_year` FOREIGN KEY (`year`) REFERENCES `years` (`id`);

--
-- Constraints for table `groups_students`
--
ALTER TABLE `groups_students`
  ADD CONSTRAINT `groups_students_ibfk_1` FOREIGN KEY (`id_group`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `groups_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `repositories_groups`
--
ALTER TABLE `repositories_groups`
  ADD CONSTRAINT `repositories_groups_ibfk_1` FOREIGN KEY (`id_repo`) REFERENCES `repositories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `repositories_groups_ibfk_2` FOREIGN KEY (`id_group`) REFERENCES `groups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `repositories_students`
--
ALTER TABLE `repositories_students`
  ADD CONSTRAINT `repositories_students_ibfk_1` FOREIGN KEY (`id_repo`) REFERENCES `repositories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `repositories_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_git_accounts`
--
ALTER TABLE `student_git_accounts`
  ADD CONSTRAINT `student_git_accounts_ibfk_1` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `years_students`
--
ALTER TABLE `years_students`
  ADD CONSTRAINT `years_students_ibfk_1` FOREIGN KEY (`id_annee`) REFERENCES `years` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `years_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;