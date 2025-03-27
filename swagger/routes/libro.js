/**
 * @swagger
 * components:
 *   schemas:
 *     Libro:
 *       type: object
 *       required:
 *         - titulo
 *         - autor
 *         - stock
 *         - isbn
 *         - anioPublicacion
 *         - descripcion
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ID of the book
 *         titulo:
 *           type: string
 *           description: Title of the book
 *         autor:
 *           type: string
 *           description: Author of the book
 *         editorial:
 *           type: string
 *           description: Publisher of the book
 *         portada:
 *           type: string
 *           format: uri
 *           description: URL of the book cover image
 *         stock:
 *           type: integer
 *           description: Number of copies available
 *         isbn:
 *           type: string
 *           maxLength: 13
 *           description: ISBN of the book
 *         anioPublicacion:
 *           type: string
 *           format: date
 *           description: Publication date
 *         descripcion:
 *           type: string
 *           description: Book description
 *         categorias:
 *           type: array
 *           items:
 *             type: integer
 *             enum: [1, 2, 3, 4, 5, 6, 7, 8]
 *           description: Array of category IDs (1:Ficción, 2:No Ficción, 3:Ciencia, 4:Historia, 5:Literatura, 6:Tecnología, 7:Arte, 8:Filosofía)
 * 
 * /libros:
 *   get:
 *     tags: [Libros]
 *     summary: Get all books
 *     description: Retrieve a list of all books with their categories
 *     responses:
 *       200:
 *         description: A list of books
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Libro'
 *       500:
 *         description: Server error
 * 
 *   post:
 *     tags: [Libros]
 *     summary: Create a new book
 *     description: Add a new book to the library
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - autor
 *               - stock
 *               - isbn
 *               - anioPublicacion
 *               - descripcion
 *             properties:
 *               titulo:
 *                 type: string
 *               autor:
 *                 type: string
 *               editorial:
 *                 type: string
 *               stock:
 *                 type: integer
 *               isbn:
 *                 type: string
 *                 maxLength: 13
 *               anioPublicacion:
 *                 type: string
 *                 format: date
 *               descripcion:
 *                 type: string
 *               categorias:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   enum: [1, 2, 3, 4, 5, 6, 7, 8]
 *               portada:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Book created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Libro'
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 * 
 * /libros/buscar:
 *   get:
 *     tags: [Libros]
 *     summary: Search books
 *     description: Search books by title or author
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         required: true
 *         description: Search term for title or author
 *     responses:
 *       200:
 *         description: List of matching books
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Libro'
 *       500:
 *         description: Server error
 * 
 * /libros/{id}:
 *   get:
 *     tags: [Libros]
 *     summary: Get a book by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Libro'
 *       404:
 *         description: Book not found
 *       500:
 *         description: Server error
 * 
 *   put:
 *     tags: [Libros]
 *     summary: Update a book
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Book ID
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
 *               editorial:
 *                 type: string
 *               stock:
 *                 type: integer
 *               categorias:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   enum: [1, 2, 3, 4, 5, 6, 7, 8]
 *               portada:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Book updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Book not found
 *       500:
 *         description: Server error
 * 
 *   delete:
 *     tags: [Libros]
 *     summary: Delete a book
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Book deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Book not found
 *       500:
 *         description: Server error
 * 
 * /libros/{id}/portada:
 *   put:
 *     tags: [Libros]
 *     summary: Update book cover
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Book ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - portada
 *             properties:
 *               portada:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Book cover updated successfully
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
 *                   type: object
 *                   properties:
 *                     portada:
 *                       type: string
 *                       format: uri
 *       400:
 *         description: No image provided
 *       404:
 *         description: Book not found
 *       500:
 *         description: Server error
 */