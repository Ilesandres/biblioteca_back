const pool = require('../config/db');

// Get all categories
const getCategorias = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM categoria ORDER BY nombre');
        res.json(result[0]);
    } catch (error) {
        next(error);
    }
};

// Get category by ID
const getCategoriaById = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM categoria WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Create new category
const createCategoria = async (req, res, next) => {
    const { nombre, descripcion } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO categoria (nombre, descripcion) VALUES ($1, $2) RETURNING *',
            [nombre, descripcion]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Update category
const updateCategoria = async (req, res, next) => {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;
    try {
        const result = await pool.query(
            'UPDATE categoria SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
            [nombre, descripcion, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
};

// Delete category
const deleteCategoria = async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM categoria WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        res.json({ message: 'Categoría eliminada exitosamente' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategorias,
    getCategoriaById,
    createCategoria,
    updateCategoria,
    deleteCategoria
};