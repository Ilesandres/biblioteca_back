-- Initialize Database Schema
DROP DATABASE IF EXISTS biblioteca;
CREATE DATABASE IF NOT EXISTS biblioteca;
USE biblioteca;

-- Create Tables
CREATE TABLE IF NOT EXISTS usuario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre TEXT NOT NULL, -- Cambiado a TEXT para datos encriptados
    email TEXT NOT NULL, -- Cambiado a TEXT para datos encriptados
    PASSWORD VARCHAR(255) NOT NULL,
    profilePhoto MEDIUMBLOB,
    rol ENUM('admin', 'usuario') DEFAULT 'usuario',
    online BOOLEAN DEFAULT FALSE,
    lastSeen TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (email(255)) -- Índice único en los primeros 255 caracteres del email encriptado
);

CREATE TABLE IF NOT EXISTS categoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS libro (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo TEXT NOT NULL, -- Cambiado a TEXT para datos encriptados
    autor TEXT NOT NULL, -- Cambiado a TEXT para datos encriptados
    editorial TEXT, -- Cambiado a TEXT para datos encriptados
    portada VARCHAR(255),
    stock INT NOT NULL DEFAULT 0,
    isbn TEXT, -- Cambiado a TEXT para datos encriptados
    anioPublicacion DATE,
    descripcion TEXT,
    calificacion_promedio DECIMAL(3,2) DEFAULT 0.00,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS librocategoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    libroId INT NOT NULL,
    categoriaId INT NOT NULL,
    FOREIGN KEY (libroId) REFERENCES libro(id) ON DELETE CASCADE,
    FOREIGN KEY (categoriaId) REFERENCES categoria(id) ON DELETE CASCADE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_libro_categoria (libroId, categoriaId)
);

CREATE TABLE IF NOT EXISTS prestamo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuarioId INT NOT NULL,
    libroId INT NOT NULL,
    fechaPrestamo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fechaDevolucion TIMESTAMP NULL,
    fechaDevolucionReal TIMESTAMP NULL,
    estado ENUM('prestado', 'devuelto', 'vencido', 'renovado') DEFAULT 'prestado',
    renovaciones INT DEFAULT 0,
    notas TEXT, -- Cambiado a TEXT para datos encriptados
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE RESTRICT,
    FOREIGN KEY (libroId) REFERENCES libro(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS resena (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuarioId INT NOT NULL,
    libroId INT NOT NULL,
    calificacion INT CHECK (calificacion BETWEEN 1 AND 5),
    comentario TEXT, -- Ya era TEXT, adecuado para datos encriptados
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE CASCADE,
    FOREIGN KEY (libroId) REFERENCES libro(id) ON DELETE CASCADE
);
CREATE TABLE files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    drive_id VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_link TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auditoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tabla VARCHAR(50) NOT NULL,
    accion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    registroId INT NOT NULL,
    usuarioId INT,
    datosAnteriores JSON,
    datosNuevos JSON,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE SET NULL
);

-- Insert Initial Data

-- Categories
INSERT INTO categoria (nombre) VALUES
('Ficción'),
('No Ficción'),
('Ciencia'),
('Historia'),
('Literatura'),
('Tecnología'),
('Arte'),
('Filosofía');

-- Sample Admin User (password: admin123)
INSERT INTO usuario (nombre, email, password, rol) VALUES
('Administrador', 'admin@biblioteca.com', '$2b$10$3NxM.N8uVoA8Ux/H.YR4/.BzYPzUZWt0m8MeHh3QyxcOEiIBG.Iva', 'admin');

-- Create Table for Notifications
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuarioId INT NOT NULL,
    mensaje TEXT NOT NULL, -- Ya era TEXT, adecuado para datos encriptados
    tipo VARCHAR(50) NOT NULL,
    estado ENUM('leida', 'no_leida') DEFAULT 'no_leida',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE CASCADE
);

-- Create Support Chat Tables
CREATE TABLE IF NOT EXISTS support_agent (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuarioId INT NOT NULL,
    estado ENUM('disponible', 'ocupado', 'offline') DEFAULT 'offline',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_ticket (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuarioId INT NOT NULL,
    agenteId INT,
    asunto TEXT NOT NULL, -- Cambiado a TEXT para datos encriptados
    estado ENUM('pendiente', 'en_proceso', 'resuelto', 'cerrado') DEFAULT 'pendiente',
    prioridad ENUM('baja', 'media', 'alta') DEFAULT 'media',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE CASCADE,
    FOREIGN KEY (agenteId) REFERENCES support_agent(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_message (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticketId INT NOT NULL,
    emisorId INT NOT NULL,
    tipo ENUM('usuario', 'agente') NOT NULL,
    mensaje TEXT NOT NULL, -- Ya era TEXT, adecuado para datos encriptados
    leido BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticketId) REFERENCES support_ticket(id) ON DELETE CASCADE,
    FOREIGN KEY (emisorId) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE `files` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_link` TEXT NOT NULL,
  `uploaded_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `drive_id` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `files_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
);



-- Create Indexes for Support Chat
CREATE INDEX idx_support_ticket_estado ON support_ticket(estado);
CREATE INDEX idx_support_ticket_prioridad ON support_ticket(prioridad);
CREATE INDEX idx_support_message_ticket ON support_message(ticketId);
CREATE INDEX idx_support_agent_estado ON support_agent(estado);
CREATE INDEX idx_libro_titulo ON libro(titulo(255)); -- Índice en los primeros 255 caracteres del título encriptado
CREATE INDEX idx_libro_autor ON libro(autor(255)); -- Índice en los primeros 255 caracteres del autor encriptado
CREATE INDEX idx_libro_isbn ON libro(isbn(255)); -- Índice en los primeros 255 caracteres del ISBN encriptado
CREATE INDEX idx_prestamo_estado ON prestamo(estado);
CREATE INDEX idx_prestamo_fechas ON prestamo(fechaPrestamo, fechaDevolucion);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);
CREATE INDEX idx_librocategoria_libro ON librocategoria(libroId);
CREATE INDEX idx_librocategoria_categoria ON librocategoria(categoriaId);