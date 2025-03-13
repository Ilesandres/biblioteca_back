const { validationResult, check } = require('express-validator');

// Middleware mejorado para manejar errores de validación
const validarResultados = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                campo: err.path,
                mensaje: err.msg
            }))
        });
    }
    next();
};

// Validaciones para libros
const validarLibro = [
    check('titulo').trim().notEmpty().withMessage('El título es obligatorio')
        .isLength({ min: 2 }).withMessage('El título debe tener al menos 2 caracteres'),
    check('autor').trim().notEmpty().withMessage('El autor es obligatorio'),
    check('descripcion').trim().notEmpty().withMessage('La descripción es obligatoria'),
    check('genero').trim().notEmpty().withMessage('El género es obligatorio'),
    check('fechaPublicacion').isDate().withMessage('Fecha de publicación inválida'),
    validarResultados
];

// Validaciones para usuarios
const validarRegistro = [
    check('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
    check('email').isEmail().withMessage('Email inválido'),
    check('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    validarResultados
];

// Validaciones mejoradas para mensajes de chat
const validarMensaje = [
    check('contenido')
        .trim()
        .notEmpty().withMessage('El mensaje no puede estar vacío')
        .isLength({ min: 1, max: 1000 }).withMessage('El mensaje debe tener entre 1 y 1000 caracteres'),
    validarResultados
];

// Validaciones para búsqueda en chat
const validarBusqueda = [
    check('termino')
        .trim()
        .isLength({ min: 2 }).withMessage('El término de búsqueda debe tener al menos 2 caracteres'),
    check('fechaInicio')
        .optional()
        .isISO8601().withMessage('Formato de fecha inválido'),
    check('fechaFin')
        .optional()
        .isISO8601().withMessage('Formato de fecha inválido'),
    validarResultados
];

module.exports = {
    validarLibro,
    validarRegistro,
    validarMensaje,
    validarBusqueda
}; 