const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { data: googleDriveConfig } = require('../config/client_data_drive.api');
const EncryptionService = require('./encryptionService');
const pool = require('../config/db');

// Asegurar que el directorio temporal exista
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

class DriveService {
    constructor() {
        this.encryptionService = new EncryptionService();
        this.driveClient = this.initializeDriveClient();
        this.folderId = process.env.GOOGLE_DRIVE_ID_FOLDER;
        this.tempDir = tempDir;
    }

    initializeDriveClient() {
        const auth = new google.auth.GoogleAuth({
            credentials: googleDriveConfig,
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });

        return google.drive({ version: 'v3', auth });
    }

    async uploadFile(userId, file) {
        try {
            // Crear nombres de archivo
            const originalFileName = `original_${file.originalname}`;
            const encryptedFileName = `encrypted_${file.originalname}`;
            
            // Rutas de archivos temporales
            const originalFilePath = path.join(this.tempDir, originalFileName);
            const encryptedFilePath = path.join(this.tempDir, encryptedFileName);

            // Guardar el archivo original
            fs.writeFileSync(originalFilePath, file.buffer);

            // Encriptar el archivo
            await this.encryptionService.encryptFile(originalFilePath, encryptedFilePath);

            // Subir el archivo encriptado a Google Drive
            const fileMetadata = {
                name: encryptedFileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(encryptedFilePath)
            };

            const driveFile = await this.driveClient.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            // Guardar información en la base de datos usando las columnas existentes
            const [result] = await pool.query(
                'INSERT INTO files (user_id, file_name, file_link) VALUES (?, ?, ?)',
                [userId, file.originalname, driveFile.data.webViewLink]
            );

            // Limpiar archivos temporales
            fs.unlinkSync(encryptedFilePath);

            return {
                id: result.insertId,
                fileName: file.originalname,
                fileLink: driveFile.data.webViewLink,
                originalFilePath: originalFilePath
            };
        } catch (err) {
            console.error('Error al subir archivo:', err);
            throw err;
        }
    }

    async downloadFile(fileId, userId) {
        console.log('Descargando archivo con id:', fileId);
        try {
            // Verificar que el usuario tiene acceso al archivo
            const [fileInfo] = await pool.query(
                'SELECT * FROM files WHERE id = ? AND user_id = ?',
                [fileId, userId]
            );

            if (fileInfo.length === 0) {
                throw new Error('Archivo no encontrado o sin acceso');
            }

            // Crear nombres de archivos temporales
            const tempEncryptedPath = path.join(this.tempDir, `temp_${Date.now()}_encrypted`);
            const tempDecryptedPath = path.join(this.tempDir, `temp_${Date.now()}_${fileInfo[0].file_name}`);

            try {
                // Extraer el ID del archivo de Google Drive de la URL
                const driveFileId = fileInfo[0].file_link.split('/')[5];
                console.log('ID del archivo en Google Drive:', driveFileId);
                
                // Descargar archivo encriptado de Google Drive
                const response = await this.driveClient.files.get(
                    { fileId: driveFileId, alt: 'media' },
                    { responseType: 'stream' }
                );

                // Guardar el archivo encriptado
                const writer = fs.createWriteStream(tempEncryptedPath);
                await new Promise((resolve, reject) => {
                    response.data
                        .pipe(writer)
                        .on('finish', resolve)
                        .on('error', reject);
                });

                console.log('Archivo encriptado guardado en:', tempEncryptedPath);

                // Desencriptar el archivo
                await this.encryptionService.decryptFile(tempEncryptedPath, tempDecryptedPath);
                console.log('Archivo desencriptado guardado en:', tempDecryptedPath);

                // Leer el archivo desencriptado
                const fileBuffer = await fs.promises.readFile(tempDecryptedPath);

                return {
                    buffer: fileBuffer,
                    fileName: fileInfo[0].file_name,
                    mimeType: 'application/octet-stream'
                };

            } finally {
                // Limpiar archivos temporales
                try {
                    if (fs.existsSync(tempEncryptedPath)) {
                        await fs.promises.unlink(tempEncryptedPath);
                        console.log('Archivo encriptado temporal eliminado');
                    }
                    if (fs.existsSync(tempDecryptedPath)) {
                        await fs.promises.unlink(tempDecryptedPath);
                        console.log('Archivo desencriptado temporal eliminado');
                    }
                } catch (cleanupError) {
                    console.error('Error limpiando archivos temporales:', cleanupError);
                }
            }
        } catch (error) {
            console.error('Error en downloadFile:', error);
            throw error;
        }
    }

    async deleteFile(fileId, userId) {
        try {
            // Verificar que el usuario tiene acceso al archivo
            const [fileInfo] = await pool.query(
                'SELECT * FROM files WHERE id = ? AND user_id = ?',
                [fileId, userId]
            );

            if (fileInfo.length === 0) {
                throw new Error('Archivo no encontrado o sin acceso');
            }

            // Extraer el ID del archivo de Google Drive de la URL
            const driveFileId = fileInfo[0].file_link.split('/')[5];
            console.log('Intentando eliminar archivo con ID:', driveFileId);

            // Eliminar archivo de Google Drive
            await this.driveClient.files.delete({
                fileId: driveFileId
            });

            // Eliminar registro de la base de datos
            await pool.query(
                'DELETE FROM files WHERE id = ?',
                [fileId]
            );

            return { success: true, message: 'Archivo eliminado correctamente' };
        } catch (error) {
            console.error('Error en deleteFile:', error);
            // Si el archivo no se encuentra en Drive pero existe en la BD, eliminamos el registro
            if (error.code === 404) {
                await pool.query('DELETE FROM files WHERE id = ?', [fileId]);
                return { success: true, message: 'Registro eliminado de la base de datos' };
            }
            throw error;
        }
    }

    async listFiles(userId) {
        console.log('listFiles called with userId:', userId);  // Agrega esta línea para depuració
        try {
            const [files] = await pool.query(
                'SELECT id, file_name, uploaded_at FROM files WHERE user_id = ? ORDER BY uploaded_at DESC',
                [userId]
            );
            return files;
        } catch (error) {
            console.error('Error en listFiles:', error);
            throw error;
        }
    }

    async listAllFiles() {
        try {
            const [files] = await pool.query(`
                SELECT 
                    f.id,
                    f.file_name,
                    f.file_link,
                    f.uploaded_at,
                    u.nombre,
                    u.email,
                    u.rol
                FROM files f
                INNER JOIN usuario u ON f.user_id = u.id
                ORDER BY f.uploaded_at DESC
            `);

            if(!files || files.length === 0) throw new Error('No files found');
            
            // Desencriptar el nombre de usuario y modificar el link
            const filesDecrypted = await Promise.all(files.map(async file => {
                const decryptedFile = { ...file };
                decryptedFile.nombre = await this.encryptionService.decrypt(file.nombre);
                decryptedFile.file_link = file.file_link.replace(/\/view\?usp=drive_link/, '/preview');
                return decryptedFile;
            }));
            
            return filesDecrypted;
        } catch (error) {
            console.error('Error in listAllFiles:', error);
            throw error;
        }
    }

    async uploadReport(userId, buffer, fileName, mimeType) {
        try {
            // Crear nombres de archivo
            const originalFileName = `original_${fileName}`;
            const encryptedFileName = `encrypted_${fileName}`;
            
            // Rutas de archivos temporales
            const originalFilePath = path.join(this.tempDir, originalFileName);
            const encryptedFilePath = path.join(this.tempDir, encryptedFileName);

            // Guardar el archivo original
            fs.writeFileSync(originalFilePath, buffer);

            // Encriptar el archivo
            await this.encryptionService.encryptFile(originalFilePath, encryptedFilePath);

            // Subir el archivo encriptado a Google Drive
            const fileMetadata = {
                name: encryptedFileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: mimeType,
                body: fs.createReadStream(encryptedFilePath)
            };

            const file = await this.driveClient.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            // Guardar información en la base de datos usando las columnas existentes
            const [result] = await pool.query(
                'INSERT INTO files (user_id, file_name, file_link) VALUES (?, ?, ?)',
                [userId, fileName, file.data.webViewLink]
            );

            // Limpiar archivos temporales
            fs.unlinkSync(encryptedFilePath);

            return {
                id: result.insertId,
                fileName: fileName,
                fileLink: file.data.webViewLink,
                originalFilePath: originalFilePath
            };
        } catch (err) {
            console.error('Error al subir reporte:', err);
            throw err;
        }
    }
}

module.exports = new DriveService();