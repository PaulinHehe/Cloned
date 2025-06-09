-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mer. 28 mai 2025 à 11:55
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `gitanalyser`
--

-- --------------------------------------------------------

--
-- Structure de la table `groups`
--

CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `name` int(11) DEFAULT NULL,
  `year` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `groups`
--

INSERT INTO `groups` (`id`, `created_at`, `name`, `year`) VALUES
(1, '2024-05-12 18:22:42', 1, 2024),
(2, '2024-05-12 16:22:42', 2, 2024),
(3, '2025-05-20 11:50:31', 1, 2025),
(4, '2025-05-20 11:50:31', 2, 2025),
(5, '2025-05-28 09:54:42', 3, 2025);

-- --------------------------------------------------------

--
-- Structure de la table `groups_students`
--

CREATE TABLE `groups_students` (
  `id_group` int(11) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `groups_students`
--

INSERT INTO `groups_students` (`id_group`, `id_student`) VALUES
(1, 1),
(1, 2),
(1, 3),
(2, 4),
(2, 5),
(2, 6),
(3, 7),
(3, 8),
(3, 9),
(4, 10),
(4, 11),
(4, 12),
(5, 16),
(5, 17),
(5, 18),
(5, 19);

--
-- Déclencheurs `groups_students`
--
DELIMITER $$
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
-- Structure de la table `projects`
--

CREATE TABLE `projects` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;




-- --------------------------------------------------------

--
-- Structure de la table `students`
--

CREATE TABLE `students` (
  `id` int(11) NOT NULL,
  `surname` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `group_id` int(11) DEFAULT NULL,
  `no_etudiant` varchar(8) NOT NULL,
  `class` enum('MIAGE-FA','MIAGE-FI','IM') NOT NULL,
  `gitname` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `students`
--

INSERT INTO `students` (`id`, `name`, `group_id`, `created_at`, `no_etudiant`, `class`, `surname`, `gitname`) VALUES
(1, 'Alice', 1, '2023-05-12 20:43:52', '12345678', 'MIAGE-FI', 'Doe', 'alice.doe'),
(2, 'Bob', 2, '2025-05-12 20:43:52', '98765432', 'IM', 'Smith', 'bob.smith'),
(3, 'Emilie', 1, '2025-05-12 21:35:11', '24681357', 'MIAGE-FI', 'Diallo', 'Emilie.diallo'),
(4, 'Hein', 1, '2025-05-12 18:43:52', '13579246', 'MIAGE-FI', 'Nguyen', 'hein.nguyen'),
(5, 'Euh', 2, '2025-05-12 18:43:52', '87654321', 'IM', 'Dupont', 'euh.dupont'),
(6, 'Heheh', 1, '2025-05-12 19:35:11', '36925814', 'IM', 'Tremblay', 'heheh.tremblay'),
(7, 'Rania', 3, '2025-05-20 12:10:20', '19876543', 'MIAGE-FI', 'Benali', 'rania.benali'),
(8, 'Amine', 3, '2025-05-20 12:10:20', '20234567', 'MIAGE-FI', 'Lounis', 'amine.lounis'),
(9, 'Hiba', 3, '2025-05-20 12:10:20', '21098765', 'IM', 'Bennani', 'hiba.bennani'),
(10, 'Téo', 3, '2025-05-20 12:10:20', '22112233', 'MIAGE-FI', 'Martin', 'teo.martin'),
(11, 'Arthur', 4, '2025-05-20 12:10:20', '23456789', 'MIAGE-FI', 'Durand', 'arthur.durand'),
(12, 'Yassine', 4, '2025-05-20 12:10:20', '24987654', 'IM', 'Elbouz', 'yassine.elbouz'),
(13, 'Alpha', NULL, '2025-05-21 09:41:43', '12375678', 'MIAGE-FA', 'Sow', 'alpha.sow'),
(14, 'Beta', NULL, '2025-05-21 09:41:43', '12385678', 'MIAGE-FA', 'Khan', 'beta.khan'),
(15, 'Gamma', NULL, '2025-05-21 09:41:43', '12395678', 'MIAGE-FA', 'Zhou', 'gamma.zhou'),
(16, 'Pauline', NULL, '2025-05-28 09:54:42', '30000001', 'MIAGE-FI', 'Blavy', 'PaulinHehe'),
(17, 'Sylia', NULL, '2025-05-28 09:54:42', '30000002', 'MIAGE-FI', 'Rathier', 'sylia.rathier'),
(18, 'Wafa', NULL, '2025-05-28 09:54:42', '30000003', 'MIAGE-FI', 'Zait', 'wafa.zait'),
(19, 'Coumba', NULL, '2025-05-28 09:54:42', '30000004', 'MIAGE-FI', 'Diagne', 'Coumba22');

-- --------------------------------------------------------

--
-- Structure de la table `years`
--

CREATE TABLE `years` (
  `id` int(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `years`
--

INSERT INTO `years` (`id`) VALUES
(2024),
(2025);

-- --------------------------------------------------------

--
-- Structure de la table `years_students`
--

CREATE TABLE `years_students` (
  `id_annee` int(4) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `years_students`
--

INSERT INTO `years_students` (`id_annee`, `id_student`) VALUES
(2024, 1),
(2024, 2),
(2024, 3),
(2024, 4),
(2024, 5),
(2024, 6),
(2024, 13),
(2025, 7),
(2025, 8),
(2025, 9),
(2025, 10),
(2025, 11),
(2025, 12),
(2025, 14),
(2025, 15),
(2025, 16),
(2025, 17),
(2025, 18),
(2025, 19);


-- --------------------------------------------------------

--
-- Structure de la table `repositories`
--

CREATE TABLE `repositories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `owner` varchar(255) DEFAULT NULL,
  `category` enum('projet','TD','-') NOT NULL DEFAULT '-',
  `analysisId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Données avec colonne `owner` remplie
INSERT INTO `repositories` (id, name, owner) VALUES 
  (1, 'archiweb_2025_tds_gr1_pauline.blavy_webapp', 'uha-fr'),
  (2, 'archiweb_2025_projets_gr03', 'uha-fr'),
  (3, '-archiweb_2025_projets_gr03_front', 'uha-fr'),
  (4, 'Projet-GIT', 'coumba22'),
  (5, 'Projet_GIT_frontend', 'coumba22'),
  (6, 'ProjetGit_BackendPy', 'coumba22'),
  (7, 'ProjetGit_FrontPy', 'coumba22');;


-- --------------------------------------------------------
-- Table `repositories_groups`
-- --------------------------------------------------------

CREATE TABLE `repositories_groups` (
  `id_repo` int(11) NOT NULL,
  `id_group` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Trigger : met à jour la catégorie à 'projet'
DELIMITER $$
CREATE TRIGGER `trg_repo_group_insert` AFTER INSERT ON `repositories_groups` 
FOR EACH ROW BEGIN
  UPDATE `repositories`
  SET `category` = 'projet'
  WHERE `id` = NEW.id_repo;
END$$
DELIMITER ;

-- Données pour `repositories_groups`
INSERT INTO repositories_groups (id_repo, id_group) VALUES
(2, 5),
(3, 5);

-- --------------------------------------------------------
-- Table `repositories_students`
-- --------------------------------------------------------

CREATE TABLE `repositories_students` (
  `id_repo` int(11) NOT NULL,
  `id_student` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Trigger : met à jour la catégorie à 'TD'
DELIMITER $$
CREATE TRIGGER `trg_repo_student_insert` AFTER INSERT ON `repositories_students` 
FOR EACH ROW BEGIN
  UPDATE `repositories`
  SET `category` = 'TD'
  WHERE `id` = NEW.id_repo;
END$$
DELIMITER ;

-- Données pour `repositories_students`
INSERT INTO `repositories_students` (`id_repo`, `id_student`) VALUES
(1, 16),
(4, 19),
(5, 19),
(6, 19),
(7, 19);




--
-- Index pour les tables déchargées
--

--
-- Index pour la table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_groups_year` (`year`),
  ADD UNIQUE(`name`, `year`);

--
-- Index pour la table `groups_students`
--
ALTER TABLE `groups_students`
  ADD PRIMARY KEY (`id_group`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- Index pour la table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `repositories`
--
ALTER TABLE `repositories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Index pour la table `repositories_groups`
--
ALTER TABLE `repositories_groups`
  ADD PRIMARY KEY (`id_repo`,`id_group`),
  ADD KEY `id_group` (`id_group`);

--
-- Index pour la table `repositories_students`
--
ALTER TABLE `repositories_students`
  ADD PRIMARY KEY (`id_repo`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- Index pour la table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `no_etudiant` (`no_etudiant`),
  ADD KEY `group_id` (`group_id`);

--
-- Index pour la table `years`
--
ALTER TABLE `years`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `years_students`
--
ALTER TABLE `years_students`
  ADD PRIMARY KEY (`id_annee`,`id_student`),
  ADD KEY `id_student` (`id_student`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `repositories`
--
ALTER TABLE `repositories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `students`
--
ALTER TABLE `students`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `groups`
--
ALTER TABLE `groups`
  ADD CONSTRAINT `fk_groups_year` FOREIGN KEY (`year`) REFERENCES `years` (`id`);

--
-- Contraintes pour la table `groups_students`
--
ALTER TABLE `groups_students`
  ADD CONSTRAINT `groups_students_ibfk_1` FOREIGN KEY (`id_group`) REFERENCES `groups` (`id`),
  ADD CONSTRAINT `groups_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`);

--
-- Contraintes pour la table `repositories_groups`
--
ALTER TABLE `repositories_groups`
  ADD CONSTRAINT `repositories_groups_ibfk_1` FOREIGN KEY (`id_repo`) REFERENCES `repositories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `repositories_groups_ibfk_2` FOREIGN KEY (`id_group`) REFERENCES `groups` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `repositories_students`
--
ALTER TABLE `repositories_students`
  ADD CONSTRAINT `repositories_students_ibfk_1` FOREIGN KEY (`id_repo`) REFERENCES `repositories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `repositories_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `years_students`
--
ALTER TABLE `years_students`
  ADD CONSTRAINT `years_students_ibfk_1` FOREIGN KEY (`id_annee`) REFERENCES `years` (`id`),
  ADD CONSTRAINT `years_students_ibfk_2` FOREIGN KEY (`id_student`) REFERENCES `students` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
