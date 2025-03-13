const { Notificacion } = require('../models');
const { io } = require('../config/socket');
const db = require('../config/db');

class NotificationService {
    static async createNotification(data) {
        try {
            const [result] = await db.query(
                'INSERT INTO notificaciones (usuarioId, tipo, titulo, mensaje, referenciaTipo, referenciaId, estado) VALUES (?, ?, ?, ?, ?, ?, "no_leida")',
                [data.usuarioId, data.tipo, data.titulo || this.getTitleByType(data.tipo), data.mensaje, data.referenciaTipo, data.referenciaId]
            );

            const [notification] = await db.query(
                'SELECT *, false as `read` FROM notificaciones WHERE id = ?',
                [result.insertId]
            );

            const notificationData = {
                ...notification[0],
                read: false,
                createdAt: new Date()
            };

            // Emitir la notificación en tiempo real
            if (io) {
                console.log(`Emitiendo notificación a user:${data.usuarioId}`, notificationData);
                io.to(`user:${data.usuarioId}`).emit('nueva_notificacion', notificationData);
            } else {
                console.warn('Socket.io no inicializado, la notificación no se enviará en tiempo real');
            }

            return notificationData;
        } catch (error) {
            console.error('Error al crear notificación:', error);
            throw error;
        }
    }

    static getTitleByType(tipo) {
        switch (tipo) {
            case 'prestamo':
                return 'Nuevo Préstamo';
            case 'devolucion':
                return 'Devolución de Libro';
            case 'extension':
                return 'Extensión de Préstamo';
            case 'recordatorio':
                return 'Recordatorio de Devolución';
            default:
                return 'Nueva Notificación';
        }
    }

    static async getUserNotifications(userId) {
        try {
            const [notifications] = await db.query(
                'SELECT n.*, CASE WHEN n.estado = "leida" THEN true ELSE false END as `read` FROM notificaciones n WHERE n.usuarioId = ? ORDER BY n.createdAt DESC',
                [userId]
            );

            return notifications;
        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            throw error;
        }
    }

    static async markAsRead(notificationId, userId) {
        try {
            await db.query(
                'UPDATE notificaciones SET estado = "leida" WHERE id = ? AND usuarioId = ?',
                [notificationId, userId]
            );

            if (io) {
                io.to(`user:${userId}`).emit('notification_update', {
                    id: notificationId,
                    read: true
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Error al marcar notificación como leída:', error);
            throw error;
        }
    }

    static async markAllAsRead(userId) {
        try {
            await db.query(
                'UPDATE notificaciones SET estado = "leida" WHERE usuarioId = ?',
                [userId]
            );

            if (io) {
                io.to(`user:${userId}`).emit('notifications_cleared');
            }

            return { success: true };
        } catch (error) {
            console.error('Error al marcar todas las notificaciones como leídas:', error);
            throw error;
        }
    }
}

module.exports = NotificationService;