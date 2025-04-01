const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

class EncryptionService {
    constructor() {
        // Verificar que la clave de encriptación esté definida
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error('ENCRYPTION_KEY no está definida en las variables de entorno');
        }
        
        // La clave debe tener 32 bytes para AES-256
        this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        if (this.key.length !== 32) {
            throw new Error('ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes)');
        }
        
        this.algorithm = 'aes-256-gcm';
    }

    encrypt(text) {
        if (!text) return text;
        
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        // Devolver IV + authTag + texto cifrado
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    decrypt(encryptedText) {
        if (!encryptedText) return encryptedText;
        
        try {
            // Validar formato del texto encriptado
            if (typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
                console.error('Formato de texto encriptado inválido:', encryptedText);
                return encryptedText;
            }
            
            const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
            
            if (!ivHex || !authTagHex || !encrypted) {
                console.error('Componentes de encriptación faltantes:', { ivHex, authTagHex, encrypted });
                return encryptedText;
            }
            
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('Error al desencriptar:', error);
            // Si hay un error de autenticación o formato, devolver el texto original
            return encryptedText;
        }
    }

    // Encripta datos antes de guardarlos en la base de datos
    encryptData(data, fields) {
        if (!data || !fields) return data;
        
        const encryptedData = { ...data };
        fields.forEach(field => {
            if (encryptedData[field] && field !== 'password' && field !== 'email') {
                encryptedData[field] = this.encrypt(encryptedData[field]);
            }
        });
        
        return encryptedData;
    }

    // Desencripta datos después de obtenerlos de la base de datos
    decryptData(data, fields) {
        if (!data || !fields) return data;
        
        const decryptedData = { ...data };
        fields.forEach(field => {
            if (decryptedData[field] && field !== 'password') {
                try {
                    // Verificar si el campo ya está desencriptado
                    if (typeof decryptedData[field] === 'string' && decryptedData[field].includes(':')) {
                        decryptedData[field] = this.decrypt(decryptedData[field]);
                    }
                } catch (error) {
                    console.error(`Error al desencriptar campo ${field}:`, error);
                    // Mantener el valor original si falla la desencriptación
                }
            }
        });
        
        return decryptedData;
    }

    // Encripta un array de objetos
    encryptDataArray(dataArray, fields) {
        if (!Array.isArray(dataArray) || !fields) return dataArray;
        return dataArray.map(item => this.encryptData(item, fields));
    }

    // Desencripta un array de objetos
    decryptDataArray(dataArray, fields) {
        if (!Array.isArray(dataArray) || !fields) return dataArray;
        
        return dataArray.map(item => {
            try {
                return this.decryptData(item, fields);
            } catch (error) {
                console.error('Error al desencriptar item:', error);
                return item; // Devolver el item original si falla la desencriptación
            }
        });
    }

    async encryptFile(inputPath, outputPath) {
        try {
            const iv = crypto.randomBytes(12);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            // Leer el archivo de entrada completo
            const inputBuffer = await fs.promises.readFile(inputPath);
            
            // Encriptar los datos
            const encrypted = Buffer.concat([
                cipher.update(inputBuffer),
                cipher.final()
            ]);
            
            // Obtener el tag de autenticación
            const authTag = cipher.getAuthTag();
            
            // Combinar IV + datos encriptados + authTag
            const finalBuffer = Buffer.concat([iv, encrypted, authTag]);
            
            // Escribir el archivo encriptado
            await fs.promises.writeFile(outputPath, finalBuffer);
            
            return true;
        } catch (error) {
            console.error('Error al encriptar archivo:', error);
            throw error;
        }
    }

    async decryptFile(inputPath, outputPath) {
        try {
            // Leer el archivo encriptado completo
            const inputBuffer = await fs.promises.readFile(inputPath);
            
            // Extraer IV y authTag
            const iv = inputBuffer.slice(0, 12);
            const authTag = inputBuffer.slice(-16);
            const encryptedData = inputBuffer.slice(12, -16);
            
            // Crear decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            
            // Desencriptar los datos
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            
            // Escribir el archivo desencriptado
            await fs.promises.writeFile(outputPath, decrypted);
            
            return true;
        } catch (error) {
            console.error('Error al desencriptar archivo:', error);
            throw error;
        }
    }

    async createDecryptStream() {
        const { Transform } = require('stream');

        // Crear un transform stream para manejar la desencriptación
        const decryptStream = new Transform({
            transform(chunk, encoding, callback) {
                try {
                    if (!this.buffer) {
                        this.buffer = Buffer.alloc(0);
                    }
                    
                    // Acumular datos en el buffer
                    this.buffer = Buffer.concat([this.buffer, chunk]);

                    // Si no tenemos suficientes datos para iniciar la desencriptación, esperar más
                    if (!this.decipher && this.buffer.length < 12) {
                        callback();
                        return;
                    }

                    // Inicializar decipher si aún no está configurado
                    if (!this.decipher) {
                        const iv = this.buffer.slice(0, 12);
                        this.decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
                        this.buffer = this.buffer.slice(12);
                    }

                    // Mantener al menos 16 bytes para el authTag
                    if (this.buffer.length > 16) {
                        const processLength = this.buffer.length - 16;
                        const dataToProcess = this.buffer.slice(0, processLength);
                        this.buffer = this.buffer.slice(processLength);

                        if (dataToProcess.length > 0) {
                            const decrypted = this.decipher.update(dataToProcess);
                            this.push(decrypted);
                        }
                    }

                    callback();
                } catch (error) {
                    callback(error);
                }
            },
            flush(callback) {
                try {
                    if (this.decipher && this.buffer.length >= 16) {
                        // Configurar authTag y procesar los últimos datos
                        const authTag = this.buffer.slice(-16);
                        this.decipher.setAuthTag(authTag);
                        
                        if (this.buffer.length > 16) {
                            const finalData = this.buffer.slice(0, -16);
                            const decrypted = this.decipher.update(finalData);
                            this.push(decrypted);
                        }
                        
                        const final = this.decipher.final();
                        this.push(final);
                    }
                    callback();
                } catch (error) {
                    callback(error);
                }
            }
        });


        // Vincular el contexto de EncryptionService al transform stream
        decryptStream.algorithm = this.algorithm;
        decryptStream.key = this.key;

        return decryptStream;
    }
}

module.exports = EncryptionService;