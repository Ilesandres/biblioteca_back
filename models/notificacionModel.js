const pool = require('../config/db');

const Notificacion = {
    // Método para actualizar una notificación
    update: async (data, where) => {
        const conditions = [];
        const params = [];
        let query = 'UPDATE notificaciones SET ';

        // Construir SET clause
        const sets = [];
        for (const [key, value] of Object.entries(data)) {
            sets.push(`${key} = ?`);
            params.push(value);
        }
        query += sets.join(', ');

        // Construir WHERE clause
        if (where.id) {
            conditions.push('id = ?');
            params.push(where.id);
        }
        if (where.usuarioId) {
            conditions.push('usuarioId = ?');
            params.push(where.usuarioId);
        }

        query += ' WHERE ' + conditions.join(' AND ');

        const [result] = await pool.query(query, params);
        return result.affectedRows > 0;
    },
    findAll: async (options = {}) => {
        const { where = {}, order = [] } = options;
        let query = 'SELECT * FROM notificaciones';
        const params = [];

        if (where.usuarioId) {
            query += ' WHERE usuarioId = ?';
            params.push(where.usuarioId);
        }

        if (order.length > 0) {
            const [field, direction] = order[0];
            query += ` ORDER BY ${field} ${direction}`;
        } else {
            query += ' ORDER BY createdAt DESC';
        }

        const [rows] = await pool.query(query, params);
        return rows;
    },

    findOne: async (options = {}) => {
        const { where = {} } = options;
        let query = 'SELECT * FROM notificaciones WHERE ';
        const conditions = [];
        const params = [];

        if (where.id) {
            conditions.push('id = ?');
            params.push(where.id);
        }

        if (where.usuarioId) {
            conditions.push('usuarioId = ?');
            params.push(where.usuarioId);
        }

        query += conditions.join(' AND ');
        const [rows] = await pool.query(query, params);
        return rows[0];
    },

    create: async (data) => {
        const [result] = await pool.query('INSERT INTO notificaciones SET ?', [data]);
        return { id: result.insertId, ...data };
    },

    update: async (id, data) => {
        await pool.query('UPDATE notificaciones SET ? WHERE id = ?', [data, id]);
        return { id, ...data };
    }
};

module.exports = Notificacion;