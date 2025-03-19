const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {googleConfig}=require('../config/client_data.js')


// Cargar configuración de Google OAuth


const client = new OAuth2Client(googleConfig.web.client_id);

// Función para validar y sanitizar los datos del usuario
const validateUserData = (payload) => {
    if (!payload.email || !payload.name) {
        throw new Error('Datos de usuario incompletos');
    }
    return {
        email: payload.email.toLowerCase().trim(),
        name: payload.name.trim()
    };
};

// Verificar token de Google y obtener información del usuario
const verifyGoogleToken = async (data) => {
    console.log('Verificando token de Google...', data)
    const token=data;
    if(!token){
        throw new Error('Token de Google no proporcionado');
    }
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        return ticket.getPayload();
    } catch (error) {
        throw new Error('Token de Google inválido');
    }
};

// Login con Google
const googleLogin = async (req, res) => {
    console.log('Llegó a googleLogin');
    try {
        console.log('virificando token de google')
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({
                error: 'Credencial de Google no proporcionada'
            });
        }
        console.log('Iniciando proceso de login con Google...');
        const payload = await verifyGoogleToken(credential);
        console.log('Token de Google verificado exitosamente');

        const { email } = validateUserData(payload);

        // Buscar usuario existente
        console.log('Buscando usuario en la base de datos...');
        const [users] = await pool.query(
            'SELECT * FROM usuario WHERE email = ?',
            [email]
        );
        console.log('Resultado de búsqueda:', { usuariosEncontrados: users.length });

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Usuario no registrado. Por favor, regístrese primero.'
            });
        }

        const user = users[0];

        // Actualizar estado online del usuario
        await pool.query(
            'UPDATE usuario SET online = TRUE, lastSeen = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                rol: user.rol,
                isAgente: !!user.agenteId,
                agenteId: user.agenteId,
                estadoAgente: user.estadoAgente
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                id: user.id,
                username: user.nombre,
                email: user.email,
                rol: user.rol,
                isAgente: !!user.agenteId,
                agenteId: user.agenteId,
                estadoAgente: user.estadoAgente
            },
            token
        });
    } catch (error) {
        console.error('Error en login con Google:', error);
        res.status(400).json({ error: error.message });
    }
};

// Registro con Google
const googleRegister = async (req, res) => {
    try {
        console.log('Llegó a googleRegister validacion')
        const { credential } = req.body;
        console.log('Credencial de Google recibida:', credential);

        if (!credential) {
            console.log('Error: Credencial de Google no proporcionada');
            return res.status(400).json({
                error: 'Credencial de Google no proporcionada'
            });
        }

        console.log('Verificando credencial de Google...');
        const payload = await verifyGoogleToken(credential);
        console.log('Token de Google verificado exitosamente');
        
        const { email, name } = validateUserData(payload);
        console.log('Información del usuario de Google validada:', { email, name });

        if (!payload.email || !payload.name) {
            return res.status(400).json({
                error: 'Información de usuario incompleta en el token de Google'
            });
        }

        console.log('Verificando si el usuario existe en la base de datos...');
        // Verificar si el usuario ya existe
        const [existingUser] = await pool.query(
            'SELECT id, nombre, email, rol FROM usuario WHERE email = ?',
            [payload.email]
        );
        console.log('Resultado de búsqueda de usuario:', existingUser);

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'El email ya está registrado. Por favor, inicie sesión.',
                user: existingUser[0]
            });
        }

        console.log('Creando nuevo usuario en la base de datos...');
        // Generar una contraseña aleatoria segura
        const randomPassword = crypto.randomBytes(32).toString('hex');

        // Crear nuevo usuario con la contraseña generada
        const [result] = await pool.query(
            'INSERT INTO usuario (nombre, email, password, rol, online, lastSeen) VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)',
            [payload.name, payload.email, randomPassword, 'usuario']
        );
        console.log('Usuario creado exitosamente:', { insertId: result.insertId });

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: result.insertId, 
                email: payload.email, 
                rol: 'usuario',
                isAgente: false
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: {
                id: result.insertId,
                username: payload.name,
                email: payload.email,
                rol: 'usuario',
                isAgente: false
            },
            token
        });
    } catch (error) {
        console.error('Error en registro con Google:', error);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    googleLogin,
    googleRegister
};