const express = require('express');
const router = express.Router();
const { protegerRuta } = require('../middlewares/auth');
const {
    crearResena,
    obtenerResenasLibro,
    actualizarResena
} = require('../controllers/resenaController');

/**
 * @swagger
 * /resenas:
 *   post:
 *     summary: Crear una nueva reseña
 *     tags: [Reseñas]
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
 *               - calificacion
 *               - comentario
 *             properties:
 *               libroId:
 *                 type: integer
 *                 description: ID del libro a reseñar
 *               calificacion:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Calificación del libro (1-5)
 *               comentario:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 description: Comentario de la reseña
 *     responses:
 *       201:
 *         description: Reseña creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Resena'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 */
router.post('/', protegerRuta, crearResena);

/**
 * @swagger
 * /resenas/libro/{libroId}:
 *   get:
 *     summary: Obtener todas las reseñas de un libro
 *     tags: [Reseñas]
 *     parameters:
 *       - in: path
 *         name: libroId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Lista de reseñas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Resena'
 *       404:
 *         description: Libro no encontrado
 */
router.get('/libro/:libroId', obtenerResenasLibro);

/**
 * @swagger
 * /resenas/{id}:
 *   put:
 *     summary: Actualizar una reseña
 *     tags: [Reseñas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la reseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               calificacion:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Nueva calificación del libro
 *               comentario:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 description: Nuevo comentario
 *     responses:
 *       200:
 *         description: Reseña actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Resena'
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Reseña no encontrada
 */
router.put('/:id', protegerRuta, actualizarResena);

module.exports = router;