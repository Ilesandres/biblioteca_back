const express = require('express');
const router = express.Router();
const { uploadBookCover } = require('../config/cloudinary');
const {
    getLibros,
    getLibroById,
    crearLibro,
    updateLibro,
    eliminarLibro,
    buscarLibros,
    actualizarPortada
} = require('../controllers/libroController');


router.get('/', getLibros);
router.get('/buscar', buscarLibros);


router.post('/', uploadBookCover.single('portada'), crearLibro);


router.get('/:id', getLibroById);

router.put('/:id', uploadBookCover.single('portada'), updateLibro);


router.delete('/:id', eliminarLibro);
router.put('/:id/portada', uploadBookCover.single('portada'), actualizarPortada);
module.exports = router;