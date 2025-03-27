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
const { protegerRuta } = require('../middlewares/auth');
const { esAdmin } = require('../middlewares/roles');


router.get('/', getLibros);
router.get('/buscar', buscarLibros);


router.post('/',protegerRuta, esAdmin, uploadBookCover.single('portada'), crearLibro, );


router.get('/:id', getLibroById);

router.put('/:id', protegerRuta, esAdmin, uploadBookCover.single('portada'), updateLibro);


router.delete('/:id', eliminarLibro);
router.put('/:id/portada', uploadBookCover.single('portada'), actualizarPortada);
module.exports = router;