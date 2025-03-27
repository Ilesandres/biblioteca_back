const express = require("express"); 
const cors = require("cors");
const { createServer } = require('http');
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

const app = express();
const httpServer = createServer(app);
const io = initializeSocket(httpServer);

app.use(cors());
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

const PORT = process.env.PORT || 5000;


pool.query('SELECT 1')
    .then(() => {
        console.log('Database connection successful');
        httpServer.listen(PORT, () => {
            console.log(`¡Servidor corriendo en http://localhost:${PORT}!`);
            console.log(`Documentación disponible en http://localhost:${PORT}/api-docs`);
        });
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
    });
