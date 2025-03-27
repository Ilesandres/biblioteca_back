const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');
const EncryptionService = require('../services/encryptionService');
const encryptionService = new EncryptionService();

let io = null;

const getIO = () => io;

// Función para enviar notificaciones pendientes
async function enviarNotificacionesPendientes(userId) {
    try {
        const [notificaciones] = await db.query(
            'SELECT n.*, CASE WHEN n.estado = "leida" THEN true ELSE false END as `read` FROM notificaciones n WHERE n.usuarioId = ? ORDER BY n.createdAt DESC',
            [userId]
        );

        if (notificaciones.length > 0 && io) {
            io.to(`user:${userId}`).emit('notificaciones_pendientes', notificaciones);
        }
    } catch (error) {
        console.error('Error al enviar notificaciones pendientes:', error);
    }
}

// Función para guardar mensaje en la base de datos
async function guardarMensajeChat(data) {
    console.log('memamsasda');
    const { chatId, contenido, usuarioId } = data;
    const [result] = await db.query(
        'INSERT INTO mensaje (chatId, contenido, usuarioId) VALUES (?, ?, ?)',
        [chatId, contenido, usuarioId]
    );
    
    const [mensaje] = await db.query(
        'SELECT m.*, u.nombre as nombreUsuario FROM mensaje m JOIN usuario u ON m.usuarioId = u.id WHERE m.id = ?',
        [result.insertId]
    );
    
    return mensaje[0];
}

// Función para guardar mensaje en la base de datos y emitir eventos
async function procesarMensajeSoporte(data) {
    try {
        console.log('Procesando mensaje de soporte - Datos recibidos:', data);
        const { chatId, contenido, usuarioId, ticketId, tipoMensaje } = data;
        const [result] = await db.query(
            'INSERT INTO support_message (ticketId, emisorId, tipo, mensaje) VALUES (?, ?, ?, ?)',
            [ticketId, usuarioId, tipoMensaje, contenido]
        );
        console.log('Mensaje guardado en BD - ID:', result.insertId);
        
        // Obtener información del ticket y verificar si tiene agente asignado
        const [ticketInfo] = await db.query('SELECT * FROM support_ticket WHERE id = ?', [ticketId]);
        
        if(tipoMensaje === 'agente') {
            // Si es un agente respondiendo y el ticket no tiene agente asignado, asignar este agente
            const [agente] = await db.query('SELECT * FROM support_agent WHERE usuarioId = ?', [usuarioId]);
            if (agente.length > 0 && (!ticketInfo[0].agenteId || ticketInfo[0].agenteId === null)) {
                await db.query('UPDATE support_ticket SET agenteId = ? WHERE id = ?', [agente[0].id, ticketId]);
            }
        }
        
        // Obtener el mensaje con el nombre encriptado
        const [mensaje] = await db.query(
            `SELECT m.*, u.nombre as nombreEmisorEncriptado
             FROM support_message m
             JOIN usuario u ON m.emisorId = u.id
             WHERE m.id = ?`,
            [result.insertId]
        );

        // Desencriptar el nombre del emisor
        const nombreEmisorDesencriptado = await encryptionService.decrypt(mensaje[0].nombreEmisorEncriptado);

        // Asegurar que el mensaje tenga la estructura correcta
        const mensajeFormateado = {
            mensajeId: mensaje[0].id,
            ticketId: mensaje[0].ticketId,
            emisorId: mensaje[0].emisorId,
            tipo: mensaje[0].tipo,
            mensaje: mensaje[0].mensaje,
            leido: mensaje[0].leido || 0,
            createdAt: mensaje[0].createdAt,
            nombreEmisor: nombreEmisorDesencriptado
        };
        console.log('Mensaje formateado para envío:', mensajeFormateado);
        return mensajeFormateado;
    } catch (error) {
        console.error('Error al procesar mensaje de soporte:', error);
        throw error;
    }
}

const initializeSocket = (server) => {
    if (!io) {
        io = socketIO(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "http://localhost:3000",
                methods: ["GET", "POST", "PUT"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        // Autenticación de WebSocket
        io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                if (!token) {
                    return next(new Error('Autenticación requerida'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.user = decoded;

                // Si es agente, unirlo a la sala de agentes
                if (decoded.isAgente) {
                    socket.join('agentes');
                    // Actualizar estado del agente si está disponible
                    if (decoded.agenteId) {
                        await db.query(
                            'UPDATE support_agent SET estado = ? WHERE id = ?',
                            [decoded.estadoAgente || 'disponible', decoded.agenteId]
                        );
                    }
                }

                next();
            } catch (error) {
                console.error('Error de autenticación socket:', error);
                next(new Error('Token inválido'));
            }
        });


        io.on('connection', (socket) => {
            console.log(`Usuario ${socket.userId} conectado${socket.user.isAgente ? ' (Agente)' : ''}`);

            // Unir al usuario a su sala personal para notificaciones
            socket.join(`user:${socket.userId}`);
            
            // Enviar notificaciones pendientes al usuario
            enviarNotificacionesPendientes(socket.userId);
            db.query('UPDATE usuario SET online=1 WHERE id=?',[socket.userId])

            // Escuchar eventos de notificaciones
            socket.on('mark_notification_read', async (notificationId) => {
                try {
                    await db.query(
                        'UPDATE notificaciones SET estado = "leida" WHERE id = ? AND usuarioId = ?',
                        [notificationId, socket.userId]
                    );
                    
                    socket.emit('notification_update', { id: notificationId, read: true });
                } catch (error) {
                    console.error('Error al marcar notificación como leída:', error);
                }
            });

            socket.on('clear_all_notifications', async () => {
                try {
                    await db.query(
                        'UPDATE notificaciones SET estado = "leida" WHERE usuarioId = ?',
                        [socket.userId]
                    );
                    
                    socket.emit('notifications_cleared');
                } catch (error) {
                    console.error('Error al limpiar notificaciones:', error);
                }
            });

            // Eventos de chat de soporte
            socket.on('join_ticket', async (ticketId) => {
                try {
                    const [ticket] = await db.query(
                        `SELECT t.* FROM support_ticket t
                         LEFT JOIN support_agent sa ON sa.usuarioId = ?
                         WHERE t.id = ? AND (t.usuarioId = ? OR sa.id IS NOT NULL OR ? IN (SELECT id FROM usuario WHERE rol = 'admin'))`,
                        [socket.userId, ticketId, socket.userId, socket.userId]
                    );

                    if (ticket.length > 0) {
                        socket.join(`ticket:${ticketId}`);
                        socket.emit('joined_ticket', ticketId);
                        console.log(`Usuario ${socket.userId} unido al ticket ${ticketId}`);
                    } else {
                        console.log(`Acceso denegado al ticket ${ticketId} para el usuario ${socket.userId}`);
                        socket.emit('error_ticket', { message: 'No tienes permiso para acceder a este ticket' });
                    }
                } catch (error) {
                    console.error('Error al unirse al ticket:', error);
                    socket.emit('error_ticket', { message: 'Error al unirse al ticket' });
                }
            });

            socket.on('leave_ticket', (ticketId) => {
                console.log('saliendo de ticket')
                socket.leave(`ticket:${ticketId}`);
                socket.emit('left_ticket', ticketId);
            });

            socket.on('typing_support', async (data) => {
                try {
                    const { ticketId } = data;
                    const [ticket] = await db.query(
                        'SELECT * FROM support_ticket WHERE id = ? AND (usuarioId = ? OR ? IN (SELECT id FROM usuario WHERE rol = "admin"))',
                        [ticketId, socket.userId, socket.userId]
                    );

                    if (ticket.length > 0) {
                        socket.to(`ticket:${ticketId}`).emit('user_typing_support', {
                            ticketId,
                            userId: socket.userId
                        });
                    }
                } catch (error) {
                    console.error('Error al emitir typing:', error);
                }
            });

            socket.on('send_support_message', async (data) => {
                console.log('Iniciando procesamiento de mensaje de soporte');
                const [agente]= await db.query('SELECT * FROM support_agent WHERE usuarioId=?',[data.usuarioId]);
                const [admin]= await db.query('SELECT rol FROM usuario WHERE id=?',[data.usuarioId])
                if(agente.length>0 || admin[0].rol=='admin'){
                    data.tipoMensaje='agente';
                }

                console.log('Datos recibidos del cliente:', {
                    ticketId: data.ticketId,
                    contenido: data.contenido,
                    usuarioId: data.usuarioId,
                    tipoMensaje: data.tipoMensaje
                });

                try {
                    // Verificar si el usuario está en la sala del ticket
                    if (!socket.rooms.has(`ticket:${data.ticketId}`)) {
                        console.log('Usuario no está en la sala del ticket');
                        socket.emit('error_mensaje_soporte', { message: 'No estás conectado a la sala del ticket' });
                        return;
                    }

                    const mensaje = await procesarMensajeSoporte(data);
                    console.log('Mensaje procesado exitosamente:', mensaje);
                    
                    // Emitir el mensaje a todos en la sala excepto el emisor
                    socket.to(`ticket:${data.ticketId}`).emit('nuevo_mensaje_soporte', mensaje);
                    console.log('Mensaje emitido a otros participantes en la sala');
                    
                    // Emitir confirmación al emisor incluyendo el mensaje
                    socket.emit('nuevo_mensaje_soporte', mensaje);
                    console.log('Mensaje emitido al emisor');

                    // Confirmar al emisor que el mensaje fue enviado
                    socket.emit('mensaje_enviado_confirmacion', {
                        success: true,
                        mensajeId: mensaje.id
                    });
                } catch (error) {
                    console.error('Error al enviar mensaje de soporte:', error);
                    socket.emit('error_mensaje_soporte', { message: 'Error al enviar el mensaje' });
                }
            });

            socket.on('disconnect', () => {
                console.log(`Usuario ${socket.userId} desconectado${socket.user.isAgente ? ' (Agente)' : ''}`);
                // Si es agente, actualizar su estado a offline
                db.query('UPDATE usuario SET online =0 WHERE id =?',[socket.userId])
                if (socket.user.isAgente && socket.user.agenteId) {
                    db.query(
                        'UPDATE support_agent SET estado = "offline" WHERE id = ?',
                        [socket.user.agenteId]
                    ).catch(error => {
                        console.error('Error al actualizar estado del agente:', error);
                    });
                }
            });
        });
    }
    return io;
};

module.exports = { 
    initializeSocket,
    getIO,
    enviarNotificacionesPendientes,
    procesarMensajeSoporte
};

