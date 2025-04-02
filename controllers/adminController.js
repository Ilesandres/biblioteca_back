const pool = require('../config/db');
const ExcelJS = require('exceljs');
const driveService = require('../services/driveService');
const fs = require('fs');
const EncryptionService = require('../services/encryptionService');
const encryptionService = new EncryptionService();

// Obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await pool.query(
            'SELECT id, nombre as nombreEncriptado, email, createdAt, rol, online AS estado FROM usuario ORDER BY createdAt DESC'
        );

        // Desencriptar nombres de usuarios
        const usuariosDesencriptados = await Promise.all(usuarios.map(async usuario => ({
            ...usuario,
            nombre: await encryptionService.decrypt(usuario.nombreEncriptado)
        })));

        res.json(usuariosDesencriptados);
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
        const prestamosRecientesDecrypt=prestamosRecientes.map(prestamo=>({
            ...prestamo,
            nombreUsuario: encryptionService.decrypt(prestamo.nombreUsuario)
        }))

        // Últimas reseñas
        const [ultimasResenas] = await pool.query(
            `SELECT r.*, u.nombre as nombreUsuario, l.titulo as tituloLibro 
             FROM resena r 
             JOIN usuario u ON r.usuarioId = u.id 
             JOIN libro l ON r.libroId = l.id 
             ORDER BY r.createdAt DESC LIMIT 5`
        );

        const ultimasResenasDecrypt=ultimasResenas.map(resena=>({
            ...resena,
            nombreUsuario: encryptionService.decrypt(resena.nombreUsuario)
        }))

        res.json({
            usuarios: usuarios[0].total,
            libros: libros[0].total,
            prestamosActivos: prestamosActivos[0].total,
            prestamosTotal: prestamosTotal[0].total,
            totalResenas: totalResenas[0].total,
            prestamosRecientes: prestamosRecientesDecrypt,
            ultimasResenas: ultimasResenasDecrypt
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
        console.log('formato ' ,format)
        if (!entities || !Array.isArray(entities)) {
            return res.status(400).json({ error: 'Debe especificar las entidades a exportar' });
        }

        const exportedData = await dataService.exportData(entities);
        let buffer;
        let fileName;
        let mimeType;

        // Handle different export formats
        switch (format) {
            case 'excel':
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

                // Generar buffer del Excel
                buffer = await workbook.xlsx.writeBuffer();
                fileName = `reporte_${Date.now()}.xlsx`;
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
                
                // Función para sanitizar y codificar texto
                const sanitizeText = (text) => {
                    if (text === null || text === undefined) return '';
                    return String(text)
                        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                        .normalize('NFC')
                        .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')
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

                    // Dibujar filas
                    let currentY = startY + headerHeight;
                    data.forEach((row, rowIndex) => {
                        if (currentY > doc.page.height - 100) {
                            doc.addPage();
                            currentY = 50;
                        }

                        headers.forEach((header, colIndex) => {
                            const cellValue = sanitizeText(row[header]);
                            const textHeight = doc.heightOfString(cellValue, {
                                width: cellWidth - 2 * cellPadding
                            });
                            const cellHeight = Math.max(minLineHeight, textHeight + 2 * cellPadding);

                            doc.text(cellValue, startX + colIndex * cellWidth + cellPadding, currentY, {
                                width: cellWidth - 2 * cellPadding
                            });

                            currentY = Math.max(currentY, currentY + cellHeight);
                        });
                    });
                };

                // Crear tablas para cada entidad
                let currentY = 50;
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;

                    if (currentY > doc.page.height - 100) {
                        doc.addPage();
                        currentY = 50;
                    }

                    doc.fontSize(14);
                    doc.text(sanitizeText(key), 50, currentY);
                    currentY += 30;

                    const headers = Object.keys(data[0]);
                    createTable(doc, headers, data, 50, currentY);
                    currentY += 50;
                });

                // Generar buffer del PDF
                buffer = await new Promise((resolve) => {
                    const chunks = [];
                    doc.on('data', chunk => chunks.push(chunk));
                    doc.on('end', () => resolve(Buffer.concat(chunks)));
                    doc.end();
                });

                fileName = `reporte_${Date.now()}.pdf`;
                mimeType = 'application/pdf';
                break;

            case 'sql':
                let sqlContent = '';
                
                // Generar consultas SQL para cada entidad
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;
                    
                    // Agregar comentario de sección
                    sqlContent += `\n-- Datos de ${key}\n`;
                    
                    data.forEach(row => {
                        const columns = Object.keys(row).join(', ');
                        const values = Object.values(row).map(val => {
                            if (val === null) return 'NULL';
                            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                            if (val instanceof Date) return `'${val.toISOString()}'`;
                            return val;
                        }).join(', ');
                        
                        sqlContent += `INSERT INTO ${key} (${columns}) VALUES (${values});\n`;
                    });
                });
                
                buffer = Buffer.from(sqlContent, 'utf-8');
                fileName = `reporte_${Date.now()}.sql`;
                mimeType = 'application/sql';
                break;
                
            case 'csv':
                const csvContent = [];
                
                Object.entries(exportedData).forEach(([key, data]) => {
                    if (!Array.isArray(data) || data.length === 0) return;
                    
                    // Agregar nombre de la entidad como separador
                    csvContent.push(`\n# ${key}`);
                    
                    // Agregar encabezados
                    const headers = Object.keys(data[0]);
                    csvContent.push(headers.join(','));
                    
                    // Agregar datos
                    data.forEach(row => {
                        const values = headers.map(header => {
                            const val = row[header];
                            if (val === null) return '';
                            if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
                            if (val instanceof Date) return val.toISOString();
                            return val;
                        });
                        csvContent.push(values.join(','));
                    });
                });
                
                buffer = Buffer.from(csvContent.join('\n'), 'utf-8');
                fileName = `reporte_${Date.now()}.csv`;
                mimeType = 'text/csv';
                break;
                
            default:
                // Para JSON, convertir a string y luego a buffer
                buffer = Buffer.from(JSON.stringify(exportedData, null, 2));
                fileName = `reporte_${Date.now()}.json`;
                mimeType = 'application/json';
        }

        // Subir el reporte encriptado a Google Drive y obtener el archivo original
        const uploadResult = await driveService.uploadReport(req.user.id, buffer, fileName, mimeType);

        // Enviar el archivo original al usuario
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.sendFile(uploadResult.originalFilePath, (err) => {
            if (err) {
                console.error('Error al enviar archivo:', err);
            }
            // Limpiar el archivo temporal después de enviarlo
            fs.unlinkSync(uploadResult.originalFilePath);
        });

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
        console.log(req.body);
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
const templateService = require('../services/templateService');

const generateTemplate = async (req, res) => {
    try {
        const { entity } = req.query;
        console.log('entidad ', entity)
        if (!entity) {
            return res.status(400).json({ error: 'Debe especificar el tipo de entidad' });
        }

        const result = await templateService.generateTemplateFile(entity);
        
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
        res.send(result.buffer);

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