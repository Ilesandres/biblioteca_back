const Chat = require('./chatModel');
const Usuario = require('../models/Usuario');
const { enviarNotificacion, enviarNotificacionAdmin } = require('../config/socket');

// ¡Iniciar una nueva conversación de soporte!
const iniciarChat = async (req, res) => {
    try {
        const chat = await Chat.create({
            usuario: req.usuario.id,
            tipo: 'soporte'
        });

        // Notificar a los administradores
        enviarNotificacionAdmin({
            tipo: 'nuevo_chat',
            mensaje: '¡Nuevo chat de soporte iniciado!',
            chatId: chat._id
        });

        res.status(201).json({
            success: true,
            data: chat
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al iniciar chat',
            error: error.message
        });
    }
};

// ¡Enviar un mensaje en el chat!
const enviarMensaje = async (req, res) => {
    try {
        const { chatId, mensaje } = req.body;
        const nuevoMensaje = {
            usuario: req.usuario.id,
            contenido: mensaje,
            timestamp: new Date()
        };

        const chat = await Chat.findByIdAndUpdate(
            chatId,
            { $push: { mensajes: nuevoMensaje } },
            { new: true }
        );

        // Notificar a través de WebSocket
        if (req.usuario.rol === 'admin') {
            enviarNotificacion(chat.usuario, {
                tipo: 'mensaje_chat',
                mensaje: 'Nuevo mensaje de soporte',
                chatId
            });
        } else {
            enviarNotificacionAdmin({
                tipo: 'mensaje_chat',
                mensaje: 'Nuevo mensaje de usuario',
                chatId
            });
        }

        res.json({
            success: true,
            data: nuevoMensaje
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

module.exports = {
    iniciarChat,
    enviarMensaje
}; 