CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('customer', 'restaurant') NOT NULL,
  plan ENUM('free', 'pro', 'restaurant') NOT NULL,
  plan_status ENUM('active', 'pending_payment', 'cancelled') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_user_plan CHECK (
    (role = 'customer' AND plan IN ('free', 'pro')) OR
    (role = 'restaurant' AND plan = 'restaurant')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_accounts (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  business_name VARCHAR(160) NOT NULL,
  domain VARCHAR(253) NOT NULL UNIQUE,
  restaurant_id VARCHAR(120) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_restaurant_account_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR(120) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  image VARCHAR(500) NOT NULL DEFAULT '',
  source ENUM('catalog', 'osm') NOT NULL DEFAULT 'catalog'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO restaurants (id, name, image, source) VALUES
  ('la-mar', 'La Mar Cebichería', '/images/restaurants/la-mar/cover.webp', 'catalog'),
  ('central', 'Mérito', '/images/restaurants/central/cover.webp', 'catalog'),
  ('isolina', 'Isolina Taberna Peruana', '/images/restaurants/isolina/cover.webp', 'catalog'),
  ('cosme', 'Cosme', '/images/restaurants/cosme/cover.webp', 'catalog'),
  ('punto-azul', 'Punto Azul', '/images/restaurants/punto-azul/cover.webp', 'catalog'),
  ('panchita', 'Panchita', '/images/restaurants/panchita/cover.webp', 'catalog'),
  ('osaka', 'Osaka', '/images/restaurants/osaka/cover.webp', 'catalog'),
  ('pan-de-la-chola', 'Pan de la Chola', '/images/restaurants/pan-de-la-chola/cover.webp', 'catalog')
ON DUPLICATE KEY UPDATE name = VALUES(name), image = VALUES(image), source = VALUES(source);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_expiry (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_codes (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  restaurant_id VARCHAR(120) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guests TINYINT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(254) NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reservations_user_date (user_id, reservation_date),
  INDEX idx_reservations_restaurant_date (restaurant_id, reservation_date),
  CONSTRAINT fk_reservation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reservation_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  restaurant_id VARCHAR(120) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reviews_restaurant_date (restaurant_id, created_at),
  UNIQUE KEY uq_review_user_restaurant (user_id, restaurant_id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  plan ENUM('pro', 'restaurant') NOT NULL,
  provider ENUM('mercadopago') NOT NULL,
  provider_subscription_id VARCHAR(120) NULL UNIQUE,
  status ENUM('pending', 'authorized', 'paused', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending',
  amount DECIMAL(8, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'PEN',
  checkout_url VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscriptions_user_status (user_id, status),
  CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_key VARCHAR(180) NOT NULL PRIMARY KEY,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_settings (
  restaurant_id VARCHAR(120) NOT NULL PRIMARY KEY,
  hours VARCHAR(120) NOT NULL,
  available_times JSON NOT NULL,
  reservation_policy VARCHAR(240) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
