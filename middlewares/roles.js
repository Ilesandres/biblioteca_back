const esAdmin = (req, res, next) => {
    if (req.user && req.user.rol === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Acceso denegado - Se requieren permisos de administrador'
        });
    }
};

const esAgente = (req, res, next) => {
    if (req.user && (req.user.rol === 'admin' || req.user.isAgente)) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Acceso denegado - Se requieren permisos de agente'
        });
    }
};

module.exports = { esAdmin, esAgente };