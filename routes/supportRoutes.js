const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const auth = require('../middleware/auth');
const { esAdmin, esAgente } = require('../middlewares/roles');

// Rutas protegidas por autenticación
router.use(auth);

// Rutas para usuarios
router.post('/tickets', supportController.crearTicket);
router.get('/tickets/mis-tickets', supportController.obtenerMisTickets);
router.get('/tickets/:ticketId/mensajes', supportController.obtenerMensajesTicket);
router.post('/tickets/:ticketId/mensajes', supportController.enviarMensaje);

// Rutas para agentes y admins
router.get('/tickets', esAgente, supportController.obtenerTodosTickets);
router.put('/tickets/:ticketId/cerrar', esAgente, supportController.cerrarTicket);
router.put('/tickets/:ticketId/asignar', esAgente, supportController.asignarTicket);
router.put('/tickets/:ticketId/estado', esAgente, supportController.actualizarEstadoTicket);

// Rutas para gestión de agentes (solo admin)
router.get('/agentes', esAdmin, supportController.obtenerAgentes);
router.post('/agentes', esAdmin, supportController.crearAgente);
router.delete('/agentes/:id', esAdmin, supportController.eliminarAgente);
router.put('/agentes/:id/estado', esAdmin, supportController.actualizarEstadoAgente);

module.exports = router;