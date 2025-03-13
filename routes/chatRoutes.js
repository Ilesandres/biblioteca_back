const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middlewares/auth');
const { validarMensaje, validarBusqueda } = require('../middlewares/validator');
const {
    iniciarChat,
    enviarMensaje,
    buscarMensajes,
    marcarComoLeido,
    obtenerMensajesNoLeidos,
    enviarMensajeConAdjuntos
} = require('../controllers/chatController');
const Chat = require('../chat/chatModel');
const { uploadChatFile } = require('../config/cloudinary');

/**
 * @swagger
 * /api/chat/buscar:
 *   get:
 *     summary: Buscar en el historial de mensajes
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: termino
 *         schema:
 *           type: string
 *       - in: query
 *         name: fechaInicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *           format: date
 */
router.get('/buscar', protegerRuta, validarBusqueda, buscarMensajes);

// Rutas para el chat de soporte
router.post('/iniciar', protegerRuta, iniciarChat);
router.post('/mensaje', 
    protegerRuta, 
    uploadChatFile.array('archivos', 5), // Máximo 5 archivos
    validarMensaje, 
    enviarMensajeConAdjuntos
);
router.put('/:chatId/leido', protegerRuta, marcarComoLeido);
router.get('/no-leidos', protegerRuta, obtenerMensajesNoLeidos);

// Obtener historial de chat
router.get('/:chatId', protegerRuta, async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId)
            .populate('usuario', 'nombre')
            .populate('mensajes.usuario', 'nombre rol');

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: 'Chat no encontrado'
            });
        }

        res.json({
            success: true,
            data: chat
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener el chat',
            error: error.message
        });
    }
});

module.exports = router; 