const ExcelJS = require('exceljs');
const pool = require('../config/db');

class TemplateService {
    // Obtener todas las plantillas disponibles
    async getAllTemplates() {
        try {
            const entityMap = {
                'books': { table: 'libro', name: 'Libros' },
                'users': { table: 'usuario', name: 'Usuarios' },
                'loans': { table: 'prestamo', name: 'Préstamos' },
                'reviews': { table: 'resena', name: 'Reseñas' },
                'categories': { table: 'categoria', name: 'Categorías' },
                'bookcategories':{table:'librocategoria', name: 'categoria y libro'}
            };

            const [columns] = await pool.query(`
                SELECT TABLE_NAME, COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME IN ('libro', 'usuario', 'prestamo', 'resena', 'categoria')
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `);

            const templates = [];
            const groupedColumns = columns.reduce((acc, col) => {
                if (!acc[col.TABLE_NAME]) acc[col.TABLE_NAME] = [];
                acc[col.TABLE_NAME].push(col.COLUMN_NAME);
                return acc;
            }, {});

            for (const [id, info] of Object.entries(entityMap)) {
                if (groupedColumns[info.table]) {
                    templates.push({
                        id,
                        name: info.name,
                        fields: groupedColumns[info.table].map(field => this.formatColumnName(field))
                    });
                }
            }

            return templates;
        } catch (error) {
            console.error('Error al obtener plantillas:', error);
            throw error;
        }
    }

    // Formatear nombre de columna para mejor presentación
    formatColumnName(columnName) {
        return columnName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Obtener una plantilla específica
    async getTemplate(entity) {
        const entityMap = {
            'books': { table: 'libro', name: 'Libros' },
            'users': { table: 'usuario', name: 'Usuarios' },
            'loans': { table: 'prestamo', name: 'Préstamos' },
            'reviews': { table: 'resena', name: 'Reseñas' },
            'categories': { table: 'categoria', name: 'Categorías' },
            'bookcategories':{table:'librocategoria', name: 'categoria y libro'}
        };

        const mappedEntity = entityMap[entity];
        if (!mappedEntity) return null;

        const [columns] = await pool.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [mappedEntity.table]);

        return {
            id: entity,
            name: mappedEntity.name,
            fields: columns.map(col => this.formatColumnName(col.COLUMN_NAME))
        };
    }

    // Generar archivo de plantilla
    async generateTemplateFile(entity) {
        const template = await this.getTemplate(entity);
        if (!template) {
            throw new Error('Plantilla no encontrada');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(template.name);

        // Configurar encabezados
        worksheet.columns = template.fields.map(field => ({
            header: field,
            key: field.toLowerCase(),
            width: 20
        }));

        // Aplicar estilos al encabezado
        worksheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0066CC' }
        };

        // Agregar validaciones según el tipo de campo
        template.fields.forEach((field, index) => {
            const col = worksheet.getColumn(index + 1);
            switch (field) {
                case 'Año de Publicación':
                    col.numFmt = '0';
                    break;
                case 'Stock':
                    col.numFmt = '0';
                    break;
                case 'Calificación':
                    col.numFmt = '0.0';
                    break;
                case 'Fecha Préstamo':
                case 'Fecha Devolución Esperada':
                    col.numFmt = 'dd/mm/yyyy';
                    break;
            }
        });

        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        return {
            buffer,
            filename: `plantilla_${template.id}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
    }
}

module.exports = new TemplateService();