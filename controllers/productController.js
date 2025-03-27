const db = require('../config/db');
const moment = require('moment-timezone');

const productController = {
    updateProduct: async (req, res) => {
        try {
            const { idProduct, nombre, stock, precio, category } = req.body;
            const fecha_Act = moment().tz('America/Bogota').format('YYYY-MM-DD HH:mm:ss');

            // Update product information
            const updateProductQuery = `UPDATE product SET name = ?, stock = ?, price = ?, updatedAt = ? WHERE id = ?`;
            await db.query(updateProductQuery, [nombre, stock, precio, fecha_Act, idProduct]);

            // Delete existing category associations
            const deleteCategoriesQuery = `DELETE FROM productcategory WHERE productId = ?`;
            await db.query(deleteCategoriesQuery, [idProduct]);

            // Insert new category associations
            const insertCategoryQuery = `INSERT INTO productcategory (productId, categoryId) VALUES (?, ?)`;
            const insertPromises = category.map(categoriaId => 
                db.query(insertCategoryQuery, [idProduct, categoriaId])
            );

            await Promise.all(insertPromises);

            res.status(200).send('Producto editado con éxito');
        } catch (error) {
            console.error('Error en la operación del producto:', error);
            res.status(500).send('Error al procesar la operación del producto');
        }
    }
};

module.exports = productController;