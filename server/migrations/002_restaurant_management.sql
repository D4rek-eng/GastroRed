ALTER TABLE reservations
  MODIFY COLUMN status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE restaurant_settings
  ADD COLUMN price_per_person DECIMAL(8, 2) NULL;

ALTER TABLE restaurant_settings
  ADD COLUMN menu_highlights JSON NULL;
