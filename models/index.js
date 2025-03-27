// Temporary models file to support chat functionality
const pool = require('../config/db');
const Notificacion = require('./notificacionModel');

// Basic model-like functions for chat
const Chat = {
    findAll: async (options = {}) => {
        const [rows] = await pool.query('SELECT * FROM chats ORDER BY created_at DESC');
        return rows;
    },
    findOne: async (options = {}) => {
        const [rows] = await pool.query('SELECT * FROM chats WHERE id = ?', [options.where?.id]);
        return rows[0];
    },
    create: async (data) => {
        const [result] = await pool.query('INSERT INTO chats SET ?', [data]);
        return { id: result.insertId, ...data };
    }
};

// Export models
module.exports = {
    Chat,
    Notificacion
};