-- My e-Library: database schema
-- Derived from the queries used in the PHP files; adjust column types if your
-- existing database differs.

CREATE DATABASE IF NOT EXISTS elibrary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE elibrary;

CREATE TABLE IF NOT EXISTS users (
    user_id     INT AUTO_INCREMENT PRIMARY KEY,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    is_admin    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    book_id     INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)  NOT NULL,
    author      VARCHAR(255)  NOT NULL,
    price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    order_date   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status       VARCHAR(30)   NOT NULL DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id  INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    book_id  INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price    DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id)  REFERENCES books(book_id)
);
