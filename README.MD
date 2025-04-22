# Biblioteca Backend

Este es el backend del sistema de gestión de biblioteca, un servicio RESTful construido con Node.js que proporciona todas las funcionalidades necesarias para administrar una biblioteca digital.

## Requisitos Previos

- Node.js (v14 o superior)
- MySQL
- Docker (opcional, para despliegue con contenedores)

## Configuración del Entorno

1. Clona el repositorio:
```bash
git clone <https://github.com/Ilesandres/biblioteca_back>
cd biblioteca_back
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
- Copia el archivo `.env.example` a `.env`
- Ajusta las variables según tu entorno:

```env
# Configuración de la base de datos
DB_HOST=localhost     # Host de la base de datos
DB_USER=root         # Usuario de la base de datos
DB_PASS=             # Contraseña de la base de datos
DB_NAME=biblioteca   # Nombre de la base de datos

# Configuración del servidor
PORT=3005            # Puerto donde correrá el servidor default 3005 de donde recibe el front
NODE_ENV=development # Entorno de desarrollo

# Clave secreta para JWT
JWT_SECRET=your_jwt_secret_key  # Clave para firmar los tokens

# Cloudinary (para almacenamiento de imágenes)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Ejecución con Node.js

1. Inicia el servidor en modo desarrollo:
```bash
npm run dev
```

2. O en modo producción:
```bash
npm start
```

El servidor estará disponible en `http://localhost:3001` (o el puerto que hayas configurado)

## Ejecución con Docker

1. Construye la imagen:
```bash
docker build -t biblioteca-backend .
```

2. Ejecuta el contenedor:
```bash
docker run -p 3001:3001 --env-file .env biblioteca-backend
```

## Estructura del Proyecto

- `/controllers`: Lógica de negocio y manejo de peticiones
- `/models`: Modelos de datos y esquemas
- `/routes`: Definición de rutas API
- `/middleware`: Middlewares de autenticación y validación
- `/config`: Archivos de configuración
- `/services`: Servicios externos y utilidades

## Características Principales

- Autenticación JWT
- Gestión de usuarios y roles
- CRUD de libros y categorías
- Sistema de préstamos
- Gestión de reseñas
- Almacenamiento de imágenes en Cloudinary
- Notificaciones en tiempo real

## Seguridad

- Asegúrate de cambiar todas las claves secretas en producción
- Utiliza contraseñas fuertes para la base de datos
- Mantén el archivo .env fuera del control de versiones
- Configura correctamente los CORS en producción

## Configuración SSL

### Desarrollo (Certificados Autofirmados)

1. Instala mkcert:
```bash
# Windows (con Chocolatey)
choco install mkcert

# macOS (con Homebrew)
brew install mkcert

# Linux
sudo apt install libnss3-tools
sudo apt install mkcert
```

2. Configura mkcert y genera los certificados:
```bash
mkcert -install
mkdir ssl
cd ssl
mkcert localhost
```

Esto generará dos archivos en la carpeta `ssl`:
- `localhost.pem` (certificado)
- `localhost-key.pem` (llave privada)

3. Actualiza las variables de entorno en `.env`:
```env
SSL_KEY_PATH=./ssl/localhost-key.pem
SSL_CERT_PATH=./ssl/localhost.pem
ENABLE_HTTPS=true
```

### Producción

Para producción, se recomienda:
- Utilizar certificados SSL válidos de una Autoridad Certificadora (CA) reconocida
- Considerar servicios como Let's Encrypt para certificados gratuitos
- Configurar renovación automática de certificados
- Mantener las llaves privadas seguras y nunca compartirlas

### Estructura de Archivos SSL

```
biblioteca_back/
├── ssl/
│   ├── localhost.pem
│   └── localhost-key.pem
```

## Soporte

Para reportar problemas o solicitar ayuda, por favor crea un issue en el repositorio.