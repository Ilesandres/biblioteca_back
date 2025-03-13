const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Registrar un nuevo usuario
const registrarUsuario = async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [existingUser] = await pool.query('SELECT id FROM usuario WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        const [result] = await pool.query(
            'INSERT INTO usuario (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            [nombre, email, hashedPassword, 'usuario']
        );
        const token = jwt.sign(
            { id: result.insertId, email, rol: 'usuario' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: {
                id: result.insertId,
                nombre,
                email,
                rol: 'usuario'
            },
            token
        });
    } catch (err) {
        console.error('Error al registrar usuario:', err);
        res.status(400).json({ error: err.message });
    }
};

// Login de usuario
const loginUsuario = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // Buscar usuario y su información de agente de soporte
        const [users] = await pool.query(
            `SELECT u.*, sa.id as agenteId, sa.estado as estadoAgente 
            FROM usuario u 
            LEFT JOIN support_agent sa ON u.id = sa.usuarioId 
            WHERE LOWER(u.email) = LOWER(?)`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = users[0];
        user.password = user.PASSWORD;

        // Verify if password exists in database
        if (!user.password) {
            return res.status(401).json({ error: 'Error en la autenticación' });
        }

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Actualizar estado online del usuario
        await pool.query('UPDATE usuario SET online = TRUE, lastSeen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generar token JWT con información de agente
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                rol: user.rol,
                isAgente: !!user.agenteId,
                agenteId: user.agenteId,
                estadoAgente: user.estadoAgente
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                id: user.id,
                username: user.nombre,
                email: user.email,
                rol: user.rol,
                isAgente: !!user.agenteId,
                agenteId: user.agenteId,
                estadoAgente: user.estadoAgente
            },
            token
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(400).json({ error: err.message });
    }
};

// Obtener perfil de usuario
const obtenerPerfil = async (req, res) => {
    console.log('respos')
    try {
        const [users] = await pool.query(
            'SELECT id, nombre, createdAt, email FROM usuario WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(users[0]);
    } catch (err) {
        console.error('Error al obtener perfil:', err);
        res.status(400).json({ error: err.message });
    }
};

// Actualizar perfil de usuario
const actualizarPerfil = async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const userId = req.user.id;

        // Si se proporciona una nueva contraseña, hashearla
        let hashedPassword;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        // Construir query dinámicamente basado en los campos proporcionados
        let updateFields = [];
        let queryParams = [];

        if (nombre) {
            updateFields.push('nombre = ?');
            queryParams.push(nombre);
        }
        if (email) {
            updateFields.push('email = ?');
            queryParams.push(email);
        }
        if (hashedPassword) {
            updateFields.push('password = ?');
            queryParams.push(hashedPassword);
        }

        queryParams.push(userId);

        const query = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id = ?`;
        await pool.query(query, queryParams);

        // Obtener usuario actualizado
        const [updatedUser] = await pool.query(
            'SELECT id, nombre, email FROM usuario WHERE id = ?',
            [userId]
        );

        res.json({
            success: true,
            message: '¡Perfil actualizado exitosamente!',
            data: updatedUser[0]
        });
    } catch (err) {
        console.error('Error al actualizar perfil:', err);
        res.status(400).json({ error: err.message });
    }
};

// Obtener historial de préstamos
const obtenerHistorialPrestamos = async (req, res) => {
    try {
        const [prestamos] = await pool.query(
            `SELECT p.id, p.libroId, p.fechaPrestamo, 
                    p.fechaDevolucion, l.titulo as tituloLibro
             FROM prestamo p
             JOIN libro l ON p.libroId = l.id
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

// Obtener estadísticas del usuario
const getStats = async (req, res) => {
    try {
        // Obtener número total de préstamos
        const [prestamosTotal] = await pool.query(
            'SELECT COUNT(*) as total FROM prestamo WHERE usuarioId = ?',
            [req.user.id]
        );
        
        const [reseñasTotal] = await pool.query(
            'SELECT COUNT(*) as total FROM resena WHERE usuarioId =?',
            [req.user.id]
        );

        // Obtener número de libros actualmente prestados
        const [librosActivos] = await pool.query(
            'SELECT COUNT(*) as activos FROM prestamo WHERE usuarioId = ? AND fechaDevolucion IS NULL',
            [req.user.id]
        );

        res.json({
            prestamos: prestamosTotal[0].total,
            prestamosActivos: librosActivos[0].activos,
            reseñas: reseñasTotal[0].total
        });
    } catch (err) {
        console.error('Error al obtener estadísticas:', err);
        res.status(400).json({ error: err.message });
    }
};

// Cerrar sesión de usuario
const logoutUsuario = async (req, res) => {
    try {
        // Actualizar estado online y lastSeen del usuario
        await pool.query(
            'UPDATE usuario SET online = FALSE, lastSeen = CURRENT_TIMESTAMP WHERE id = ?',
            [req.user.id]
        );

        res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        res.status(500).json({ error: 'Error al cerrar sesión' });
    }
};

module.exports = {
    registrarUsuario,
    loginUsuario,
    obtenerPerfil,
    actualizarPerfil,
    obtenerHistorialPrestamos,
    getStats,
    logoutUsuario
};