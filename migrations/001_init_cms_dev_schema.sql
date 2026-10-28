-- ==============================================================================
-- CMS DEV DATABASE INITIALIZATION SCHEMA (Version 1.0.0)
-- Target Database: cms_dev (Strictly Local Development Environment)
-- Source: Cleaned schema-only export of UPPCL Bijli Mitra 'cms' database
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `cms_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cms_dev`;

-- 1. Administrative & Departmental Users Table
CREATE TABLE IF NOT EXISTS `admin` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(250) NOT NULL,
  `password` VARCHAR(250) NOT NULL,
  `changepass` INT(11) NOT NULL DEFAULT 0,
  `phn` VARCHAR(255) DEFAULT NULL,
  `DISCOM` VARCHAR(255) DEFAULT NULL,
  `zone` VARCHAR(255) DEFAULT NULL,
  `circle` VARCHAR(255) DEFAULT NULL,
  `Time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `otp_send_count` VARCHAR(20) DEFAULT '0',
  `otp_send_date` VARCHAR(20) DEFAULT NULL,
  `otp_verify_count` VARCHAR(20) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_admin_username` (`username`),
  KEY `idx_discom_username` (`DISCOM`, `username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Complaints Master Table (tblcomplaints)
CREATE TABLE IF NOT EXISTS `tblcomplaints` (
  `complaintNumber` INT(11) NOT NULL AUTO_INCREMENT,
  `thiefname` VARCHAR(500) NOT NULL,
  `thiefaddress` VARCHAR(2000) NOT NULL,
  `district` VARCHAR(2000) DEFAULT NULL,
  `substn` VARCHAR(255) DEFAULT NULL,
  `complaintDetails` MEDIUMTEXT DEFAULT NULL,
  `complaintFile` VARCHAR(255) DEFAULT NULL,
  `regDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) DEFAULT NULL,
  `lastUpdationDate` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `username` VARCHAR(255) DEFAULT NULL,
  `sdivision` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`complaintNumber`),
  KEY `idx_username` (`username`),
  KEY `idx_status` (`status`),
  KEY `idx_regDate` (`regDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Enforcement Actions & Remark Dossier (complaintremark)
CREATE TABLE IF NOT EXISTS `complaintremark` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `complaintNumber` INT(11) NOT NULL,
  `status` VARCHAR(255) NOT NULL,
  `remark` MEDIUMTEXT NOT NULL,
  `remarkDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `username` VARCHAR(255) DEFAULT NULL,
  `info` VARCHAR(255) DEFAULT NULL,
  `category` VARCHAR(255) DEFAULT NULL,
  `loads` VARCHAR(255) DEFAULT NULL,
  `assess` VARCHAR(255) DEFAULT NULL,
  `reali` VARCHAR(255) DEFAULT NULL,
  `scat` VARCHAR(255) DEFAULT NULL,
  `acat` VARCHAR(255) DEFAULT NULL,
  `sload` VARCHAR(255) DEFAULT NULL,
  `aload` VARCHAR(255) DEFAULT NULL,
  `cn` VARCHAR(255) DEFAULT NULL,
  `filek` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_complaintNumber` (`complaintNumber`),
  KEY `idx_status_info` (`status`, `info`),
  CONSTRAINT `fk_remark_complaint` FOREIGN KEY (`complaintNumber`) 
    REFERENCES `tblcomplaints` (`complaintNumber`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Category & Subcategory Master Tables
CREATE TABLE IF NOT EXISTS `category` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `categoryName` VARCHAR(255) DEFAULT NULL,
  `categoryDescription` LONGTEXT DEFAULT NULL,
  `creationDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updationDate` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subcategory` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `categoryid` INT(11) DEFAULT NULL,
  `subcategory` VARCHAR(255) DEFAULT NULL,
  `creationDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updationDate` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. UP Districts Lookup Table (state)
CREATE TABLE IF NOT EXISTS `state` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `stateName` VARCHAR(255) DEFAULT NULL,
  `stateDescription` TINYTEXT DEFAULT NULL,
  `postingDate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updationDate` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Consumer Accounts & Access Logs (users, userlog, ip_details)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `fullName` VARCHAR(255) DEFAULT NULL,
  `userEmail` VARCHAR(255) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `contactNo` BIGINT(11) DEFAULT NULL,
  `address` TINYTEXT DEFAULT NULL,
  `State` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(255) DEFAULT NULL,
  `pincode` INT(6) DEFAULT NULL,
  `userImage` VARCHAR(255) DEFAULT NULL,
  `regDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updationDate` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` INT(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `userlog` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `uid` INT(11) NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `userip` BINARY(16) DEFAULT NULL,
  `loginTime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `logout` VARCHAR(255) DEFAULT NULL,
  `status` INT(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ip_details` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `ip` VARCHAR(50) NOT NULL,
  `login_time` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Audit Log Table (Modern addition for regulatory audit trails)
CREATE TABLE IF NOT EXISTS `audit_trail` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `complaintNumber` INT(11) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `performed_by` VARCHAR(250) NOT NULL,
  `discom` VARCHAR(255) DEFAULT NULL,
  `details_json` LONGTEXT DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_complaint` (`complaintNumber`),
  KEY `idx_audit_user` (`performed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
