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
            const [users] = await pool.query('SELECT id, nombre, email, rol, createdAt FROM usuario');
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

        return exportData;
    }

    // Import data with transaction support
    async importData(data, entities) {
        const connection = await pool.getConnection();
        console.log("entities: ", entities);
        console.log("data: ", data);
        data.categories = data.categorías;
        console.log('entities data : ', data.libros)
        console.log('importando');
        try {
            await connection.beginTransaction();

            if (entities.includes('categories') && data.categories) {
                for (const category of data.categories) {
                    await connection.query(
                        'INSERT IGNORE INTO  categoria (id, nombre) VALUES (?, ?)',
                        [ category.id, category.Nombre]
                    );
                }
            }

            if (entities.includes('bookCategories') && data.bookCategories) {
                // Import book-category relationships
                for (const relation of data.bookCategories) {
                    await connection.query(
                        'INSERT IGNORE INTO librocategoria (libroId, categoriaId) VALUES (?, ?)',
                        [relation.libroId, relation.categoriaId]
                    );
                }
            }

            if (entities.includes('books') && data.libros) {
                // Import books
                for (const book of data.libros) {
                    const query=await connection.query(
                        'INSERT IGNORE INTO libro (id, titulo, autor, editorial, anioPublicacion, portada, descripcion, stock) VALUES (?, ?, ?, ?,?, ?, ?, ?)',
                        [book['id'], book['Título'], book['Autor'], book['Editorial'],book['Año de Publicación'], book['imagen'], book['Descripción'], book['Stock']]
                    );
                    if(book['Categorías']){
                        const insertId=query[0].insertId;
                        console.log('insertId: ', insertId)
                            await connection.query(
                                'INSERT IGNORE INTO librocategoria (libroId, categoriaId) VALUES (?,?)',
                                [insertId,book['Categorías']]
                            );
                    }
                }

                // Import reviews if selected
                if (data.reviews) {
                    for (const review of data.reviews) {
                        await connection.query(
                            'INSERT IGNORE INTO resena (id, libroId, usuarioId, comentario, calificacion, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                            [review.id, review.libroId, review.usuarioId, review.comentario, review.calificacion, review.createdAt]
                        );
                    }
                }
            }

            if (entities.includes('users') && data.users) {
                for (const user of data.users) {
                    await connection.query(
                        'INSERT IGNORE INTO usuario (id, nombre, email, rol, createdAt) VALUES (?, ?, ?, ?, ?)',
                        [user.id, user.nombre, user.email, user.rol, user.createdAt]
                    );
                }
            }

            if (entities.includes('loans') && data.loans) {
                for (const loan of data.loans) {
                    await connection.query(
                        'INSERT IGNORE INTO prestamo (id, usuarioId, libroId, fechaPrestamo, fechaDevolucionEsperada, fechaDevolucionReal, estado) ' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [loan.id, loan.usuarioId, loan.libroId, loan.fechaPrestamo, loan.fechaDevolucionEsperada, loan.fechaDevolucionReal, loan.estado]
                    );
                }
            }

            if (entities.includes('reviews') && data.reviews) {
                for (const review of data.reviews) {
                    await connection.query(
                        'INSERT IGNORE INTO resena (id, libroId, usuarioId, comentario, calificacion, createdAt) ' +
                        'VALUES (?, ?, ?, ?, ?, ?)',
                        [review.id, review.libroId, review.usuarioId, review.comentario, review.calificacion, review.createdAt]
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