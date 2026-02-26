import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInfrastructureTables1709499839547 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create queue_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS queue_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(36) NOT NULL UNIQUE,
        userId INT NOT NULL,
        expiresAt DATETIME NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        INDEX idx_user_id (userId),
        INDEX idx_expires_at (expiresAt)
      ) ENGINE=InnoDB;
    `);

    // Add missing columns to users table
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS point INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS version INT DEFAULT 0
    `);

    // Update users table to include version column for optimistic locking
    await queryRunner.query(`
      ALTER TABLE users 
      MODIFY COLUMN version INT DEFAULT 0
    `);

    // Add missing columns to seats table
    await queryRunner.query(`
      ALTER TABLE seats 
      ADD COLUMN IF NOT EXISTS tempReservedUntil DATETIME NULL,
      ADD COLUMN IF NOT EXISTS tempReservedUserId INT NULL
    `);

    // Create concerts table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS concerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Create concert_schedules table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS concert_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        concertId INT NOT NULL,
        concertDate DATE NOT NULL,
        totalSeats INT DEFAULT 50,
        price INT DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (concertId) REFERENCES concerts(id),
        INDEX idx_concert_id (concertId)
      ) ENGINE=InnoDB;
    `);

    // Create seats table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        concertScheduleId INT NOT NULL,
        seatNumber INT NOT NULL,
        status ENUM('AVAILABLE', 'TEMP_RESERVED', 'RESERVED') DEFAULT 'AVAILABLE',
        tempReservedUntil DATETIME NULL,
        tempReservedUserId INT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (concertScheduleId) REFERENCES concert_schedules(id),
        INDEX idx_concert_schedule_id (concertScheduleId),
        INDEX idx_status (status)
      ) ENGINE=InnoDB;
    `);

    // Create reservations table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        seatId INT NOT NULL,
        concertScheduleId INT NOT NULL,
        status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING',
        expiresAt DATETIME NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (seatId) REFERENCES seats(id),
        FOREIGN KEY (concertScheduleId) REFERENCES concert_schedules(id),
        INDEX idx_user_id (userId),
        INDEX idx_seat_id (seatId)
      ) ENGINE=InnoDB;
    `);

    // Create payments table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        reservationId INT NOT NULL,
        amount INT NOT NULL,
        status ENUM('COMPLETED', 'CANCELLED') DEFAULT 'COMPLETED',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (reservationId) REFERENCES reservations(id),
        INDEX idx_user_id (userId),
        INDEX idx_reservation_id (reservationId)
      ) ENGINE=InnoDB;
    `);

    // Create point_histories table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS point_histories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        type VARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id),
        INDEX idx_user_id (userId)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of creation
    await queryRunner.query('DROP TABLE IF EXISTS queue_tokens;');
    await queryRunner.query('DROP TABLE IF EXISTS point_histories;');
    await queryRunner.query('DROP TABLE IF EXISTS payments;');
    await queryRunner.query('DROP TABLE IF EXISTS reservations;');
    await queryRunner.query('DROP TABLE IF EXISTS seats;');
    await queryRunner.query('DROP TABLE IF EXISTS concert_schedules;');
    await queryRunner.query('DROP TABLE IF EXISTS concerts;');

    // Remove added columns from users
    await queryRunner.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS point,
      DROP COLUMN IF EXISTS version
    `);
  }
}
