const multer = require('multer');
const path = require('path');

// Configuración de almacenamiento temporal
const storage = multer.memoryStorage();

// Filtro de archivos
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('No es una imagen! Por favor sube solo imágenes.'), false);
    }
};

// Configuración de multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1, // máximo 1 archivo
        fieldSize: 10 * 1024 * 1024 // 10MB max field size
    }
}).single('portada'); // nombre del campo del archivo

// Middleware wrapper para mejor manejo de errores
const uploadMiddleware = (req, res, next) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            // Error de Multer
            return res.status(400).json({
                success: false,
                message: 'Error al subir el archivo',
                error: err.message
            });
        } else if (err) {
            // Otro tipo de error
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        // Todo bien
        next();
    });
};

module.exports = uploadMiddleware;