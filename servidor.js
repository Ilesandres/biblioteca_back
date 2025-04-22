const express = require("express"); 
const cors = require("cors");
const { createServer: createHttpsServer } = require('https');
const fs = require('fs');
const path = require('path');
const { initializeSocket } = require('./config/socket');
const pool = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const { swaggerSpec, swaggerUi } = require('./config/swagger');
const {enviarNotificacionesPendientes}= require('./config/socket');
const {esAdmin}=require('./middlewares/roles');
const {protegerRuta}=require('./middlewares/auth')

const libroRoutes = require('./routes/libroRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const prestamoRoutes = require('./routes/prestamoRoutes');
const resenaRoutes = require('./routes/resenaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const supportRoutes = require('./routes/supportRoutes');
const fileRoutes=require('./routes/fileRoutes');

// Configuración SSL con opciones de seguridad mejoradas
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.crt')),
  minVersion: 'TLSv1.2',
  ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
  honorCipherOrder: true,
  requestCert: false,
  rejectUnauthorized: false
};

const app = express();
const httpsServer = createHttpsServer(sslOptions, app);
const io = initializeSocket(httpsServer);


app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://tudominio.com' 
    : ['http://localhost:3000', 'https://localhost:3000'],
  credentials: true
}));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/libros', libroRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/prestamos', prestamoRoutes);
app.use('/api/resenas', resenaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/files', protegerRuta,esAdmin, fileRoutes);


app.use(errorHandler);

const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

pool.query('SELECT 1')
    .then(() => {
        console.log('Database connection successful');
        
        // Iniciar servidor HTTPS
        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`¡Servidor HTTPS corriendo en https://localhost:${HTTPS_PORT}!`);
            console.log(`Documentación disponible en https://localhost:${HTTPS_PORT}/api-docs`);
        });
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
    });
