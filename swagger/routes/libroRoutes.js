/**
 * @swagger
 * components:
 *   schemas:
 *     Libro:
 *       type: object
 *       required:
 *         - titulo
 *         - autor
 *         - isbn
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the book
 *         titulo:
 *           type: string
 *           description: The title of the book
 *         autor:
 *           type: string
 *           description: The author of the book
 *         isbn:
 *           type: string
 *           description: The ISBN of the book
 *         descripcion:
 *           type: string
 *           description: The description of the book
 *         genero:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of category IDs (sent as 'genero' from frontend)
 *         anioPublicacion:
 *           type: string
 *           description: The publication year of the book
 *         copias:
 *           type: integer
 *           description: Number of copies available
 *         portada:
 *           type: string
 *           format: binary
 *           description: The book cover image file
 * 
 * /api/libros/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Libros]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The book ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               autor:
 *                 type: string
 *               isbn:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               genero:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of category IDs (will be mapped to 'categorias' in backend)
 *               anioPublicacion:
 *                 type: string
 *               copias:
 *                 type: integer
 *               portada:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: The book was successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Libro'
 *       404:
 *         description: The book was not found
 *       500:
 *         description: Some server error
 */