const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middlewares/auth');
const { esAdmin } = require('../middlewares/roles');
const {
    crearPrestamo,
    devolverLibro,
    obtenerPrestamosActivos,
    extenderPrestamo,
    obtenerHistorialPrestamos
} = require('../controllers/prestamoController');

/**
 * @swagger
 * /prestamos/usuario:
 *   get:
 *     summary: Obtener préstamos del usuario autenticado
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       libroId:
 *                         type: integer
 *                       usuarioId:
 *                         type: integer
 *                       fechaDevolucion:
 *                         type: string
 *                         format: date
 *                       estado:
 *                         type: string
 *                       devuelto:
 *                         type: boolean
 *                       libro:
 *                         type: object
 *                         properties:
 *                           titulo:
 *                             type: string
 *                           autor:
 *                             type: string
 *                           portada:
 *                             type: string
 *       500:
 *         description: Error del servidor
 */
router.get('/usuario', protegerRuta, obtenerHistorialPrestamos);

/**
 * @swagger
 * /prestamos:
 *   post:
 *     summary: Crear un nuevo préstamo
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - libroId
 *               - fechaDevolucion
 *             properties:
 *               libroId:
 *                 type: integer
 *                 description: ID del libro a prestar
 *               fechaDevolucion:
 *                 type: string
 *                 format: date
 *                 description: Fecha programada para la devolución
 *     responses:
 *       201:
 *         description: Préstamo creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     libroId:
 *                       type: integer
 *                     usuarioId:
 *                       type: integer
 *                     fechaDevolucion:
 *                       type: string
 *                       format: date
 *                     estado:
 *                       type: string
 *                     devuelto:
 *                       type: boolean
 *                     libro:
 *                       type: object
 *                       properties:
 *                         titulo:
 *                           type: string
 *                         autor:
 *                           type: string
 *                         portada:
 *                           type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.post('/', protegerRuta, crearPrestamo);

/**
 * @swagger
 * /prestamos/{id}/devolver:
 *   put:
 *     summary: Registrar devolución de un libro
 *     tags: [Préstamos]
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
 *         description: Libro devuelto exitosamente
 */
router.put('/:id/devolver', protegerRuta, devolverLibro);

/**
 * @swagger
 * /prestamos/{id}/extender:
 *   put:
 *     summary: Extender el período de préstamo de un libro
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del préstamo a extender
 *     responses:
 *       200:
 *         description: Período de préstamo extendido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     nuevaFechaDevolucion:
 *                       type: string
 *                       format: date
 *       400:
 *         description: Error en la solicitud
 *       404:
 *         description: Préstamo no encontrado
 */
// Extensión de préstamos no implementada aún
 router.put('/:id/extender', protegerRuta, extenderPrestamo);

module.exports = router;