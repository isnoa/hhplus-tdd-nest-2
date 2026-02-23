import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConcertReservationSchema1709499839547 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        point      INT          NOT NULL DEFAULT 0,
        version    INT          NOT NULL DEFAULT 1,
        createdAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB;
    `);

    // point_histories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS point_histories (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        userId       INT         NOT NULL,
        amount       INT         NOT NULL,
        type         ENUM('CHARGE','USE') NOT NULL,
        balanceAfter INT         NOT NULL,
        createdAt    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_ph_user FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB;
    `);

    // queue_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS queue_tokens (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        userId    INT          NOT NULL,
        token     VARCHAR(36)  NOT NULL UNIQUE,
        status    ENUM('WAITING','ACTIVE','EXPIRED') NOT NULL DEFAULT 'WAITING',
        expiresAt DATETIME     NULL,
        createdAt DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_qt_user_status (userId, status),
        INDEX idx_qt_status_created (status, createdAt)
      ) ENGINE=InnoDB;
    `);

    // concerts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS concerts (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT         NULL,
        createdAt   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB;
    `);

    // concert_schedules
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS concert_schedules (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        concertId    INT         NOT NULL,
        concertDate  DATE        NOT NULL,
        totalSeats   INT         NOT NULL DEFAULT 50,
        price        INT         NOT NULL DEFAULT 0,
        createdAt    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_cs_concert_date (concertId, concertDate),
        CONSTRAINT fk_cs_concert FOREIGN KEY (concertId) REFERENCES concerts(id)
      ) ENGINE=InnoDB;
    `);

    // seats (1~50 per schedule)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        concertScheduleId   INT         NOT NULL,
        seatNumber          INT         NOT NULL,
        status              ENUM('AVAILABLE','TEMP_RESERVED','RESERVED') NOT NULL DEFAULT 'AVAILABLE',
        tempReservedUntil   DATETIME    NULL,
        tempReservedUserId  INT         NULL,
        createdAt           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_seat_schedule_number (concertScheduleId, seatNumber),
        INDEX idx_seat_status (concertScheduleId, status),
        CONSTRAINT fk_seat_schedule FOREIGN KEY (concertScheduleId) REFERENCES concert_schedules(id)
      ) ENGINE=InnoDB;
    `);

    // reservations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        userId             INT         NOT NULL,
        seatId             INT         NOT NULL,
        concertScheduleId  INT         NOT NULL,
        status             ENUM('PENDING','CONFIRMED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
        expiresAt          DATETIME    NOT NULL,
        createdAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_res_user (userId),
        INDEX idx_res_seat (seatId),
        CONSTRAINT fk_res_user FOREIGN KEY (userId) REFERENCES users(id),
        CONSTRAINT fk_res_seat FOREIGN KEY (seatId) REFERENCES seats(id)
      ) ENGINE=InnoDB;
    `);

    // payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        userId        INT         NOT NULL,
        reservationId INT         NOT NULL,
        amount        INT         NOT NULL,
        status        ENUM('COMPLETED','CANCELLED') NOT NULL DEFAULT 'COMPLETED',
        createdAt     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_pay_user (userId),
        CONSTRAINT fk_pay_user FOREIGN KEY (userId) REFERENCES users(id),
        CONSTRAINT fk_pay_reservation FOREIGN KEY (reservationId) REFERENCES reservations(id)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS payments;');
    await queryRunner.query('DROP TABLE IF EXISTS reservations;');
    await queryRunner.query('DROP TABLE IF EXISTS seats;');
    await queryRunner.query('DROP TABLE IF EXISTS concert_schedules;');
    await queryRunner.query('DROP TABLE IF EXISTS concerts;');
    await queryRunner.query('DROP TABLE IF EXISTS queue_tokens;');
    await queryRunner.query('DROP TABLE IF EXISTS point_histories;');
    await queryRunner.query('DROP TABLE IF EXISTS users;');
  }
}
