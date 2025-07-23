// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // Importado para validação

module.exports = (db, bcrypt) => {

    // Rota de Cadastro: POST /api/auth/register
    router.post('/register',
        body('username').trim().notEmpty().withMessage('O usuário é obrigatório.'),
        body('password').isLength({ min: 6 }).withMessage('A senha deve ter no mínimo 6 caracteres.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            const { username, password } = req.body;

            try {
                // Verifica se o usuário já existe
                const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);
                if (existingUser) {
                    return res.status(409).json({ message: 'Este nome de usuário já está em uso.' });
                }

                // Cria o hash da senha
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(password, salt);

                // Insere o novo usuário no banco de dados com campos iniciais vazios para perfil
                // INÍCIO DA ADIÇÃO JOTAMAKER AI: Adiciona creationDate na inserção de novos usuários
                await db.run('INSERT INTO users (username, password_hash, fullName, email, phone, profilePic, creationDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [username, passwordHash, '', '', '', null, new Date().toISOString()]); // Valores iniciais vazios/nulos
                // FIM DA ADIÇÃO JOTAMAKER AI
                
                res.status(201).json({ message: 'Usuário criado com sucesso!' });

            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Erro no servidor durante o cadastro.' });
            }
        }
    );

    // Rota de Login: POST /api/auth/login
    router.post('/login',
        body('username').trim().notEmpty().withMessage('O usuário é obrigatório.'),
        body('password').notEmpty().withMessage('A senha é obrigatória.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            const { username, password } = req.body;

            try {
                const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
                if (!user) {
                    return res.status(401).json({ message: 'Credenciais inválidas.' });
                }

                const isMatch = await bcrypt.compare(password, user.password_hash);
                if (!isMatch) {
                    return res.status(401).json({ message: 'Credenciais inválidas.' });
                }

                req.session.userId = user.id;
                req.session.username = user.username;
                // Adiciona informações adicionais do perfil à sessão para fácil acesso no frontend
                req.session.fullName = user.fullName;
                req.session.email = user.email;
                req.session.phone = user.phone;
                req.session.profilePic = user.profilePic;
                
                res.status(200).json({ 
                    message: 'Login realizado com sucesso!', 
                    user: { 
                        id: user.id, 
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email,
                        phone: user.phone,
                        profilePic: user.profilePic
                    } 
                });

            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Erro no servidor durante o login.' });
            }
        }
    );

    // Rota de Logout: POST /api/auth/logout
    router.post('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ message: 'Não foi possível fazer logout.' });
            }
            res.clearCookie('connect.sid'); 
            res.status(200).json({ message: 'Logout realizado com sucesso.' });
        });
    });

    // Rota de Status: GET /api/auth/status
    // Agora retorna mais dados do perfil para o frontend
    router.get('/status', async (req, res) => {
        if (req.session.userId) {
            // Busca o usuário do banco de dados para garantir os dados mais recentes
            const user = await db.get('SELECT id, username, fullName, email, phone, profilePic FROM users WHERE id = ?', [req.session.userId]);
            if (user) {
                res.status(200).json({
                    isLoggedIn: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email,
                        phone: user.phone,
                        profilePic: user.profilePic
                    }
                });
            } else {
                // Se o usuário não for encontrado no DB, limpa a sessão
                req.session.destroy(() => {
                    res.clearCookie('connect.sid');
                    res.status(401).json({ isLoggedIn: false, message: 'Sessão inválida. Por favor, faça login novamente.' });
                });
            }
        } else {
            res.status(200).json({ isLoggedIn: false });
        }
    });

    // Rota para Alterar Senha: POST /api/auth/change-password
    router.post('/change-password',
        body('currentPassword').notEmpty().withMessage('A senha atual é obrigatória.'),
        body('newPassword').isLength({ min: 6 }).withMessage('A nova senha deve ter no mínimo 6 caracteres.'),
        body('confirmNewPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('As senhas de confirmação não coincidem.');
            }
            return true;
        }),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            if (!req.session.userId) {
                return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
            }

            const { currentPassword, newPassword } = req.body;

            try {
                const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);

                if (!user) {
                    return res.status(404).json({ message: 'Usuário não encontrado.' });
                }

                const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
                if (!isMatch) {
                    return res.status(401).json({ message: 'Senha atual incorreta.' });
                }

                const salt = await bcrypt.genSalt(10);
                const newPasswordHash = await bcrypt.hash(newPassword, salt);

                await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.session.userId]);

                res.status(200).json({ message: 'Senha alterada com sucesso!' });

            } catch (err) {
                console.error('Erro ao alterar senha:', err);
                res.status(500).json({ message: 'Erro no servidor ao tentar alterar a senha.' });
            }
        }
    );

    // NOVO: Rota para Atualizar Perfil: PUT /api/auth/update-profile
    router.put('/update-profile',
        body('fullName').optional({ checkFalsy: true }).trim().isLength({ min: 3 }).withMessage('O nome completo deve ter no mínimo 3 caracteres.'),
        body('email').optional({ checkFalsy: true }).isEmail().withMessage('Formato de e-mail inválido.'),
        body('phone').optional({ checkFalsy: true }).matches(/^\+?\d{10,15}$/).withMessage('Formato de telefone inválido.'),
        body('profilePic').optional({ checkFalsy: true }).matches(/^data:image\/[a-zA-Z]+;base64,/).withMessage('Formato de imagem de perfil inválido.'),
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ message: errors.array()[0].msg });
            }

            if (!req.session.userId) {
                return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
            }

            const { fullName, email, phone, profilePic } = req.body;

            try {
                // Atualiza apenas os campos fornecidos
                const updateFields = [];
                const updateParams = [];

                if (fullName !== undefined) {
                    updateFields.push('fullName = ?');
                    updateParams.push(fullName);
                }
                if (email !== undefined) {
                    updateFields.push('email = ?');
                    updateParams.push(email);
                }
                if (phone !== undefined) {
                    updateFields.push('phone = ?');
                    updateParams.push(phone);
                }
                if (profilePic !== undefined) {
                    updateFields.push('profilePic = ?');
                    updateParams.push(profilePic);
                }

                if (updateFields.length === 0) {
                    return res.status(400).json({ message: 'Nenhum dado para atualizar fornecido.' });
                }

                updateParams.push(req.session.userId); // Adiciona o ID do usuário como último parâmetro

                const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
                await db.run(query, updateParams);

                // Atualiza a sessão com os novos dados
                req.session.fullName = fullName !== undefined ? fullName : req.session.fullName;
                req.session.email = email !== undefined ? email : req.session.email;
                req.session.phone = phone !== undefined ? phone : req.session.phone;
                req.session.profilePic = profilePic !== undefined ? profilePic : req.session.profilePic;

                res.status(200).json({ message: 'Perfil atualizado com sucesso!' });

            } catch (err) {
                console.error('Erro ao atualizar perfil:', err);
                res.status(500).json({ message: 'Erro no servidor ao tentar atualizar o perfil.' });
            }
        }
    );

    // NOVO: Rota para Excluir Conta: DELETE /api/auth/delete-account
    router.delete('/delete-account', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
        }

        try {
            // Inicia uma transação para garantir que tudo seja excluído ou nada seja
            await db.run('BEGIN TRANSACTION');

            // Opcional: Excluir dados relacionados ao usuário em outras tabelas
            // Por exemplo, se houver vendas associadas a um 'userId' direto, ou metas.
            // No seu esquema atual, 'sales' e 'goals' estão ligadas a 'sellers',
            // e 'users' é para administradores. Se um admin fosse um 'seller',
            // a lógica seria mais complexa. Assumindo que o admin não é um seller direto.

            // Exclui o usuário da tabela 'users'
            await db.run('DELETE FROM users WHERE id = ?', [req.session.userId]);

            await db.run('COMMIT'); // Confirma a transação

            // Destrói a sessão após a exclusão bem-sucedida
            req.session.destroy(err => {
                if (err) {
                    console.error('Erro ao destruir sessão após exclusão de conta:', err);
                    // Não retorna erro aqui, pois a conta já foi excluída do DB
                }
                res.clearCookie('connect.sid'); 
                res.status(200).json({ message: 'Conta excluída com sucesso.' });
            });

        } catch (err) {
            await db.run('ROLLBACK'); // Desfaz a transação em caso de erro
            console.error('Erro ao excluir conta:', err);
            res.status(500).json({ message: 'Erro no servidor ao tentar excluir a conta.' });
        }
    });

    return router;
};