const pool = require('../config/db');
const { getIO } = require('../config/socket');
const EncryptionService = require('../services/encryptionService');
const encryptionService = new EncryptionService();

// Crear un nuevo ticket de soporte
const crearTicket = async (req, res) => {
    try {
        const { asunto, mensaje } = req.body;
        const usuarioId = req.user.id;

        // Crear el ticket
        const [ticketResult] = await pool.query(
            'INSERT INTO support_ticket (usuarioId, asunto, estado) VALUES (?, ?, "pendiente")',
            [usuarioId, asunto]
        );

        const ticketId = ticketResult.insertId;

        // Crear el primer mensaje
        await pool.query(
            'INSERT INTO support_message (ticketId, emisorId, tipo, mensaje) VALUES (?, ?, "usuario", ?)',
            [ticketId, usuarioId, mensaje]
        );

        // Obtener el ticket creado con toda su información
        const [ticket] = await pool.query(
            `SELECT t.*, 
                    (SELECT COUNT(*) FROM support_message WHERE ticketId = t.id AND tipo = 'agente' AND leido = FALSE) as mensajesNoLeidos
             FROM support_ticket t 
             WHERE t.id = ?`,
            [ticketId]
        );

        // Notificar a los administradores
        const [admins] = await pool.query(
            'SELECT id FROM usuario WHERE rol = "admin"'
        );

        // Crear notificaciones para cada admin
        const io = getIO();
        for (const admin of admins) {
            await pool.query(
                'INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado) VALUES (?, ?, "soporte", "no_leida")',
                [admin.id, `Nuevo ticket de soporte: ${asunto}`]
            );
            
            // Emitir notificación por socket
            if (io) {
                io.to(`user:${admin.id}`).emit('nueva_notificacion', {
                    mensaje: `Nuevo ticket de soporte: ${asunto}`,
                    tipo: 'soporte'
                });
            }
        }

        res.status(201).json({
            message: 'Ticket creado exitosamente',
            ticket: ticket[0]
        });
    } catch (err) {
        console.error('Error al crear ticket:', err);
        res.status(500).json({ error: 'Error al crear el ticket' });
    }
};

// Obtener tickets del usuario
const obtenerMisTickets = async (req, res) => {
    try {
        const usuarioId = req.user.id;
        const [tickets] = await pool.query(
            `SELECT t.*, u.nombre as nombreUsuarioEncriptado,
                    (SELECT COUNT(*) FROM support_message WHERE ticketId = t.id AND tipo = 'agente' AND leido = FALSE) as mensajesNoLeidos,
                    (SELECT nombre FROM usuario WHERE id = 
                        (SELECT usuarioId FROM support_agent WHERE id = t.agenteId)) as agenteAsignadoEncriptado
             FROM support_ticket t 
             JOIN usuario u ON t.usuarioId = u.id
             WHERE t.usuarioId = ?
             ORDER BY t.updatedAt DESC`,
            [usuarioId]
        );

        // Desencriptar nombres
        const ticketsDesencriptados = await Promise.all(tickets.map(async ticket => ({
            ...ticket,
            nombreUsuario: await encryptionService.decrypt(ticket.nombreUsuarioEncriptado),
            agenteAsignado: ticket.agenteAsignadoEncriptado ? await encryptionService.decrypt(ticket.agenteAsignadoEncriptado) : null
        })));

        res.json({ tickets: ticketsDesencriptados });
    } catch (err) {
        console.error('Error al obtener tickets:', err);
        res.status(500).json({ error: 'Error al obtener los tickets' });
    }
};

// Obtener tickets para administradores
const obtenerTodosTickets = async (req, res) => {
    console.log('recibiendo datos ');
    console.log('user : ',req.user.id);
    try {
        const usuarioId = req.user.id;

        // Verificar si el usuario es un agente
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [usuarioId]
        );

        let tickets;
        if (agente.length > 0) {
            // Si es agente, obtener tickets asignados a él y tickets sin asignar
            const [result] = await pool.query(
                `SELECT t.*, u.nombre as nombreUsuarioEncriptado,
                    (SELECT COUNT(*) FROM support_message 
                     WHERE ticketId = t.id AND tipo = 'usuario' AND leido = FALSE) as mensajesNoLeidos,
                    (SELECT nombre FROM usuario WHERE id = 
                        (SELECT usuarioId FROM support_agent WHERE id = t.agenteId)) as agenteAsignadoEncriptado
                 FROM support_ticket t 
                 JOIN usuario u ON t.usuarioId = u.id
                 WHERE t.agenteId = ? OR t.agenteId IS NULL
                 ORDER BY t.createdAt DESC`,
                [agente[0].id]
            );
            
            // Desencriptar nombres
            tickets = await Promise.all(result.map(async ticket => ({
                ...ticket,
                nombreUsuario: await encryptionService.decrypt(ticket.nombreUsuarioEncriptado),
                agenteAsignado: ticket.agenteAsignadoEncriptado ? await encryptionService.decrypt(ticket.agenteAsignadoEncriptado) : null
            })));
        } else {
            // Si es admin, obtener todos los tickets
            const [result] = await pool.query(
                `SELECT t.*, u.nombre as nombreUsuarioEncriptado,
                    (SELECT COUNT(*) FROM support_message 
                     WHERE ticketId = t.id AND tipo = 'usuario' AND leido = FALSE) as mensajesNoLeidos,
                    (SELECT nombre FROM usuario WHERE id = 
                        (SELECT usuarioId FROM support_agent WHERE id = t.agenteId)) as agenteAsignadoEncriptado
                 FROM support_ticket t 
                 JOIN usuario u ON t.usuarioId = u.id
                 ORDER BY t.createdAt DESC`
            );
            
            // Desencriptar nombres
            tickets = await Promise.all(result.map(async ticket => ({
                ...ticket,
                nombreUsuario: await encryptionService.decrypt(ticket.nombreUsuarioEncriptado),
                agenteAsignado: ticket.agenteAsignadoEncriptado ? await encryptionService.decrypt(ticket.agenteAsignadoEncriptado) : null
            })));
        }

        res.json({ tickets });
    } catch (err) {
        console.error('Error al obtener tickets:', err);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
};

// Obtener mensajes de un ticket
const obtenerMensajesTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const usuarioId = req.user.id;

        // Verificar acceso al ticket
        const [ticket] = await pool.query(
            'SELECT * FROM support_ticket WHERE id = ?',
            [ticketId]
        );

        if (!ticket.length) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Verificar si el usuario tiene acceso al ticket
        let tieneAcceso = false;
        let tipo = 'usuario';

        // Verificar si es admin o agente
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [usuarioId]
        );

        // Si es el dueño del ticket
        if (ticket[0].usuarioId === usuarioId) {
            tieneAcceso = true;
            tipo = 'usuario';
        } 
        // Si es un agente registrado o admin
        else if (req.user.rol === 'admin' || agente.length > 0) {
            tieneAcceso = true;
            tipo = 'agente';
        }

        if (!tieneAcceso) {
            return res.status(403).json({ error: 'Acceso no autorizado a este ticket' });
        }

        // Obtener mensajes
        const [mensajes] = await pool.query(
            `SELECT m.*, u.nombre as nombreEmisorEncriptado
             FROM support_message m
             JOIN usuario u ON m.emisorId = u.id
             WHERE m.ticketId = ?
             ORDER BY m.createdAt ASC`,
            [ticketId]
        );

        // Desencriptar nombres de emisores
        const mensajesDesencriptados = await Promise.all(mensajes.map(async mensaje => ({
            ...mensaje,
            nombreEmisor: await encryptionService.decrypt(mensaje.nombreEmisorEncriptado)
        })));

        // Marcar mensajes como leídos
        const tipoUsuario = req.user.rol === 'admin' ? 'usuario' : 'agente';
        await pool.query(
            'UPDATE support_message SET leido = TRUE WHERE ticketId = ? AND tipo = ?',
            [ticketId, tipoUsuario]
        );

        res.json(mensajesDesencriptados);
    } catch (err) {
        console.error('Error al obtener mensajes:', err);
        res.status(500).json({ error: 'Error al obtener los mensajes' });
    }
};

// Enviar mensaje en un ticket sin uso reemplazada por webssocket
const enviarMensaje = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { mensaje } = req.body;
        const usuarioId = req.user.id;
        console.log('id de usuario : '+usuarioId)

        // Verificar si el usuario es un agente registrado
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [usuarioId]
        );

        // Determinar tipo de mensaje
        let tipoMensaje ='usuario';
        if (agente.length > 0) {
            tipoMensaje = 'agente';
        } else if (req.user.rol === 'admin' || req.user.rol === 'agente') {
            return res.status(403).json({ error: 'Debes ser un agente registrado para responder tickets' });
        }
        console.log(tipoMensaje);

        // Verificar acceso al ticket
        const [ticket] = await pool.query(
            'SELECT * FROM support_ticket WHERE id = ?',
            [ticketId]
        );

        if (!ticket.length) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Verificar si el usuario tiene acceso al ticket
        let tieneAcceso = false;

        // Si es el dueño del ticket
        if (ticket[0].usuarioId === usuarioId) {
            tieneAcceso = true;
        } 
        // Si es un agente registrado
        else if (agente.length > 0) {
            tieneAcceso = true;
        }

        if (!tieneAcceso) {
            return res.status(403).json({ error: 'Acceso no autorizado a este ticket' });
        }

        // Procesar y enviar el mensaje a través del socket
        const { procesarMensajeSoporte } = require('../config/socket');
        const mensajeData = await procesarMensajeSoporte({
            ticketId,
            contenido: mensaje,
            usuarioId,
            tipoMensaje
        });

        // Si es un agente respondiendo y el ticket no tiene agente asignado, asignar este agente
        if (tipoMensaje === 'agente' && !ticket[0].agenteId) {
            await pool.query(
                'UPDATE support_ticket SET agenteId = ? WHERE id = ?',
                [agente[0].id, ticketId]
            );
        }

        // Actualizar estado del ticket si está pendiente y es respuesta de agente
        if (ticket[0].estado === 'pendiente' && tipoMensaje === 'agente') {
            await pool.query(
                'UPDATE support_ticket SET estado = "en_proceso" WHERE id = ?',
                [ticketId]
            );
        }

        res.status(201).json({
            message: 'Mensaje enviado exitosamente',
            mensaje: mensajeData
        });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
};

// Cerrar ticket sin uso reemplazada por webssocket
const cerrarTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const usuarioId = req.user.id;

        // Verificar acceso al ticket
        const [ticket] = await pool.query(
            'SELECT * FROM support_ticket WHERE id = ?',
            [ticketId]
        );

        if (!ticket.length) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Verificar si el usuario tiene acceso al ticket
        let tieneAcceso = false;
        let tipo = 'usuario';

        // Verificar si es admin o agente
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [usuarioId]
        );

        // Si es el dueño del ticket
        if (ticket[0].usuarioId === usuarioId) {
            tieneAcceso = true;
            tipo = 'usuario';
        } 
        // Si es un agente registrado o admin
        else if (req.user.rol === 'admin' || agente.length > 0) {
            tieneAcceso = true;
            tipo = 'agente';
        }

        if (!tieneAcceso) {
            return res.status(403).json({ error: 'Acceso no autorizado a este ticket' });
        }

        // Actualizar estado del ticket
        await pool.query(
            'UPDATE support_ticket SET estado = "cerrado" WHERE id = ?',
            [ticketId]
        );

        // Notificar al usuario si un admin cerró el ticket
        if (req.user.rol === 'admin') {
            await pool.query(
                'INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado) VALUES (?, ?, "soporte", "no_leida")',
                [ticket[0].usuarioId, `Tu ticket de soporte "${ticket[0].asunto}" ha sido cerrado`]
            );
            try {
                await enviarNotificacionesPendientes(ticket[0].usuarioId);
            } catch (error) {
                console.error('Error al enviar notificación:', error);
            }
        }

        res.json({ message: 'Ticket cerrado exitosamente' });
    } catch (err) {
        console.error('Error al cerrar ticket:', err);
        res.status(500).json({ error: 'Error al cerrar el ticket' });
    }
};

// Obtener todos los agentes de soporte sin uso reemplazada por webssocket
const obtenerAgentes = async (req, res) => {
    try {
        const [agentes] = await pool.query(
            `SELECT u.id, u.nombre as nombreEncriptado, u.email, u.rol, sa.estado, sa.id as agenteId
             FROM usuario u
             INNER JOIN support_agent sa ON u.id = sa.usuarioId
             ORDER BY u.nombre`
        );

        // Desencriptar nombres de los agentes
        const agentesDesencriptados = await Promise.all(agentes.map(async agente => ({
            ...agente,
            nombre: await encryptionService.decrypt(agente.nombreEncriptado)
        })));

        res.json({ agentes: agentesDesencriptados });
    } catch (err) {
        console.error('Error al obtener agentes:', err);
        res.status(500).json({ error: 'Error al obtener los agentes' });
    }
};

// Actualizar estado del agente
const actualizarEstadoAgente = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        if (!['disponible', 'ocupado', 'offline'].includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Verificar que el usuario sea un agente
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [id]
        );

        if (agente.length === 0) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        const [result] = await pool.query(
            'UPDATE support_agent SET estado = ? WHERE usuarioId = ?',
            [estado, id]
        );

        res.json({ message: 'Estado actualizado exitosamente' });
    } catch (err) {
        console.error('Error al actualizar estado del agente:', err);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
};

// Crear agente de soporte
const crearAgente = async (req, res) => {
    try {
        const { usuarioId } = req.body;

        // Verificar si ya existe
        const [existente] = await pool.query(
            'SELECT * FROM support_agent WHERE usuarioId = ?',
            [usuarioId]
        );

        if (existente.length > 0) {
            return res.status(400).json({ error: 'El usuario ya es agente de soporte' });
        }

        // Verificar que el usuario exista y no sea admin
        const [usuario] = await pool.query(
            'SELECT * FROM usuario WHERE id = ?',
            [usuarioId]
        );

        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (usuario[0].rol === 'admin') {
            return res.status(400).json({ error: 'No se puede convertir un administrador en agente' });
        }

        // Crear registro de agente
        await pool.query(
            'INSERT INTO support_agent (usuarioId, estado) VALUES (?, "offline")',
            [usuarioId]
        );



        res.status(201).json({ message: 'Agente creado exitosamente' });
    } catch (err) {
        console.error('Error al crear agente:', err);
        res.status(500).json({ error: 'Error al crear agente' });
    }
};

// Eliminar agente de soporte
const eliminarAgente = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el usuario sea un agente
        const [agente] = await pool.query(
            'SELECT u.* FROM usuario u INNER JOIN support_agent sa ON u.id = sa.usuarioId WHERE u.id = ?',
            [id]
        );

        if (agente.length === 0) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }

        // Eliminar registro de agente
        await pool.query(
            'DELETE FROM support_agent WHERE usuarioId = ?',
            [id]
        );

        // Actualizar rol en tabla usuario
        await pool.query(
            'UPDATE usuario SET rol = "usuario" WHERE id = ?',
            [id]
        );

        res.json({ message: 'Agente eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar agente:', err);
        res.status(500).json({ error: 'Error al eliminar agente' });
    }
};

// Asignar ticket a un agente
const asignarTicket = async (req, res) => {
    console.log('revisando asignacion ');
    try {
        const { ticketId } = req.params;
        const { agenteId } = req.body;
        console.log('ticked Id :',ticketId);
        console.log('aggenteId ',agenteId);

        // Verificar que el ticket existe
        const [ticket] = await pool.query(
            'SELECT * FROM support_ticket WHERE id = ?',
            [ticketId]
        );
        

        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }
    console.log(ticket.length);
        // Verificar que el agente existe
        const [agente] = await pool.query(
            'SELECT * FROM support_agent WHERE id = ?',
            [agenteId]
        );

        console.log('isAgent ? :' +agente.length);

        if (agente.length === 0) {
            return res.status(404).json({ error: 'Agente no encontrado' });
        }
        
        // Asignar el ticket al agente
        await pool.query(
            'UPDATE support_ticket SET agenteId = ?, estado = "en_proceso" WHERE id = ?',
            [agenteId, ticketId]
        );

        // Notificar al agente
        await pool.query(
            'INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado) VALUES (?, ?, "soporte", "no_leida")',
            [agente[0].usuarioId, `Se te ha asignado un nuevo ticket: ${ticket[0].asunto}`]
        );

        // Emitir notificación por socket
        const io = getIO();
        if (io) {
            io.to(`user:${agente[0].usuarioId}`).emit('nueva_notificacion', {
                mensaje: `Se te ha asignado un nuevo ticket: ${ticket[0].asunto}`,
                tipo: 'soporte'
            });
        }

        res.json({ 
            success: true,
            message: 'Ticket asignado exitosamente' 
        });
    } catch (err) {
        console.error('Error al asignar ticket:', err);
        res.status(500).json({ error: 'Error al asignar el ticket' });
    }
};

// Actualizar estado del ticket
const actualizarEstadoTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { estado } = req.body;

        // Validar estado
        const estadosValidos = ['pendiente', 'en_proceso', 'resuelto', 'cerrado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Verificar que el ticket existe
        const [ticket] = await pool.query(
            'SELECT * FROM support_ticket WHERE id = ?',
            [ticketId]
        );

        if (ticket.length === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Actualizar estado del ticket
        await pool.query(
            'UPDATE support_ticket SET estado = ? WHERE id = ?',
            [estado, ticketId]
        );

        // Notificar al usuario del cambio de estado
        await pool.query(
            'INSERT INTO notificaciones (usuarioId, mensaje, tipo, estado) VALUES (?, ?, "soporte", "no_leida")',
            [ticket[0].usuarioId, `El estado de tu ticket ha sido actualizado a: ${estado}`]
        );

        // Emitir notificación por socket
        const io = getIO();
        if (io) {
            io.to(`user:${ticket[0].usuarioId}`).emit('nueva_notificacion', {
                mensaje: `El estado de tu ticket ha sido actualizado a: ${estado}`,
                tipo: 'soporte'
            });
            
            // Emitir evento de actualización de ticket
            io.emit('ticket_actualizado', {
                ticketId,
                estado
            });
        }

        res.json({ 
            success: true,
            message: 'Estado del ticket actualizado exitosamente' 
        });
    } catch (err) {
        console.error('Error al actualizar estado del ticket:', err);
        res.status(500).json({ error: 'Error al actualizar el estado del ticket' });
    }
};

module.exports = {
    crearTicket,
    obtenerMisTickets,
    obtenerTodosTickets,
    obtenerMensajesTicket,
    enviarMensaje,
    cerrarTicket,
    obtenerAgentes,
    actualizarEstadoAgente,
    crearAgente,
    eliminarAgente,
    asignarTicket,
    actualizarEstadoTicket
};