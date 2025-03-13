const express = require('express');
const router = express.Router();
const { 
    getCategorias,
    getCategoriaById,
    createCategoria,
    updateCategoria,
    deleteCategoria
} = require('../controllers/categoriaController');
const { esAdmin } = require('../middlewares/roles');
const { protegerRuta } = require('../middlewares/auth');

// Public routes
router.get('/', getCategorias);
router.get('/:id', getCategoriaById);

// Protected routes (admin only)
router.post('/', protegerRuta, esAdmin, createCategoria);
router.put('/:id', protegerRuta, esAdmin, updateCategoria);
router.delete('/:id', protegerRuta, esAdmin, deleteCategoria);

module.exports = router;