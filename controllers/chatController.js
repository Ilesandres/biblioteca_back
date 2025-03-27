const { Chat, Mensaje, Usuario } = require('../models');
const { enviarNotificacion, enviarNotificacionAdmin } = require('../config/socket');
const { cloudinary } = require('../config/cloudinary');

// ¡Iniciar una nueva conversación de soporte!
const iniciarChat = async (req, res) => {
    try {
        const chat = await Chat.create({
            usuarioId: req.usuario.id
        });

        const chatCompleto = await Chat.findByPk(chat.id, {
            include: [
                {
                    model: Usuario,
                    attributes: ['nombre']
                }
            ]
        });

        // Notificar a los administradores
        enviarNotificacionAdmin({
            tipo: 'nuevo_chat',
            mensaje: '¡Nuevo chat de soporte iniciado!',
            chatId: chat.id
        });

        res.status(201).json({
            success: true,
            data: chatCompleto
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
        const { chatId, contenido } = req.body;
        
        const mensaje = await Mensaje.create({
            chatId,
            usuarioId: req.usuario.id,
            contenido
        });

        // Actualizar timestamp del último mensaje
        await Chat.update(
            { ultimoMensaje: new Date() },
            { where: { id: chatId } }
        );

        const mensajeCompleto = await Mensaje.findByPk(mensaje.id, {
            include: [
                {
                    model: Usuario,
                    attributes: ['nombre', 'rol']
                }
            ]
        });

        // Notificar según el rol del usuario
        if (req.usuario.rol === 'admin') {
            enviarNotificacion(mensajeCompleto.Chat.usuarioId, {
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
            data: mensajeCompleto
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

// ¡Buscar en el historial de mensajes!
const buscarMensajes = async (req, res) => {
    try {
        const { termino, fechaInicio, fechaFin, chatId } = req.query;
        const where = { chatId };

        // Búsqueda por contenido
        if (termino) {
            where.contenido = { [Op.like]: `%${termino}%` };
        }

        // Filtro por fecha
        if (fechaInicio || fechaFin) {
            where.createdAt = {};
            if (fechaInicio) where.createdAt[Op.gte] = new Date(fechaInicio);
            if (fechaFin) where.createdAt[Op.lte] = new Date(fechaFin);
        }

        const mensajes = await Mensaje.findAll({
            where,
            include: [{
                model: Usuario,
                attributes: ['nombre', 'rol']
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            data: mensajes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al buscar mensajes',
            error: error.message
        });
    }
};

// ¡Marcar mensajes como leídos!
const marcarComoLeido = async (req, res) => {
    try {
        const { chatId } = req.params;
        
        await Mensaje.update(
            { leido: true },
            {
                where: {
                    chatId,
                    usuarioId: { [Op.ne]: req.usuario.id },
                    leido: false
                }
            }
        );

        res.json({
            success: true,
            message: 'Mensajes marcados como leídos'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al marcar mensajes como leídos',
            error: error.message
        });
    }
};

// ¡Obtener mensajes no leídos!
const obtenerMensajesNoLeidos = async (req, res) => {
    try {
        const mensajes = await Mensaje.findAll({
            where: {
                usuarioId: { [Op.ne]: req.usuario.id },
                leido: false
            },
            include: [{
                model: Chat,
                where: {
                    [Op.or]: [
                        { usuarioId: req.usuario.id },
                        { '$Mensaje.Usuario.rol$': 'admin' }
                    ]
                }
            }]
        });

        res.json({
            success: true,
            data: mensajes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener mensajes no leídos',
            error: error.message
        });
    }
};

// ¡Enviar mensaje con archivos adjuntos!
const enviarMensajeConAdjuntos = async (req, res) => {
    try {
        const { chatId, contenido } = req.body;
        const archivos = req.files || [];

        // Procesar archivos adjuntos
        const adjuntos = archivos.map(file => ({
            url: file.path,
            tipo: file.mimetype,
            nombre: file.originalname,
            tamaño: file.size
        }));

        const tipoMensaje = adjuntos.length > 0 
            ? (contenido ? 'mixto' : 'archivo')
            : 'texto';

        const mensaje = await Mensaje.create({
            chatId,
            usuarioId: req.usuario.id,
            contenido,
            adjuntos,
            tipoMensaje
        });

        // Actualizar timestamp y notificar
        await Promise.all([
            Chat.update(
                { ultimoMensaje: new Date() },
                { where: { id: chatId } }
            ),
            notificarNuevoMensaje(mensaje, req.usuario)
        ]);

        const mensajeCompleto = await Mensaje.findByPk(mensaje.id, {
            include: [{
                model: Usuario,
                attributes: ['nombre', 'rol']
            }]
        });

        res.json({
            success: true,
            data: mensajeCompleto
        });
    } catch (error) {
        // Si hay error, eliminar archivos subidos
        if (req.files) {
            await Promise.all(req.files.map(file => 
                cloudinary.uploader.destroy(file.filename)
            ));
        }

        res.status(400).json({
            success: false,
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

// Función auxiliar para notificaciones
const notificarNuevoMensaje = async (mensaje, usuario) => {
    const notificacion = {
        tipo: 'mensaje_chat',
        chatId: mensaje.chatId,
        mensaje: mensaje.tipoMensaje === 'archivo' 
            ? 'Nuevo archivo compartido'
            : 'Nuevo mensaje'
    };

    if (usuario.rol === 'admin') {
        await enviarNotificacion(mensaje.Chat.usuarioId, notificacion);
    } else {
        await enviarNotificacionAdmin(notificacion);
    }
};

module.exports = {
    iniciarChat,
    enviarMensaje,
    buscarMensajes,
    marcarComoLeido,
    obtenerMensajesNoLeidos,
    enviarMensajeConAdjuntos
}; 