const jwt = require('jsonwebtoken');
const db = require('../config/db');

const protegerRuta = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No se proporcionó token de autenticación' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar que el usuario existe y está activo
        const [users] = await db.query('SELECT * FROM usuario WHERE id = ?', [decoded.id]);
        const usuario = users[0];

        if (!usuario) {
            return res.status(401).json({ 
                success: false,
                message: 'Usuario no encontrado' 
            });
        }

        // Verificar si el usuario es un agente de soporte
        const [agente] = await db.query('SELECT * FROM support_agent WHERE usuarioId = ?', [usuario.id]);
        
        // Agregar información de agente al objeto de usuario
        usuario.isAgente = agente.length > 0;
        usuario.agenteId = agente[0]?.id;

        req.user = usuario;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expirado' 
            });
        }
        return res.status(401).json({ 
            success: false,
            message: 'Token inválido',
            error: error.message 
        });
    }
};

module.exports = { protegerRuta };