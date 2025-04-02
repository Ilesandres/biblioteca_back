const pool = require('../config/db');
const EncryptionService = require('../services/encryptionService');
const encryptionService = new EncryptionService();

// Crear una nueva reseña
const crearResena = async (req, res) => {
    try {
        const { libroId, calificacion, comentario } = req.body;
        const usuarioId = req.user.id;

        // Verificar si el usuario ya ha reseñado este libro
        const [existingResena] = await pool.query(
            'SELECT id FROM resena WHERE usuarioId = ? AND libroId = ?',
            [usuarioId, libroId]
        );

        if (existingResena.length > 0) {
            return res.status(400).json({ error: 'Ya has reseñado este libro' });
        }

        // Crear la reseña
        const [result] = await pool.query(
            'INSERT INTO resena (usuarioId, libroId, calificacion, comentario) VALUES (?, ?, ?, ?)',
            [usuarioId, libroId, calificacion, comentario]
        );

        // Actualizar calificación promedio del libro
        await actualizarCalificacionPromedio(libroId);

        res.status(201).json({
            id: result.insertId,
            libroId,
            calificacion,
            comentario,
            createdAt: new Date()
        });
    } catch (err) {
        console.error('Error al crear reseña:', err);
        res.status(400).json({ error: err.message });
    }
};


const obtenerResenasLibro = async (req, res) => {
    try {
        const { libroId } = req.params;

        if (!libroId) {
            return res.status(400).json({ error: 'Se requiere el ID del libro', resenas: [] });
        }

        const [resenas] = await pool.query(
            `SELECT r.id, r.calificacion, r.comentario, r.createdAt,
                    u.nombre as usuario_nombre
             FROM resena r
             JOIN usuario u ON r.usuarioId = u.id
             WHERE r.libroId = ?
             ORDER BY r.createdAt DESC`,
            [libroId]
        );

        // Desencriptar los nombres de usuario y manejar casos nulos
        const resenasDesencriptadas = resenas.map(resena => ({
            ...resena,
            usuario_nombre: resena.usuario_nombre ? encryptionService.decrypt(resena.usuario_nombre) : 'anónimo'
        }));

        res.json({ resenas: resenasDesencriptadas });
    } catch (err) {
        console.error('Error al obtener reseñas:', err);
        res.status(500).json({ error: err.message, resenas: [] });
    }
};

// Actualizar una reseña
const actualizarResena = async (req, res) => {
    try {
        const { id } = req.params;
        const { calificacion, comentario } = req.body;
        const usuarioId = req.user.id;

        // Verificar que la reseña existe y pertenece al usuario
        const [resena] = await pool.query(
            'SELECT libroId FROM resena WHERE id = ? AND usuarioId = ?',
            [id, usuarioId]
        );

        if (resena.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }

        // Actualizar la reseña
        await pool.query(
            'UPDATE resena SET calificacion = ?, comentario = ? WHERE id = ?',
            [calificacion, comentario, id]
        );

        // Actualizar calificación promedio del libro
        await actualizarCalificacionPromedio(resena[0].libroId);

        res.json({ message: 'Reseña actualizada exitosamente' });
    } catch (err) {
        console.error('Error al actualizar reseña:', err);
        res.status(400).json({ error: err.message });
    }
};

// Eliminar una reseña
const eliminarResena = async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id;

        // Verificar que la reseña existe y pertenece al usuario
        const [resena] = await pool.query(
            'SELECT libroId FROM resena WHERE id = ? AND usuarioId = ?',
            [id, usuarioId]
        );

        if (resena.length === 0) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }

        // Eliminar la reseña
        await pool.query('DELETE FROM resena WHERE id = ?', [id]);

        // Actualizar calificación promedio del libro
        await actualizarCalificacionPromedio(resena[0].libroId);

        res.json({ message: 'Reseña eliminada exitosamente' });
    } catch (err) {
        console.error('Error al eliminar reseña:', err);
        res.status(400).json({ error: err.message });
    }
};

// Función auxiliar para actualizar la calificación promedio de un libro
const actualizarCalificacionPromedio = async (libroId) => {
    const [result] = await pool.query(
        'SELECT AVG(calificacion) as promedio FROM resena WHERE libroId = ?',
        [libroId]
    );

    await pool.query(
        'UPDATE libro SET calificacion_promedio = ? WHERE id = ?',
        [result[0].promedio || 0, libroId]
    );
};

module.exports = {
    crearResena,
    obtenerResenasLibro,
    actualizarResena,
    eliminarResena
};