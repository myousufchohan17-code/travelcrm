-- Postgres schema for Vercel / Neon. No sample CRM data is inserted.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  avatar TEXT NULL,
  phone VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(50) NULL,
  image TEXT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destinations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(100) NULL,
  image TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(190) NULL,
  address TEXT NULL,
  country VARCHAR(100) NULL,
  preferred_destination_id INT NULL REFERENCES destinations(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS travel_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'Other',
  destination_id INT NULL REFERENCES destinations(id) ON DELETE SET NULL,
  duration VARCHAR(80) NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT NULL,
  included_services TEXT NULL,
  excluded_services TEXT NULL,
  status VARCHAR(20) DEFAULT 'active',
  image TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(190) NULL,
  source VARCHAR(100) NULL,
  interested_destination_id INT NULL REFERENCES destinations(id) ON DELETE SET NULL,
  budget DECIMAL(12,2) NULL,
  travel_date DATE NULL,
  travelers INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'new',
  assigned_agent_id INT NULL REFERENCES agents(id) ON DELETE SET NULL,
  notes TEXT NULL,
  converted_client_id INT NULL REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  client_id INT NULL REFERENCES clients(id) ON DELETE SET NULL,
  package_id INT NULL REFERENCES travel_packages(id) ON DELETE SET NULL,
  destination_id INT NULL REFERENCES destinations(id) ON DELETE SET NULL,
  departure_date DATE NOT NULL,
  return_date DATE NULL,
  travelers INT NOT NULL DEFAULT 1,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  status VARCHAR(20) DEFAULT 'pending',
  assigned_agent_id INT NULL REFERENCES agents(id) ON DELETE SET NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_travelers (
  id SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  passport_no VARCHAR(80) NULL,
  age INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id SERIAL PRIMARY KEY,
  client_id INT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id INT NULL REFERENCES leads(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  follow_up_time TIME NULL,
  type VARCHAR(80) DEFAULT 'call',
  notes TEXT NULL,
  assigned_agent_id INT NULL REFERENCES agents(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  client_id INT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel VARCHAR(20) DEFAULT 'internal',
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  sender_id INT NULL,
  body TEXT NOT NULL,
  is_read SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read SMALLINT DEFAULT 0,
  link VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY,
  company_name VARCHAR(150) DEFAULT 'SkyTrail Travels',
  logo TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_destinations_name ON destinations (name);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (full_name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);
CREATE INDEX IF NOT EXISTS idx_packages_status ON travel_packages (status);
CREATE INDEX IF NOT EXISTS idx_packages_category ON travel_packages (category);
CREATE INDEX IF NOT EXISTS idx_packages_name ON travel_packages (name);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads (name);
CREATE INDEX IF NOT EXISTS idx_bookings_departure ON bookings (departure_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings (created_at);
CREATE INDEX IF NOT EXISTS idx_followups_date ON follow_ups (follow_up_date);
CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups (status);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities (created_at);

INSERT INTO settings (id, company_name) VALUES (1, 'SkyTrail Travels')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (full_name, email, password_hash, role)
SELECT 'Travel Manager', 'admin@miaholidays.test', '', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
