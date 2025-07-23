// backend/routes/sales.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// --- INÍCIO DA ADIÇÃO : Importar o serviço de notificação ---
const notificationService = require('../services/notificationService');
// --- FIM DA ADIÇÃO ---

// A função agora recebe 'db', 'updateSellerTotalSales', e 'broadcastUpdate'
module.exports = (db, updateSellerTotalSales, broadcastUpdate) => {

    // POST /api/vendas
    router.post('/',
        body('sellerId').isInt({ gt: 0 }).withMessage('O ID do vendedor é inválido.'),
        body('value').isFloat({ gt: 0 }).withMessage('O valor da venda deve ser um número maior que zero.'),
        async (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            try {
                const { sellerId, value } = req.body;

                // 1. Verifica se o vendedor existe antes de prosseguir
                const seller = await db.get('SELECT id, name FROM sellers WHERE id = ?', [sellerId]); // ADIÇÃO: Selecionar também o nome
                if (!seller) {
                    return res.status(404).json({ message: 'Vendedor não encontrado.' });
                }

                // 2. Insere o registro da nova venda na tabela 'sales'
                const saleResult = await db.run(
                    'INSERT INTO sales (sellerId, value, date) VALUES (?, ?, ?)',
                    [sellerId, value, new Date().toISOString()]
                );

                // 3. Atualiza o total de vendas do vendedor de forma incremental (mais rápido)
                await db.run('UPDATE sellers SET totalSales = totalSales + ? WHERE id = ?', [value, sellerId]);

                // 4. Notifica todos os clientes conectados sobre a atualização
                broadcastUpdate();

                // --- INÍCIO DA ADIÇÃO (DevRank AI): Enviar notificação de nova venda ---
                // Não aguardamos o resultado da notificação para não bloquear a resposta da API principal
                notificationService.sendNewSaleNotification({
                    sellerName: seller.name,
                    saleValue: value
                });
                // --- FIM DA ADIÇÃO (DevRank AI) ---

                // 5. Busca a venda recém-criada para retornar como resposta
                const newSale = await db.get('SELECT * FROM sales WHERE id = ?', [saleResult.lastID]);
                
                res.status(201).json(newSale);

            } catch (err) {
                next(err);
            }
        }
    );

    // ... (suas outras rotas, como PUT e DELETE, continuam aqui) ...
    // Seu código PUT e DELETE de /api/vendas permanece inalterado.
    // ...
    // NOVO: Rota para editar o valor de uma venda
    router.put('/:id',
        body('value').isFloat({ gt: 0 }).withMessage('O valor da venda deve ser um número maior que zero.'),
        async (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            try {
                const saleId = parseInt(req.params.id);
                const { value: newSaleValue } = req.body;

                // Pega a venda antiga para saber o valor original e o ID do vendedor
                const oldSale = await db.get('SELECT sellerId, value FROM sales WHERE id = ?', [saleId]);
                if (!oldSale) {
                    return res.status(404).json({ message: 'Venda não encontrada.' });
                }
                
                // Calcula a diferença para a atualização incremental
                const valueDifference = newSaleValue - oldSale.value;

                // Inicia uma transação para garantir que ambas as operações funcionem
                await db.run('BEGIN TRANSACTION');
                await db.run('UPDATE sales SET value = ? WHERE id = ?', [newSaleValue, saleId]);
                await db.run('UPDATE sellers SET totalSales = totalSales + ? WHERE id = ?', [valueDifference, oldSale.sellerId]);
                await db.run('COMMIT');
                
                broadcastUpdate(); // Notifica clientes
                
                const updatedSale = await db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
                res.json(updatedSale);
            } catch (err) {
                await db.run('ROLLBACK'); // Desfaz a transação em caso de erro
                next(err);
            }
        }
    );

    // NOVO: Rota para excluir uma venda
    router.delete('/:id', async (req, res, next) => {
        try {
            const saleId = parseInt(req.params.id);

            const sale = await db.get('SELECT sellerId, value FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                return res.status(404).json({ message: 'Venda não encontrada.' });
            }
            
            // Inicia uma transação
            await db.run('BEGIN TRANSACTION');
            await db.run('DELETE FROM sales WHERE id = ?', [saleId]);
            // Atualização incremental (subtrai o valor da venda deletada)
            await db.run('UPDATE sellers SET totalSales = totalSales - ? WHERE id = ?', [sale.value, sale.sellerId]);
            await db.run('COMMIT');

            broadcastUpdate();

            res.status(204).send();
        } catch (err) {
            await db.run('ROLLBACK');
            next(err);
        }
    });

    return router;
};