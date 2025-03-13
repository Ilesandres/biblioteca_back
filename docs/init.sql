-- Initialize Database Schema
DROP DATABASE IF EXISTS biblioteca;
CREATE DATABASE IF NOT EXISTS biblioteca;
USE biblioteca;

-- Create Tables
CREATE TABLE IF NOT EXISTS usuario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    PASSWORD VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'usuario') DEFAULT 'usuario',
    online BOOLEAN DEFAULT FALSE,
    lastSeen TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS libro (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(100) NOT NULL,
    editorial VARCHAR(100),
    portada VARCHAR(255),
    stock INT NOT NULL DEFAULT 0,
    isbn VARCHAR(13),
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
    notas TEXT,
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
    comentario TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuarioId) REFERENCES usuario(id) ON DELETE CASCADE,
    FOREIGN KEY (libroId) REFERENCES libro(id) ON DELETE CASCADE
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
    mensaje TEXT NOT NULL,
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
    asunto VARCHAR(255) NOT NULL,
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
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticketId) REFERENCES support_ticket(id) ON DELETE CASCADE,
    FOREIGN KEY (emisorId) REFERENCES usuario(id) ON DELETE CASCADE
);

-- Create Indexes for Support Chat
CREATE INDEX idx_support_ticket_estado ON support_ticket(estado);
CREATE INDEX idx_support_ticket_prioridad ON support_ticket(prioridad);
CREATE INDEX idx_support_message_ticket ON support_message(ticketId);
CREATE INDEX idx_support_agent_estado ON support_agent(estado);
CREATE INDEX idx_libro_titulo ON libro(titulo);
CREATE INDEX idx_libro_autor ON libro(autor);
CREATE INDEX idx_libro_isbn ON libro(isbn);
CREATE INDEX idx_prestamo_estado ON prestamo(estado);
CREATE INDEX idx_prestamo_fechas ON prestamo(fechaPrestamo, fechaDevolucion);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);
CREATE INDEX idx_librocategoria_libro ON librocategoria(libroId);
CREATE INDEX idx_librocategoria_categoria ON librocategoria(categoriaId);