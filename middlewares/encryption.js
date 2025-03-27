const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream');

// Configuración de encriptación
if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY no está definida en las variables de entorno');
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
// Verificar que la clave tenga el tamaño correcto
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes)');
}

const IV_LENGTH = 12; // Cambiado a 12 bytes para mantener consistencia con el servicio
const AUTH_TAG_LENGTH = 16; // Longitud del tag de autenticación

// Función para encriptar datos
const encrypt = (text) => {
    if (!text) return text;
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Formato: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

// Función para desencriptar datos
const decrypt = (encryptedText) => {
    if (!encryptedText) return encryptedText;
    
    try {
        const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');
        
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(ENCRYPTION_KEY, 'hex'),
            Buffer.from(ivHex, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Error al desencriptar:', error);
        return null;
    }
};

// Middleware para encriptar campos específicos
const encryptFields = (fields) => {
    return (req, res, next) => {
        if (req.body) {
            for (const field of fields) {
                if (req.body[field]) {
                    req.body[field] = encrypt(req.body[field]);
                }
            }
        }
        next();
    };
};

// Middleware para desencriptar campos específicos
const decryptFields = (fields) => {
    return (req, res, next) => {
        if (req.body) {
            for (const field of fields) {
                if (req.body[field]) {
                    req.body[field] = decrypt(req.body[field]);
                }
            }
        }
        next();
    };
};

// Middleware para encriptar archivos
const encryptFile = async (filePath, outputPath) => {
    try {
        const iv = crypto.randomBytes(12); 
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(outputPath);
        
        // Escribir IV al inicio
        output.write(iv);
        
        await pipeline(input, cipher, output);
        
        const authTag = cipher.getAuthTag();
        await fs.promises.appendFile(outputPath, authTag);
        
        return true;
    } catch (error) {
        console.error('Error al encriptar archivo:', error);
        throw error;
    }
};

// Middleware para desencriptar archivos
const decryptFile = async (filePath, outputPath) => {
    try {
        const fileBuffer = await fs.promises.readFile(filePath);
        
        // Extraer IV y authTag
        const iv = fileBuffer.slice(0, 12);
        const authTag = fileBuffer.slice(-16);
        const encryptedData = fileBuffer.slice(12, -16);
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
        
        await fs.promises.writeFile(outputPath, decrypted);
        return true;
    } catch (error) {
        console.error('Error al desencriptar archivo:', error);
        throw error;
    }
};

// Middleware para manejar la encriptación de archivos subidos
const handleFileEncryption = (fieldName) => {
    return async (req, res, next) => {
        try {
            if (req.file && req.file.path) {
                const encryptedPath = req.file.path + '.encrypted';
                await encryptFile(req.file.path, encryptedPath);
                
                // Eliminar archivo original y actualizar la ruta
                await fs.promises.unlink(req.file.path);
                req.file.path = encryptedPath;
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};

// Middleware para manejar la desencriptación de archivos
const handleFileDecryption = (fieldName) => {
    return async (req, res, next) => {
        try {
            if (req.file && req.file.path && req.file.path.endsWith('.encrypted')) {
                const decryptedPath = req.file.path.replace('.encrypted', '');
                await decryptFile(req.file.path, decryptedPath);
                req.file.path = decryptedPath;
            }
            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    encrypt,
    decrypt,
    encryptFields,
    decryptFields,
    encryptFile,
    decryptFile,
    handleFileEncryption,
    handleFileDecryption
};