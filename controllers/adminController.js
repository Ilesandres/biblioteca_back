const pool = require('../config/db');
const ExcelJS = require('exceljs');

// Obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await pool.query(
            'SELECT id, nombre, email, createdAt, rol, online AS estado FROM usuario ORDER BY createdAt DESC'
        );
        res.json(usuarios);
    } catch (err) {
        console.error('Error al obtener usuarios:', err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener estadísticas generales
const obtenerEstadisticas = async (req, res) => {
    try {
        // Total de usuarios
        const [usuarios] = await pool.query('SELECT COUNT(*) as total FROM usuario WHERE online=1');
        
        // Total de libros
        const [libros] = await pool.query('SELECT COUNT(*) as total FROM libro');
        
        // Total de préstamos activos
        const [prestamosActivos] = await pool.query(
            'SELECT COUNT(*) as total FROM prestamo WHERE fechaDevolucionReal IS NULL AND estado="prestado"'
        );
        
        // Total de préstamos realizados
        const [prestamosTotal] = await pool.query('SELECT COUNT(*) as total FROM prestamo');

        // Total de reseñas
        const [totalResenas] = await pool.query('SELECT COUNT(*) as total FROM resena');

        // Préstamos recientes
        const [prestamosRecientes] = await pool.query(
            `SELECT p.*, u.nombre as nombreUsuario, l.titulo as tituloLibro 
             FROM prestamo p 
             JOIN usuario u ON p.usuarioId = u.id 
             JOIN libro l ON p.libroId = l.id 
             ORDER BY p.fechaPrestamo DESC LIMIT 5`
        );

        // Últimas reseñas
        const [ultimasResenas] = await pool.query(
            `SELECT r.*, u.nombre as nombreUsuario, l.titulo as tituloLibro 
             FROM resena r 
             JOIN usuario u ON r.usuarioId = u.id 
             JOIN libro l ON r.libroId = l.id 
             ORDER BY r.createdAt DESC LIMIT 5`
        );

        res.json({
            usuarios: usuarios[0].total,
            libros: libros[0].total,
            prestamosActivos: prestamosActivos[0].total,
            prestamosTotal: prestamosTotal[0].total,
            totalResenas: totalResenas[0].total,
            prestamosRecientes: prestamosRecientes,
            ultimasResenas: ultimasResenas
        });
    } catch (err) {
        console.error('Error al obtener estadísticas:', err);
        res.status(500).json({ error: err.message });
    }
};

// Actualizar usuario
const updateUser = async (req, res) => {
    console.log('data : ', req.body);
    console.log('params : ', req.params)
    try {
        const { id } = req.params;
        const { nombre, email, rol} = req.body;
        // Verificar si el correo electrónico ya está registrado por otro usuario
        const [existingUser] = await pool.query(
            'SELECT * FROM usuario WHERE email =? AND id !=?',
            [email, id]
        );
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
        }

        const [result] = await pool.query(
            'UPDATE usuario SET nombre = ?, email = ?, rol = ? WHERE id = ?',
            [nombre, email, rol, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (err) {
        console.error('Error al actualizar usuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// Bloquear/Desbloquear usuario
const toggleBloqueoUsuario = async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const { bloqueado } = req.body;

        await pool.query(
            'UPDATE usuario SET online = ? WHERE id = ?',
            [bloqueado, usuario_id]
        );

        res.json({
            message: `Usuario ${bloqueado ? 'bloqueado' : 'desbloqueado'} exitosamente`
        });
    } catch (err) {
        console.error('Error al modificar estado de usuario:', err);
        res.status(500).json({ error: err.message });
    }
};

// Eliminar usuario
const eliminarUsuario = async (req, res) => {
    try {
        const { usuario_id } = req.params;

        // Verificar si el usuario tiene préstamos activos
        const [prestamosActivos] = await pool.query(
            'SELECT COUNT(*) as total FROM prestamo WHERE usuario_id = ? AND fecha_devolucion IS NULL',
            [usuario_id]
        );

        if (prestamosActivos[0].total > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar el usuario porque tiene préstamos activos'
            });
        }

        // Eliminar usuario
        await pool.query('DELETE FROM usuario WHERE id = ?', [usuario_id]);

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ error: err.message });
    }
};

const dataService = require('../services/dataService');

// Exportar datos seleccionados
const exportData = async (req, res) => {
    try {
        const { entities, format } = req.body;
        if (!entities || !Array.isArray(entities)) {
            return res.status(400).json({ error: 'Debe especificar las entidades a exportar' });
        }

        const exportedData = await dataService.exportData(entities);

        // Handle different export formats
        switch (format) {
            case 'excel':
                const ExcelJS = require('exceljs');
                const workbook = new ExcelJS.Workbook();

                // Create worksheets for each entity
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data)) return;
                    const worksheet = workbook.addWorksheet(key);
                    if (data.length > 0) {
                        worksheet.columns = Object.keys(data[0]).map(header => ({
                            header,
                            key: header,
                            width: 20
                        }));
                        worksheet.addRows(data);
                    }
                });

                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=biblioteca_export.xlsx');
                await workbook.xlsx.write(res);
                res.end();
                break;

            case 'pdf':
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({
                    size: 'A4',
                    layout: 'landscape',
                    info: {
                        Title: 'Biblioteca Export',
                        Author: 'Sistema Biblioteca',
                        Subject: 'Exportación de datos'
                    },
                    autoFirstPage: true,
                    lang: 'es-ES'
                });

                // Configurar fuente con soporte completo para caracteres latinos
                doc.font('fonts/Iansui-Regular.ttf');
                doc.fontSize(12);
                
                // Asegurar que el texto se codifique correctamente
                const textEncoder = new TextEncoder('utf-8');
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=biblioteca_export.pdf');

                // Manejar errores del stream
                doc.on('error', (err) => {
                    console.error('Error al generar PDF:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error al generar el PDF' });
                    }
                });

                // Pipe al response con manejo de errores
                doc.pipe(res).on('error', (err) => {
                    console.error('Error en el stream de respuesta:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Error al enviar el PDF' });
                    }
                });

                // Función para sanitizar y codificar texto
                const sanitizeText = (text) => {
                    if (text === null || text === undefined) return '';
                    return String(text)
                        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Eliminar caracteres de control
                        .normalize('NFC') // Normalizar caracteres especiales manteniendo acentos
                        .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '') // Mantener letras, números, puntuación y espacios
                        .trim();
                };

                // Función para crear tabla
                const createTable = (doc, headers, data, startX, startY, options) => {
                    const cellPadding = 5;
                    const cellWidth = (doc.page.width - 2 * startX - cellPadding * 2) / headers.length;
                    const minLineHeight = 20;

                    // Dibujar encabezados
                    doc.fontSize(10);
                    let headerHeight = minLineHeight;
                    headers.forEach((header, i) => {
                        const textHeight = doc.heightOfString(sanitizeText(header), {
                            width: cellWidth - 2 * cellPadding
                        });
                        headerHeight = Math.max(headerHeight, textHeight + 2 * cellPadding);
                    });

                    headers.forEach((header, i) => {
                        doc.fillColor('black')
                           .rect(startX + i * cellWidth, startY, cellWidth, headerHeight)
                           .fill();
                        doc.fillColor('white')
                           .text(sanitizeText(header),
                                startX + i * cellWidth + cellPadding,
                                startY + cellPadding,
                                { width: cellWidth - 2 * cellPadding,
                                  align: 'left',
                                  lineGap: 2 });
                    });

                    // Dibujar datos
                    let currentY = startY + headerHeight;
                    data.forEach((row, rowIndex) => {
                        if (currentY > doc.page.height - 100) {
                            doc.addPage();
                            currentY = 50;
                        }

                        // Calcular altura máxima necesaria para esta fila
                        let rowHeight = minLineHeight;
                        headers.forEach((header) => {
                            const text = sanitizeText(row[header]);
                            const textHeight = doc.heightOfString(text, {
                                width: cellWidth - 2 * cellPadding
                            });
                            rowHeight = Math.max(rowHeight, textHeight + 2 * cellPadding);
                        });

                        // Dibujar celdas con la altura calculada
                        headers.forEach((header, i) => {
                            const text = sanitizeText(row[header]);
                            doc.fillColor(rowIndex % 2 === 0 ? '#f5f5f5' : 'white')
                               .rect(startX + i * cellWidth, currentY, cellWidth, rowHeight)
                               .fill();
                            doc.fillColor('black')
                               .text(text,
                                    startX + i * cellWidth + cellPadding,
                                    currentY + cellPadding,
                                    { width: cellWidth - 2 * cellPadding,
                                      align: 'left',
                                      lineGap: 2 });
                        });
                        currentY += rowHeight;
                    });
                };

                // Agregar contenido al PDF
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;

                    // Título de la sección
                    doc.fontSize(16)
                       .fillColor('black')
                       .text(key.toUpperCase(), 50, 50, { 
                           underline: true,
                           characterSpacing: 0.5,
                           wordSpacing: 0.5
                       });
                    doc.moveDown();

                    if (data.length > 0) {
                        // Definir el orden deseado de las columnas
                        const priorityFields = ['id','titulo','autor','calificacion_promedio', 'createdAt', 'updatedAt'];
                        const headers = [
                            ...priorityFields.filter(field => Object.keys(data[0]).includes(field)),
                            ...Object.keys(data[0]).filter(key => !priorityFields.includes(key))
                        ];
                        // Asegurar que los datos se codifiquen correctamente
                        const processedData = data.map(row => {
                            const newRow = {};
                            Object.entries(row).forEach(([key, value]) => {
                                newRow[key] = value ? value.toString() : '';
                            });
                            return newRow;
                        });
                        
                        createTable(doc, headers, processedData, 50, doc.y, {
                            width: doc.page.width - 100,
                            padding: 5,
                            lineHeight: 1.2
                        });
                        
                        // Agregar tres saltos de línea después de cada tabla
                        doc.moveDown(3);
                    }

                    doc.addPage();
                });


                doc.end();
                break;

            case 'sql':
                res.setHeader('Content-Type', 'application/sql');
                res.setHeader('Content-Disposition', 'attachment; filename=biblioteca_export.sql');

                let sqlContent = '';

                // Generate SQL INSERT statements
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;

                    const tableName = key === 'bookCategories' ? 'librocategoria' :
                                    key === 'categories' ? 'categoria' :
                                    key === 'reviews' ? 'resena' :
                                    key === 'loans' ? 'prestamo' :
                                    key === 'users' ? 'usuario' :
                                    key === 'books' ? 'libro' : key;

                    data.forEach(item => {
                        const columns = Object.keys(item).join(', ');
                        const values = Object.values(item).map(val => 
                            typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` :
                            val === null ? 'NULL' : val
                        ).join(', ');

                        sqlContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
                    });
                    sqlContent += '\n';
                });

                res.send(sqlContent);
                break;

            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=biblioteca_export.csv');

                let csvContent = '';

                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;

                    csvContent += `\n--- ${key} ---\n`;
                    const headers = Object.keys(data[0]);
                    csvContent += headers.join(',') + '\n';

                    data.forEach(item => {
                        csvContent += headers.map(header => {
                            const val = item[header];
                            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` :
                                   val === null ? '' : val;
                        }).join(',') + '\n';
                    });
                });

                res.send(csvContent);
                break;

            default:
                res.json(exportedData);
        }
    } catch (err) {
        console.error('Error al exportar datos:', err);
        res.status(500).json({ error: err.message });
    }
};

// Importar datos seleccionados
const importData = async (req, res) => {
    try {
        // Validate file upload
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }

        const file = req.file;
        
        // Validate and parse entities
        let entities = [];
        try {
            const entitiesStr = req.body.entities;
            if (typeof entitiesStr === 'string') {
                entities = JSON.parse(entitiesStr);
            } else if (Array.isArray(entitiesStr)) {
                entities = entitiesStr;
            }
            
            if (!Array.isArray(entities)) {
                return res.status(400).json({ error: 'El formato de las entidades es inválido' });
            }
        } catch (parseError) {
            return res.status(400).json({ error: 'Error al procesar las entidades seleccionadas' });
        }

        let data;
        const fileType = file.originalname.split('.').pop().toLowerCase();

        if (fileType === 'xlsx' || fileType === 'xls') {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();

            try {
                // Load the buffer directly from multer's file buffer
                await workbook.xlsx.load(file.buffer);

                data = {};
                workbook.eachSheet((worksheet, sheetId) => {
                    if (!worksheet) {
                        throw new Error('Hoja de cálculo inválida o corrupta');
                    }

                    const rows = [];
                    const headers = [];

                    const headerRow = worksheet.getRow(1);
                    if (!headerRow.values || headerRow.values.length <= 1) {
                        throw new Error('El archivo no contiene encabezados válidos');
                    }

                    headerRow.eachCell((cell) => {
                        headers.push(cell.value);
                    });

                    worksheet.eachRow((row, rowNumber) => {
                        if (rowNumber > 1) { // Skip header row
                            const rowData = {};
                            row.eachCell((cell, colNumber) => {
                                rowData[headers[colNumber - 1]] = cell.value;
                            });
                            rows.push(rowData);
                        }
                    });

                    data[worksheet.name.toLowerCase()] = rows;
                });
            } catch (excelError) {
                console.error('Error processing Excel file:', excelError);
                return res.status(400).json({ 
                    error: 'Error al procesar el archivo Excel. Asegúrese de que el archivo no esté corrupto y tenga el formato correcto.' 
                });
            }
        } else if (fileType === 'json') {
            data = JSON.parse(file.buffer.toString());
        } else {
            return res.status(400).json({ error: 'Formato de archivo no soportado. Use XLSX o JSON.' });
        }

        const result = await dataService.importData(data, entities);
        res.json(result);
    } catch (err) {
        console.error('Error al importar datos:', err);
        res.status(500).json({ error: err.message });
    }
};

// Generar plantilla para importación
const generateTemplate = async (req, res) => {
    try {
        const { entity } = req.query;
        if (!entity) {
            return res.status(400).json({ error: 'Debe especificar el tipo de entidad' });
        }

        const workbook = new ExcelJS.Workbook();
        let worksheet;

        switch (entity.toLowerCase()) {
            case 'books':
            case 'libros':
                worksheet = workbook.addWorksheet('Libros');
                worksheet.columns = [
                    { header: 'Título', key: 'titulo', width: 30 },
                    { header: 'Autor', key: 'autor', width: 25 },
                    { header: 'ISBN', key: 'isbn', width: 15 },
                    { header: 'Editorial', key: 'editorial', width: 20 },
                    { header: 'Año de Publicación', key: 'anioPublicacion', width: 15 },
                    { header: 'Categorías', key: 'categorias', width: 20 },
                    { header: 'Descripción', key: 'descripcion', width: 40 },
                    { header: 'Stock', key: 'stock', width: 10 }
                ];
                break;

            case 'users':
            case 'usuarios':
                worksheet = workbook.addWorksheet('Usuarios');
                worksheet.columns = [
                    { header: 'Nombre', key: 'nombre', width: 30 },
                    { header: 'Email', key: 'email', width: 30 },
                    { header: 'Rol', key: 'rol', width: 15 },
                    { header: 'Teléfono', key: 'telefono', width: 15 }
                ];
                break;

            case 'loans':
            case 'prestamos':
                worksheet = workbook.addWorksheet('Préstamos');
                worksheet.columns = [
                    { header: 'ID Usuario', key: 'usuarioId', width: 15 },
                    { header: 'ID Libro', key: 'libroId', width: 15 },
                    { header: 'Fecha Préstamo', key: 'fechaPrestamo', width: 20 },
                    { header: 'Fecha Devolución Prevista', key: 'fechaDevolucionPrevista', width: 20 },
                    { header: 'Estado', key: 'estado', width: 15 }
                ];
                break;

            case 'reviews':
            case 'resenas':
                worksheet = workbook.addWorksheet('Reseñas');
                worksheet.columns = [
                    { header: 'ID Usuario', key: 'usuarioId', width: 15 },
                    { header: 'ID Libro', key: 'libroId', width: 15 },
                    { header: 'Calificación', key: 'calificacion', width: 15 },
                    { header: 'Comentario', key: 'comentario', width: 40 }
                ];
                break;

            case 'categories':
            case 'categorias':
                worksheet = workbook.addWorksheet('Categorías');
                worksheet.columns = [
                    { header: 'Nombre', key: 'nombre', width: 30 },
                    { header: 'Descripción', key: 'descripcion', width: 50 }
                ];
                break;

            case 'bookcategories':
            case 'librocategoria':
                worksheet = workbook.addWorksheet('Libro-Categoría');
                worksheet.columns = [
                    { header: 'ID Libro', key: 'libroId', width: 15 },
                    { header: 'ID Categoría', key: 'categoriaId', width: 15 }
                ];
                break;

            default:
                return res.status(400).json({ error: 'Tipo de entidad no válido' });
        }

        // Aplicar estilos a la cabecera
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Configurar el archivo para descarga
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=plantilla_${entity.toLowerCase()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error al generar la plantilla:', error);
        res.status(500).json({ error: 'Error al generar la plantilla' });
    }
};

module.exports = {
    obtenerUsuarios,
    obtenerEstadisticas,
    toggleBloqueoUsuario,
    eliminarUsuario,
    updateUser,
    exportData,
    importData,
    generateTemplate
};