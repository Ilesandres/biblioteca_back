const pool = require('../config/db');

class DataService {
    // Get available templates
    async getTemplates() {
        return templateService.getAllTemplates();
    }

    // Get specific template
    async getTemplate(entity) {
        return templateService.getTemplate(entity);
    }

    // Generate template file
    async generateTemplateFile(entity) {
        return templateService.generateTemplateFile(entity);
    }
    // Helper function to get all related data for books
    async getBookRelatedData(bookIds) {
        const [categories] = await pool.query(
            'SELECT DISTINCT c.* FROM categoria c INNER JOIN librocategoria lc ON c.id = lc.categoriaId WHERE lc.libroId IN (?)',
            [bookIds]
        );
        
        const [reviews] = await pool.query(
            'SELECT * FROM resena WHERE libroId IN (?)',
            [bookIds]
        );
        
        return { categories, reviews };
    }

    // Export data based on selected entities
    async exportData(entities) {
        const exportData = {};

        // If 'all' is selected, export everything
        if (entities.includes('all')) {
            entities = ['books', 'users', 'loans', 'reviews'];
        }

        if (entities.includes('books')) {
            const [books] = await pool.query('SELECT * FROM libro');
            exportData.books = books;

            // Always include categories and relationships when exporting books
            const bookIds = books.map(book => book.id);
            const [categories] = await pool.query(
                'SELECT DISTINCT c.* FROM categoria c INNER JOIN librocategoria lc ON c.id = lc.categoriaId WHERE lc.libroId IN (?)',
                [bookIds]
            );
            exportData.categories = categories;

            // Include book-category relationships
            const [bookCategories] = await pool.query(
                'SELECT * FROM librocategoria WHERE libroId IN (?)',
                [bookIds]
            );
            exportData.bookCategories = bookCategories;
        }

        if (entities.includes('users')) {
            const [users] = await pool.query('SELECT id, nombre, email,PASSWORD, rol, createdAt FROM usuario');
            exportData.users = users;
        }

        if (entities.includes('loans')) {
            const [loans] = await pool.query(
                'SELECT p.*, u.nombre as nombreUsuario, l.titulo as tituloLibro FROM prestamo p ' +
                'JOIN usuario u ON p.usuarioId = u.id ' +
                'JOIN libro l ON p.libroId = l.id'
            );
            exportData.loans = loans;
        }

        if (entities.includes('reviews')) {
            const [reviews] = await pool.query(
                'SELECT r.*, u.nombre as nombreUsuario, l.titulo as tituloLibro FROM resena r ' +
                'JOIN usuario u ON r.usuarioId = u.id ' +
                'JOIN libro l ON r.libroId = l.id'
            );
            exportData.reviews = reviews;
        }
        if (entities.includes('categories')) {
            const [categories] = await pool.query('SELECT * FROM categoria');
            exportData.categories = categories;
        }
        if(entities.includes('bookCategories')){
            const [bookCategories] = await pool.query('SELECT * FROM librocategoria');
            exportData.bookCategories = bookCategories;
        }

        return exportData;
    }

    // Import data with transaction support
    async importData(data, entities) {
        const connection = await pool.getConnection();
        console.log("entities: ", entities);
        
        try {
            await connection.beginTransaction();
            console.log('data : ',data)

            if (entities.includes('categories') && (data?.categories || data?.categorías)) {
                const categoriesData = data?.categories || data?.categorías;
                for (const category of categoriesData) {
                    try {
                        const categoryId = category?.id || category?.Id;
                        const categoryName = category?.nombre || category?.Nombre;
                        
                        if (!categoryId || !categoryName) {
                            console.error('Faltan datos de categoría. ID o nombre no definidos.');
                            continue;  // O puedes decidir qué hacer si falta alguno de estos valores
                        }
                
                        await connection.query(
                            'INSERT IGNORE INTO categoria (id, nombre) VALUES (?, ?)',
                            [categoryId, `${categoryName}`]
                        );
                    } catch (error) {
                        console.error('Error al importar categoría:', error);
                        throw new Error(`Error al importar la categoría ${category?.nombre || category?.Nombre}: ${error.message}`);
                    }
                }
                
            }

            if (entities.includes('bookCategories')) {
                // Verificar si los datos vienen en el formato esperado
                const bookCategoriesData = data['categoria y libro'] || data.bookCategories;
                
                if (Array.isArray(bookCategoriesData)) {
                    // Import book-category relationships
                    for (const relation of bookCategoriesData) {
                        await connection.query(
                            'INSERT IGNORE INTO librocategoria (libroId, categoriaId) VALUES (?, ?)',
                            [relation.LibroId, relation.CategoriaId]
                        );
                    }
                } else {
                    console.error('bookCategories data is not in the expected format:', bookCategoriesData);
                    throw new Error('Formato de datos inválido para bookCategories');
                }
            }

            if (entities.includes('books') && data.libros) {
                // Import books
                for (const book of data.libros) {
                    await connection.query(
                        'INSERT IGNORE INTO libro (id, titulo, autor, editorial, anioPublicacion, portada, descripcion, stock,isbn) VALUES (?, ?, ?, ?,?, ?, ?, ?,?)',
                        [book['Id'], book['Titulo'], book['Autor'], book['Editorial'],book['AnioPublicacion'], book['Portada'], book['Descripcion'], book['Stock'],book['Isbn']]
                    );
                }
            }

            if (entities.includes('users') && data.users) {
                for (const user of data.users) {
                    await connection.query(
                        'INSERT IGNORE INTO usuario (id, nombre, email, rol, PASSWORD, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                        [user.Id, user.Nombre, user.Email,user.PASSWORD, user.Rol, user.createdAt]
                    );
                }
            }

            if (entities.includes('loans') && data.loans) {
                for (const loan of data.loans) {
                    await connection.query(
                        'INSERT IGNORE INTO prestamo (id, usuarioId, libroId, fechaPrestamo, fechaDevolucionEsperada, fechaDevolucionReal, estado) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [loan.Id, loan.UsuarioId, loan.LibroId, loan.FechaPrestamo, loan.FechaDevolucion, loan.FechaDevolucionReal, loan.Estado]
                    );
                }
            }

            if (entities.includes('reviews') && data.reviews) {
                for (const review of data.reviews) {
                    await connection.query(
                        'INSERT IGNORE INTO resena (id, libroId, usuarioId, comentario, calificacion, createdAt) ' +
                        'VALUES (?, ?, ?, ?, ?, ?)',
                        [review.Id, review.LibroId, review.UsuarioId, review.Comentario, review.Calificacion, review.CreatedAt]
                    );
                }
            }

            await connection.commit();
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new DataService();