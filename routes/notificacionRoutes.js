const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middlewares/auth');
const NotificationService = require('../services/notificationService');

/**
 * @swagger
 * /notificaciones:
 *   get:
 *     summary: Obtener todas las notificaciones del usuario
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificaciones del usuario
 */
router.get('/', protegerRuta, async (req, res) => {
    try {
        const notificaciones = await NotificationService.getUserNotifications(req.user.id);

        res.json({
            success: true,
            data: notificaciones
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener las notificaciones',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /notificaciones/{id}/leer:
 *   put:
 *     summary: Marcar una notificación como leída
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 */
router.put('/:id/leer', protegerRuta, async (req, res) => {
    try {
        const notificacion = await NotificationService.markAsRead(req.params.id, req.user.id);

        res.json({
            success: true,
            message: 'Notificación marcada como leída'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al marcar la notificación como leída',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /notificaciones/leer-todas:
 *   put:
 *     summary: Marcar todas las notificaciones como leídas
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas las notificaciones marcadas como leídas
 */
router.put('/leer-todas', protegerRuta, async (req, res) => {
    try {
        await NotificationService.markAllAsRead(req.user.id);

        res.json({
            success: true,
            message: 'Todas las notificaciones marcadas como leídas'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al marcar todas las notificaciones como leídas',
            error: error.message
        });
    }
});

module.exports = router;