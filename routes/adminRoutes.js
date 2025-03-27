const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protegerRuta } = require('../middlewares/auth');
const { esAdmin } = require('../middlewares/roles');
const { 
    obtenerUsuarios,
    obtenerEstadisticas,
    toggleBloqueoUsuario,
    eliminarUsuario,
    updateUser,
    exportData,
    importData,
    generateTemplate
} = require('../controllers/adminController');
const { getLibros } = require('../controllers/libroController');
const dataService = require('../services/dataService');

// Configuración de multer para manejar la subida de archivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limite
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
            'application/vnd.ms-excel' // XLS
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Tipo de archivo no permitido. Solo se permiten archivos Excel (.xls, .xlsx).'), false);
        }

        cb(null, true);
    }
});

// Aplicar middleware de autenticación a todas las rutas
router.use(protegerRuta);
router.use(esAdmin);

// Ruta para obtener estadísticas generales
router.get('/stats', obtenerEstadisticas);

// Ruta para obtener todos los usuarios
router.get('/usuarios', obtenerUsuarios);

// Ruta para obtener todos los libros
router.get('/libros', getLibros);

// Ruta para actualizar usuario
router.put('/usuarios/:id', updateUser);

// Ruta para bloquear/desbloquear usuario
router.put('/usuarios/:usuario_id/bloquear', toggleBloqueoUsuario);

// Ruta para eliminar usuario
router.delete('/usuarios/:usuario_id', eliminarUsuario);

// Rutas para importación/exportación de datos
router.post('/export', exportData);
router.post('/import', upload.single('file'), importData);

// Ruta para generar plantillas
router.get('/template', generateTemplate);

module.exports = router;