const multer = require('multer');

// Configuración de almacenamiento temporal para fotos de perfil
const storage = multer.memoryStorage();

// Filtro de archivos para fotos de perfil
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('No es una imagen! Por favor sube solo imágenes.'), false);
    }
};

// Configuración de multer para fotos de perfil
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB max para fotos de perfil
        files: 1,
        fieldSize: 2 * 1024 * 1024
    }
}).single('profilePhoto'); // nombre del campo para la foto de perfil

// Middleware wrapper para mejor manejo de errores
const profileUploadMiddleware = (req, res, next) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: 'Error al subir la foto de perfil',
                error: err.message
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        next();
    });
};

module.exports = profileUploadMiddleware;