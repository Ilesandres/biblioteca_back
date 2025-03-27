const { Socket } = require('socket.io');
const pool = require('../config/db');
const { enviarNotificacionesPendientes, getIO } = require('../config/socket');


// Crear un nuevo préstamo
const crearPrestamo = async (req, res) => {
    try {
        const { libroId, fechaDevolucion } = req.body;
        const libro_id = libroId; 
        const usuario_id = req.user.id;

        const [libro] = await pool.query('SELECT CASE WHEN stock > 0 THEN TRUE ELSE FALSE END as disponible FROM libro WHERE id = ?', [libro_id]);
        const [libro1] = await pool.query('SELECT titulo,autor FROM libro WHERE id =?', [libro_id]);
        
        if (libro.length === 0) {
            return res.status(404).json({ error: 'Libro no encontrado' });
        }

        if (!libro[0].disponible) {
            return res.status(400).json({ error: 'El libro no está disponible' });
        }

        // Crear el préstamo
        const [result] = await pool.query(
            'INSERT INTO prestamo (usuarioId, libroId, fechaPrestamo, fechaDevolucion) VALUES (?, ?, NOW(), ?)',
            [usuario_id, libro_id, fechaDevolucion]
        );

        // Obtener la fecha de devolución
        const fechaDevolucionReal = new Date();

        //crear notificacion
        console.log('libro : ', libro1)
        const mensaje = `Se ha solicitado el libro : ${libro1[0].titulo}`;
        console.log('mensaje : ', mensaje)
        const tipo="prestamo";

        // Crear la notificación y enviarla
        const [notificacionResult] = await pool.query(
            `INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado, createdAt) VALUES (?, ?, ?, 'no_leida', NOW())`,
            [usuario_id, mensaje, tipo]
        );

        if (notificacionResult.insertId) {
            try {
                await enviarNotificacionesPendientes(usuario_id);
            } catch (notifError) {
                console.error('Error al enviar notificación:', notifError);
                // Continuamos con el préstamo aunque falle la notificación
            }
        }

        // Actualizar stock del libro
        await pool.query('UPDATE libro SET stock = stock - 1 WHERE id = ?', [libro_id]);

        res.status(201).json({
            id: result.insertId,
            usuario_id,
            libro_id,
            fecha_prestamo: new Date(),
            fecha_devolucion: fechaDevolucion
        });
    } catch (err) {
        console.error('Error al crear préstamo:', err);
        res.status(400).json({ error: err.message });
    }
};

// Devolver un libro
const devolverLibro = async (req, res) => {
    try {
        const { id } = req.params;
        const estado="devuelto";

        // Verificar que el préstamo existe y pertenece al usuario
        const [prestamo] = await pool.query(
            'SELECT p.libroId, l.titulo FROM prestamo p JOIN libro l ON p.libroId = l.id WHERE p.id = ? AND p.usuarioId = ? AND p.fechaDevolucionReal IS NULL',
            [id, req.user.id]
        );

        if (prestamo.length === 0) {
            return res.status(404).json({ error: 'Préstamo no encontrado o ya devuelto' });
        }

        // Actualizar fecha de devolución
        await pool.query(
            'UPDATE prestamo SET fechaDevolucionReal = NOW(), estado = ?  WHERE id = ?',
            [estado, id]
        );

        // Actualizar stock del libro
        await pool.query(
            'UPDATE libro SET stock = stock + 1 WHERE id = ?',
            [prestamo[0].libroId]
        );

        // Crear notificación de devolución
        const mensaje = `Has devuelto el libro: ${prestamo[0].titulo}`;
        const tipo = "devolucion";

        const [notificacionResult] = await pool.query(
            `INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado, createdAt) VALUES (?, ?, ?, 'no_leida', NOW())`,
            [req.user.id, mensaje, tipo]
        );

        if (notificacionResult.insertId) {
            try {
                await enviarNotificacionesPendientes(req.user.id);
            } catch (notifError) {
                console.error('Error al enviar notificación:', notifError);
            }
        }

        res.json({ message: 'Libro devuelto exitosamente' });
    } catch (err) {
        console.error('Error al devolver libro:', err);
        res.status(400).json({ error: err.message });
    }
};

// Obtener todos los préstamos activos
const obtenerPrestamosActivos = async (req, res) => {
    try {
        const [prestamos] = await pool.query(
            `SELECT p.id, p.fechaPrestamo, p.fechaDevolucion, 
                    l.titulo as libro_titulo, l.portada as libro_Portada,
                     u.nombre as usuario_nombre
             FROM prestamo p
             JOIN libro l ON p.libroId = l.id
             JOIN usuario u ON p.usuarioId = u.id
             WHERE p.fechaDevolucion IS NULL
             ORDER BY p.fechaPrestamo DESC`
        );

        res.json(prestamos);
    } catch (err) {
        console.error('Error al obtener préstamos activos:', err);
        res.status(400).json({ error: err.message });
    }
};

// Obtener historial de préstamos del usuario autenticado
const obtenerHistorialPrestamos = async (req, res) => {
    try {
        const [prestamos] = await pool.query(
            `SELECT p.id, p.fechaPrestamo, p.fechaDevolucion, p.estado as estado_prestamo,
                    l.titulo as libro_titulo, l.portada as libro_Portada,
                     l.autor as libro_autor, u.nombre as usuario_nombre
             FROM prestamo p
             JOIN libro l ON p.libroId = l.id
             JOIN usuario u ON p.usuarioId = u.id
             WHERE p.usuarioId = ?
             ORDER BY p.fechaPrestamo DESC`,
            [req.user.id]
        );

        res.json(prestamos);
    } catch (err) {
        console.error('Error al obtener historial de préstamos:', err);
        res.status(400).json({ error: err.message });
    }
};

// Obtener todos los préstamos (Admin)
const obtenerTodosPrestamos = async (req, res) => {
    try {
        const [prestamos] = await pool.query(
            `SELECT p.id, p.fechaPrestamo, p.fechaDevolucion, p.estado as estado_prestamo,
                    l.titulo as libro_titulo, l.portada as libro_Portada,
                     l.autor as libro_autor, u.nombre as usuario_nombre
             FROM prestamo p
             JOIN libro l ON p.libroId = l.id
             JOIN usuario u ON p.usuarioId = u.id
             ORDER BY p.fechaPrestamo DESC`
        );

        res.json(prestamos);
    } catch (err) {
        console.error('Error al obtener todos los préstamos:', err);
        res.status(400).json({ error: err.message });
    }
};

// Extender la fecha de devolución de un préstamo
const extenderPrestamo = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el préstamo existe y pertenece al usuario
        const [prestamo] = await pool.query(
            'SELECT p.*, l.titulo FROM prestamo p JOIN libro l ON p.libroId = l.id WHERE p.id = ? AND p.usuarioId = ? AND p.fechaDevolucionReal IS NULL',
            [id, req.user.id]
        );

        if (prestamo.length === 0) {
            return res.status(404).json({ error: 'Préstamo no encontrado o ya devuelto' });
        }

        // Extender la fecha de devolución por 7 días desde la fecha actual
        const nuevaFechaDevolucion = new Date();
        nuevaFechaDevolucion.setDate(nuevaFechaDevolucion.getDate() + 7);

        // Actualizar la fecha de devolución
        await pool.query(
            'UPDATE prestamo SET fechaDevolucion = ? WHERE id = ?',
            [nuevaFechaDevolucion, id]
        );

        // Crear notificación de extensión
        const mensaje = `Se ha extendido el tiempo de préstamo del libro: ${prestamo[0].titulo} por 7 días más`;
        const tipo = "extension";

        const [notificacionResult] = await pool.query(
            `INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado, createdAt) VALUES (?, ?, ?, 'no_leida', NOW())`,
            [req.user.id, mensaje, tipo]
        );

        if (notificacionResult.insertId) {
            try {
                await enviarNotificacionesPendientes(req.user.id);
            } catch (notifError) {
                console.error('Error al enviar notificación:', notifError);
            }
        }

        res.json({
            message: 'Fecha de devolución extendida exitosamente',
            nueva_fecha_devolucion: nuevaFechaDevolucion
        });
    } catch (err) {
        console.error('Error al extender préstamo:', err);
        res.status(400).json({ error: err.message });
    }
};

module.exports = {
    crearPrestamo,
    devolverLibro,
    obtenerPrestamosActivos,
    obtenerHistorialPrestamos,
    obtenerTodosPrestamos,
    extenderPrestamo
};