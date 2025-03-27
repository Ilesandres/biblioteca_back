const driveService = require('../services/driveService');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

class FileController {
    constructor() {
        this.upload = upload.single('file');
    }

    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
            }

            const result = await driveService.uploadFile(req.user.id, req.file);
            res.json(result);
        } catch (error) {
            console.error('Error al subir archivo:', error);
            res.status(500).json({ error: 'Error al procesar la subida del archivo' });
        }
    }

    async downloadFile(req, res) {
        try {
            const { fileId } = req.params;
            const file = await driveService.downloadFile(fileId, req.user.id);
            
            res.setHeader('Content-Type', file.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
            res.send(file.buffer);
        } catch (error) {
            console.error('Error al descargar archivo:', error);
            res.status(500).json({ error: 'Error al descargar el archivo' });
        }
    }

    async deleteFile(req, res) {
        try {
            const { fileId } = req.params;
            const result = await driveService.deleteFile(fileId, req.user.id);
            res.json(result);
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            res.status(500).json({ error: 'Error al eliminar el archivo' });
        }
    }

    async listFiles(req, res) {
        try {
            const files = await driveService.listFiles(req.user.id);
            res.json(files);
        } catch (error) {
            console.error('Error al listar archivos:', error);
            res.status(500).json({ error: 'Error al obtener la lista de archivos' });
        }
    }
    async listAllFiles(req, res) {
        try {
            const files = await driveService.listAllFiles();
            res.json(files);
        } catch (error) {
            console.error('Error al listar todos los archivos:', error);
            res.status(500).json({ error: 'Error al obtener la lista de todos los archivos' });
        }
    }
}

module.exports = new FileController(); 