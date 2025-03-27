const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Biblioteca',
            version: '1.0.0',
            description: 'API para sistema de gestión de biblioteca',
        },
        servers: [
            {
                url: process.env.API_URL || 'http://localhost:3005/api',
                description: 'Servidor de desarrollo'
            },
            {
                url: 'https://biblioteca-back-wyy2.onrender.com/api',
                description: 'Servidor de producción'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        }
    },
    apis: ['./routes/*.js', './models/*.js', './swagger/routes/*.js'], // archivos a documentar
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec, swaggerUi };