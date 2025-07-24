// routes/sellers.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// A função exportada agora recebe 'db' e 'broadcastUpdate'
module.exports = (db, broadcastUpdate) => {
    
    // Validador customizado para Data URL de imagem
    const isImageDataUrl = () => {
        return body('image').optional({ checkFalsy: true }).matches(/^data:image\/[a-zA-Z]+;base64,/).withMessage('O formato da imagem é inválido. Deve ser uma Data URL.');
    };

    // POST /api/vendedores
    router.post('/',
        body('name').trim().notEmpty().withMessage('O nome é obrigatório.').isLength({ min: 3 }).withMessage('O nome precisa ter no mínimo 3 caracteres.'),
        isImageDataUrl(), // CORREÇÃO: Usando o validador customizado
        async (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            try {
                const { name, image } = req.body;
                const result = await db.run('INSERT INTO sellers (name, image, totalSales) VALUES (?, ?, 0)', [name, image || null]);
                const newSeller = await db.get('SELECT * FROM sellers WHERE id = ?', [result.lastID]);
                broadcastUpdate();
                res.status(201).json(newSeller);
            } catch (err) {
                next(err);
            }
        }
    );

    // PUT /api/vendedores/:id
    router.put('/:id',
        body('name').trim().notEmpty().withMessage('O nome é obrigatório.').isLength({ min: 3 }).withMessage('O nome precisa ter no mínimo 3 caracteres.'),
        isImageDataUrl(), // CORREÇÃO: Usando o validador customizado
        async (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            try {
                const sellerId = parseInt(req.params.id);
                const { name, image } = req.body;
                const result = await db.run('UPDATE sellers SET name = ?, image = ? WHERE id = ?', [name, image || null, sellerId]);
                if (result.changes === 0) return res.status(404).json({ message: 'Vendedor não encontrado.' });
                const updatedSeller = await db.get('SELECT * FROM sellers WHERE id = ?', [sellerId]);
                broadcastUpdate();
                res.json(updatedSeller);
            } catch (err) {
                next(err);
            }
        }
    );

    // DELETE /api/vendedores/:id
    router.delete('/:id', async (req, res, next) => {
        try {
            const sellerId = parseInt(req.params.id);
            const result = await db.run('DELETE FROM sellers WHERE id = ?', [sellerId]);
            if (result.changes === 0) return res.status(404).json({ message: 'Vendedor não encontrado.' });
            broadcastUpdate();
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    // GET /api/vendedores/:id/vendas
    router.get('/:id/vendas', async (req, res, next) => {
        try {
            const sellerId = parseInt(req.params.id);
            const sellerSales = await db.all('SELECT * FROM sales WHERE sellerId = ? ORDER BY date DESC', [sellerId]);
            res.json(sellerSales);
        } catch (err) {
            next(err);
        }
    });

    return router;
};