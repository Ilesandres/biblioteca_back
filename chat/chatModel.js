const pool = require('../config/db');

class Chat {
    static async findAll() {
        const [rows] = await pool.query('SELECT * FROM chats ORDER BY created_at DESC');
        return rows;
    }

    static async findOne(id) {
        const [rows] = await pool.query('SELECT * FROM chats WHERE id = ?', [id]);
        return rows[0];
    }

    static async create(data) {
        const [result] = await pool.query('INSERT INTO chats SET ?', [data]);
        return { id: result.insertId, ...data };
    }

    static async update(id, data) {
        await pool.query('UPDATE chats SET ? WHERE id = ?', [data, id]);
        return this.findOne(id);
    }
}

module.exports = Chat;