/**
 * @swagger
 * tags:
 *   name: Chats
 *   description: API endpoints for managing chat conversations
 */

/**
 * @swagger
 * /api/chats:
 *   get:
 *     summary: Get all chats
 *     tags: [Chats]
 *     responses:
 *       200:
 *         description: List of all chats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Server error
 *
 *   post:
 *     summary: Create a new chat
 *     tags: [Chats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: integer
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat created successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/chats/{id}:
 *   get:
 *     summary: Get a specific chat
 *     tags: [Chats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chat details
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Server error
 *
 *   put:
 *     summary: Update a chat
 *     tags: [Chats]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat updated successfully
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Server error
 */