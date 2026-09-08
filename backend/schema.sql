-- Travel Agency CRM schema
-- No sample/dummy data is inserted.

CREATE DATABASE IF NOT EXISTS travel_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE travel_crm;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','agent') NOT NULL DEFAULT 'admin',
  avatar MEDIUMTEXT NULL,
  phone VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(50) NULL,
  image MEDIUMTEXT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_agents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS destinations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100) NULL,
  image MEDIUMTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_destinations_name (name)
);

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  country VARCHAR(100) NULL,
  preferred_destination_id INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clients_destination FOREIGN KEY (preferred_destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  INDEX idx_clients_name (full_name),
  INDEX idx_clients_email (email),
  INDEX idx_clients_phone (phone)
);

CREATE TABLE IF NOT EXISTS travel_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category ENUM('International','Domestic','Honeymoon','Group Tours','Other') NOT NULL DEFAULT 'Other',
  destination_id INT NULL,
  duration VARCHAR(80) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  included_services TEXT NULL,
  excluded_services TEXT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  image MEDIUMTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_packages_destination FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  INDEX idx_packages_status (status),
  INDEX idx_packages_category (category),
  INDEX idx_packages_name (name)
);

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(190) NULL,
  source VARCHAR(100) NULL,
  interested_destination_id INT NULL,
  budget DECIMAL(12,2) NULL,
  travel_date DATE NULL,
  travelers INT DEFAULT 1,
  status ENUM('new','contacted','qualified','converted','lost') DEFAULT 'new',
  assigned_agent_id INT NULL,
  notes TEXT NULL,
  converted_client_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_leads_destination FOREIGN KEY (interested_destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_client FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  INDEX idx_leads_status (status),
  INDEX idx_leads_name (name)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  package_id INT NULL,
  destination_id INT NULL,
  departure_date DATE NOT NULL,
  return_date DATE NULL,
  travelers INT NOT NULL DEFAULT 1,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid',
  status ENUM('pending','confirmed','processing','cancelled','completed') DEFAULT 'pending',
  assigned_agent_id INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_package FOREIGN KEY (package_id) REFERENCES travel_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_destination FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  INDEX idx_bookings_departure (departure_date),
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_created (created_at)
);

CREATE TABLE IF NOT EXISTS booking_travelers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  passport_no VARCHAR(80) NULL,
  age INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_travelers_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  lead_id INT NULL,
  follow_up_date DATE NOT NULL,
  follow_up_time TIME NULL,
  type VARCHAR(80) DEFAULT 'call',
  notes TEXT NULL,
  assigned_agent_id INT NULL,
  status ENUM('scheduled','completed','cancelled','rescheduled') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_followups_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_followups_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_followups_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  INDEX idx_followups_date (follow_up_date),
  INDEX idx_followups_status (status)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  channel ENUM('internal','whatsapp','email') DEFAULT 'internal',
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conversations_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_type ENUM('user','client','system') NOT NULL,
  sender_id INT NULL,
  body TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_messages_unread (is_read),
  INDEX idx_messages_created (created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  link VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_read (is_read)
);

CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activities_created (created_at)
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY,
  company_name VARCHAR(150) DEFAULT 'SkyTrail Travels',
  logo MEDIUMTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO settings (id, company_name) VALUES (1, 'SkyTrail Travels');
