const express = require('express');
const bcrypt = require('bcrypt');
const { protegerRuta } = require('../middlewares/auth');
const { googleLogin, googleRegister } = require('../controllers/googleAuthController');
const { validarRegistro } = require('../middlewares/validator');
const profileUploadMiddleware = require('../middlewares/profileUpload');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const {
    registrarUsuario,
    loginUsuario,
    obtenerPerfil,
    actualizarPerfil,
    obtenerHistorialPrestamos,
    getStats,
    logoutUsuario,
    actualizarFotoPerfil,
    getProfilePhoto,
    actualizarFotoPerfilPorId
} = require('../controllers/usuarioController');

const router = express.Router();

// Rutas de autenticación con Google
router.post('/google/login', googleLogin);
router.post('/google/register', googleRegister);


/**
 * @swagger
 * /usuarios/stats:
 *   get:
 *     summary: Obtiene las estadísticas del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prestamos:
 *                   type: integer
 *                   example: 5
 *                 librosActivos:
 *                   type: integer
 *                   example: 2
 *       401:
 *         description: No autorizado
 */
router.get('/stats', protegerRuta, getStats);

/**
 * @swagger
 * /usuarios/profile-photo:
 *   post:
 *     summary: Actualiza la foto de perfil del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto de perfil actualizada exitosamente
 *       400:
 *         description: Error en la solicitud
 *       401:
 *         description: No autorizado
 */
router.post('/profile-photo', protegerRuta, profileUploadMiddleware, actualizarFotoPerfil);

/**
 * @swagger
 * /usuarios/register:
 *   post:
 *     summary: Registra un nuevo usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "johndoe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 username:
 *                   type: string
 *                   example: "johndoe"
 *                 email:
 *                   type: string
 *                   example: "john@example.com"
 *       400:
 *         description: Error en los datos de registro
 */

/**
 * @swagger
 * /usuarios/login:
 *   post:
 *     summary: Inicia sesión de usuario
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: "johndoe"
 *                     email:
 *                       type: string
 *                       example: "john@example.com"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Credenciales inválidas
 *       404:
 *         description: Usuario no encontrado
 */

/**
 * @swagger
 * /usuarios/perfil:
 *   get:
 *     summary: Obtiene el perfil del usuario autenticado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 nombre:
 *                   type: string
 *                   example: "johndoe"
 *                 email:
 *                   type: string
 *                   example: "john@example.com"
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /usuarios/prestamos:
 *   get:
 *     summary: Obtiene el historial de préstamos del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial de préstamos obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   libroId:
 *                     type: integer
 *                     example: 1
 *                   fechaPrestamo:
 *                     type: string
 *                     format: date-time
 *                   fechaDevolucion:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /usuarios/perfil:
 *   put:
 *     summary: Actualiza el perfil del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "johndoe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john1@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "¡Perfil actualizado exitosamente!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     nombre:
 *                       type: string
 *                       example: "johndoe"
 *                     email:
 *                       type: string
 *                       example: "john1@example.com"
 *       400:
 *         description: Error al actualizar perfil
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */

router.post('/register', validarRegistro, registrarUsuario);

router.post('/login', loginUsuario);

router.get('/perfil', protegerRuta, obtenerPerfil);
router.put('/perfil', protegerRuta, actualizarPerfil);
router.get('/prestamos', protegerRuta, obtenerHistorialPrestamos);

// Ruta para obtener foto de perfil por ID
router.get('/foto/:id', getProfilePhoto);

// Ruta para actualizar foto de perfil por ID (solo administradores)
router.post('/foto/:id', profileUploadMiddleware, actualizarFotoPerfilPorId);

// Legacy route for backward compatibility
router.post('/registro', validarRegistro, registrarUsuario);

/**
 * @swagger
 * /usuarios/logout:
 *   post:
 *     summary: Cierra la sesión del usuario
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 *       500:
 *         description: Error al cerrar sesión
 */
router.post('/logout', protegerRuta, logoutUsuario);

// Rutas de autenticación con Google
router.post('/google-login', googleLogin);
router.post('/google-register', googleRegister);

module.exports = router;