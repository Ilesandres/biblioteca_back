const express=require('express');
const Message=require('../models/Message');
const User=require('../models/User');
const { Op } = require('sequelize');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const auth = require('../middleware/auth');

const router=express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         content:
 *           type: string
 *         sender_id:
 *           type: integer
 *         receiver_id:
 *           type: integer
 *         read:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 * 
 * @swagger
 * tags:
 *   name: Messages
 *   description: API para gestión de mensajes
 * 
 * @swagger
 * /messages:
 *   post:
 *     summary: Envía un nuevo mensaje
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - receiver_id
 *             properties:
 *               content:
 *                 type: string
 *                 description: Contenido del mensaje
 *               receiver_id:
 *                 type: integer
 *                 description: ID del usuario que recibirá el mensaje
 *             example:
 *               content: "Hola, ¿cómo estás?"
 *               receiver_id: 2
 *     responses:
 *       201:
 *         description: Mensaje enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Error en los datos proporcionados
 *       401:
 *         description: No autorizado
 * 
 * @swagger
 * /messages/{sender_id}/{receiver_id}:
 *   get:
 *     summary: Obtiene los mensajes entre dos usuarios
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sender_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del remitente
 *       - in: path
 *         name: receiver_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del destinatario
 *     responses:
 *       200:
 *         description: Lista de mensajes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 * 
 * @swagger
 * /messages/recent:
 *   get:
 *     summary: Obtiene todas las conversaciones del usuario agrupadas
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conversaciones con sus mensajes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   conversationId:
 *                     type: integer
 *                     description: ID del otro usuario en la conversación
 *                   otherUser:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                   messages:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         content:
 *                           type: string
 *                         sender_id:
 *                           type: integer
 *                         receiver_id:
 *                           type: integer
 *                         read:
 *                           type: boolean
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: No autorizado - Token inválido
 * 
 * @swagger
 * /messages/{messageId}/read:
 *   put:
 *     summary: Marca un mensaje como leído
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del mensaje
 *     responses:
 *       200:
 *         description: Mensaje marcado como leído
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 * 
 * @swagger
 * /messages/file:
 *   post:
 *     summary: Envía un archivo como mensaje
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               receiver_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Archivo enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 * 
 * @swagger
 * /messages/search:
 *   get:
 *     summary: Busca mensajes por contenido
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *     responses:
 *       200:
 *         description: Mensajes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 */

router.post('/', auth, async(req, res)=>{
    const { content, receiver_id } = req.body;

    try {
        const message = await Message.create({
            content,
            sender_id: req.user.id,
            receiver_id
        });
        res.status(201).json(message);
    } catch (err) {
        res.status(400).json({error: err.message});
    }
});

router.get('/:sender_id/:receiver_id', auth, async(req,res)=>{
    const {sender_id, receiver_id}=req.params;

    try {
        const messages= await Message.findAll({
            where:{
                sender_id: sender_id,
                receiver_id: receiver_id,
            },
        });
        res.json(messages);
    } catch (err) {
        res.status(400).json({error:err.message});
        
    };
});

router.get('/recent', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Buscando conversaciones para usuario:', userId);

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: userId },
                    { receiver_id: userId }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'username']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

       
        const conversations = messages.reduce((acc, message) => {
            const otherUserId = message.sender_id === userId 
                ? message.receiver_id 
                : message.sender_id;
            
            const conversationKey = `conversation_${otherUserId}`;
            
            if (!acc[conversationKey]) {
                const otherUser = message.sender_id === userId 
                    ? message.receiver 
                    : message.sender;

                acc[conversationKey] = {
                    conversationId: otherUserId,
                    otherUser: {
                        id: otherUser.id,
                        username: otherUser.username
                    },
                    messages: []
                };
            }
            
            acc[conversationKey].messages.push({
                id: message.id,
                content: message.content,
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                read: message.read,
                createdAt: message.createdAt
            });

            return acc;
        }, {});

        const result = Object.values(conversations);

        result.sort((a, b) => {
            const aLatest = a.messages[0]?.createdAt || new Date(0);
            const bLatest = b.messages[0]?.createdAt || new Date(0);
            return new Date(bLatest) - new Date(aLatest);
        });

        console.log(`Encontradas ${result.length} conversaciones`);
        res.json(result);

    } catch (err) {
        console.error('Error en recent messages:', err);
        res.status(400).json({ error: err.message });
    }
});

router.put('/:messageId/read', auth, async (req, res) => {
    try {
        const message = await Message.findByPk(req.params.messageId);
        if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });
        
        await message.update({ read: true });
        res.json({ message: 'Mensaje marcado como leído' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/file', auth, upload.single('file'), async (req, res) => {
    try {
        const message = await Message.create({
            sender_id: req.user.id,
            receiver_id: req.body.receiver_id,
            content: req.file.path,
            type: 'file'
        });
        res.status(201).json(message);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/search', auth, async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: {
                content: {
                    [Op.like]: `%${req.query.q}%`
                },
                [Op.or]: [
                    { sender_id: req.user.id },
                    { receiver_id: req.user.id }
                ]
            },
            include: [
                { model: User, as: 'sender', attributes: ['username'] },
                { model: User, as: 'receiver', attributes: ['username'] }
            ]
        });
        res.json(messages);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/read-all/:senderId', auth, async (req, res) => {
    try {
        const receiverId = req.user.id; 
        const { senderId } = req.params; 

        await Message.update(
            { read: true },
            {
                where: {
                    sender_id: senderId,
                    receiver_id: receiverId,
                    read: false
                }
            }
        );

        res.json({ message: 'Mensajes marcados como leídos' });
    } catch (err) {
        console.error('Error al marcar mensajes como leídos:', err);
        res.status(400).json({ error: err.message });
    }
});

module.exports=router;