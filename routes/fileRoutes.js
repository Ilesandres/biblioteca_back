const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { protegerRuta } = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Aplicar middleware de autenticación a todas las rutas


// Ruta para subir archivo
router.post('/upload', fileController.upload, fileController.uploadFile.bind(fileController));

// Ruta para descargar archivo
router.get('/download/:fileId', fileController.downloadFile.bind(fileController));

// Ruta para eliminar archivo
router.delete('/:fileId', fileController.deleteFile.bind(fileController));

// Ruta para listar archivos
router.get('/list', fileController.listFiles.bind(fileController));

router.get('/', fileController.listAllFiles.bind(fileController));

router.get('/view/:fileId', fileController.viewFile.bind(fileController));

module.exports = router;