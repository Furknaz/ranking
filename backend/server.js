// ranking/backend/server.js
// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Dependências
const express = require('express');
const cors = require('cors');
// REMOÇÃO: sqlite3 e open não são mais necessários aqui
// const sqlite3 = require('sqlite3');
// const { open } = require('sqlite');
const http = require('http');
const { Server } = require("socket.io");
const webpush = require('web-push');

// INÍCIO DA ADIÇÃO JOTAMAKER AI: Módulo para gerar arquivos Excel (XLSX)
const ExcelJS = require('exceljs');
// FIM DA ADIÇÃO JOTAMAKER AI

// ### INÍCIO DA ADIÇÃO: MÓDULOS DE AUTENTICAÇÃO ###
const session = require('express-session');
const bcrypt = require('bcryptjs');
// ### FIM DA ADIÇÃO ###

// INÍCIO DA ADIÇÃO: Módulo de conexão com o banco de dados
const { initializeDatabase, getDb } = require('./database');
// FIM DA ADIÇÃO

// Configuração do App
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// --- INÍCIO DA CORREÇÃO ---
// Middlewares Globais
// Substituímos o app.use(cors()) por uma configuração mais explícita
// para garantir que as conexões de diferentes origens (como o servidor Python) funcionem.
const corsOptions = {
  origin: '*', // Permite requisições de qualquer origem. Seguro para desenvolvimento.
  methods: ["GET", "POST", "PUT", "DELETE"],
};
app.use(cors(corsOptions));
// --- FIM DA CORREÇÃO ---

app.use(express.json({ limit: '10mb' }));
// ### INÍCIO DA REMOÇÃO: MIDDLEWARE express.text() (DevRank AI) ###
// app.use(express.text({ limit: '10mb' })); // Removido, pois não há mais rota de importação de texto puro
// ### FIM DA REMOÇÃO: MIDDLEWARE express.text() (DevRank AI) ###

// ### INÍCIO DA ADIÇÃO: CONFIGURAÇÃO DA SESSÃO ###
// Configura o middleware de sessão. A 'secret' deve ser uma string longa e aleatória
// e, idealmente, vir de suas variáveis de ambiente (process.env.SESSION_SECRET).
app.use(session({
    secret: 'uma-chave-secreta-muito-forte-e-dificil-de-adivinhar', // IMPORTANTE: Mude isso e coloque no .env
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Em produção, com HTTPS, mude para 'true'
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // Expira em 24 horas
    }
}));
// ### FIM DA ADIÇÃO ###

// Variável para a conexão com o banco de dados
let db; // Será atribuído após a inicialização

// Função para notificar clientes sobre atualizações
const broadcastUpdate = () => {
    io.emit('update');
    console.log('📢 Notificação de atualização enviada para todos os clientes.');
};

// --- FUNÇÃO AUXILIAR ---
// Recalcula e atualiza o total de vendas de um vendedor
const updateSellerTotalSales = async (sellerId) => {
    if (!db) { // Garante que o db existe
        db = getDb(); // Obtém a instância do banco de dados inicializada
    }
    const result = await db.get('SELECT SUM(value) AS total FROM sales WHERE sellerId = ?', [sellerId]);
    const totalSales = result.total || 0;
    await db.run('UPDATE sellers SET totalSales = ? WHERE id = ?', [totalSales, sellerId]);
};

// ### INÍCIO DA ADIÇÃO: MIDDLEWARE DE AUTENTICAÇÃO ###
// Este middleware irá verificar se o usuário está logado antes de permitir o acesso
// a qualquer rota que o utilize.
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next(); // Se o usuário está na sessão, continue
    } else {
        // Se não estiver logado, retorna um erro 401 (Não Autorizado)
        res.status(401).json({ message: 'Acesso não autorizado. Por favor, faça o login.' });
    }
};
// ### FIM DA ADIÇÃO ###


// --- INICIALIZAÇÃO DO SERVIDOR ---
const startServer = async () => {
    // INÍCIO DA ALTERAÇÃO: Inicializa o banco de dados de forma centralizada
    db = await initializeDatabase();
    // FIM DA ALTERAÇÃO

    // REMOÇÃO: Lógica de criação de tabelas e inserção do admin movida para database.js
    // console.log('🔗 Banco de dados conectado e tabelas criadas/atualizadas.');
    
    // --- ROTAS DA API ---
    const sellersRoutes = require('./routes/sellers');
    const salesRoutes = require('./routes/sales');
    const authRoutes = require('./routes/auth'); // Já existe

    // Rotas de Autenticação (não protegidas, pois são a porta de entrada)
    app.use('/api/auth', authRoutes(db, bcrypt));

    // Rotas protegidas por autenticação
    app.use('/api/vendedores', isAuthenticated, sellersRoutes(db, broadcastUpdate));
    app.use('/api/vendas', isAuthenticated, salesRoutes(db, updateSellerTotalSales, broadcastUpdate));

    // INÍCIO DA ADIÇÃO JOTAMAKER AI: Rota para obter métricas do Dashboard (protegida) com mais dados
    app.get('/api/dashboard-metrics', isAuthenticated, async (req, res, next) => {
        try {
            // Usa a instância 'db' obtida da centralização
            const totalSellersResult = await db.get('SELECT COUNT(id) as count FROM sellers');
            const totalSalesResult = await db.get('SELECT COALESCE(SUM(totalSales), 0) as total FROM sellers'); 
            
            // INÍCIO DA CORREÇÃO JOTAMAKER AI: Lógica para 'Vendas Cadastradas'
            // Alterado para contar o número total de vendas na tabela 'sales'
            const totalRegisteredSalesResult = await db.get('SELECT COUNT(id) as count FROM sales');
            // FIM DA CORREÇÃO JOTAMAKER AI
            
            // Lógica para 'Atividades Recentes' (simulado: últimas 5 vendas)
            const recentActivities = await db.all(`
                SELECT 
                    s.name AS sellerName, 
                    sa.value AS saleValue, 
                    sa.date AS saleDate
                FROM sales sa
                JOIN sellers s ON sa.sellerId = s.id
                ORDER BY sa.date DESC
                LIMIT 5
            `);

            // Mapeia para o formato esperado pelo frontend em profile.js
            const formattedActivities = recentActivities.map(activity => ({
                name: `Venda de ${activity.sellerName}`,
                description: `Valor: ${activity.saleValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                status: 'Completed', // Simulado como 'Completed' para vendas
                dateTime: new Date(activity.saleDate).toLocaleString('pt-BR')
            }));

            res.json({
                totalSellers: totalSellersResult.count,
                totalSales: totalSalesResult.total,
                // INÍCIO DA CORREÇÃO JOTAMAKER AI: Passando a nova contagem de vendas registradas
                totalRegisteredSales: totalRegisteredSalesResult.count,
                // FIM DA CORREÇÃO JOTAMAKER AI
                recentActivities: formattedActivities
            });
        } catch (err) {
            next(err);
        }
    });
    // FIM DA ADIÇÃO JOTAMAKER AI: Rota para obter métricas do Dashboard (protegida)

    // Rota de ranking principal, agora com suporte a filtros de período
    // Esta rota permanece pública para ser acessível pelo modo TV sem login.
    app.get('/api/ranking', async (req, res, next) => {
        try {
            // Usa a instância 'db' obtida da centralização
            const { period } = req.query; // 'today', 'week', 'month', 'all'
            let dateFilter = '';
            const params = [];

            const now = new Date();
            // Ajuste para garantir que now.getDay() retorne o dia correto da semana (0=domingo, 6=sábado)
            // e para que a data inicial da semana seja correta.
            if (period === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(today);
            } else if (period === 'week') {
                const dayOfWeek = now.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
                const diff = now.getDate() - dayOfWeek; // Adjust to Sunday (start of week)
                const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(firstDayOfWeek);
            } else if (period === 'month') {
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(firstDayOfMonth);
            }

            const query = `
                SELECT
                    s.id,
                    s.name,
                    s.image,
                    COALESCE(SUM(sa.value), 0) as totalSales
                FROM
                    sellers s
                LEFT JOIN
                    sales sa ON s.id = sa.sellerId ${dateFilter}
                GROUP BY
                    s.id
                ORDER BY
                    totalSales DESC
            `;

            const sortedSellers = await db.all(query, params);
            res.json(sortedSellers);
        } catch (err) {
            next(err);
        }
    });

    // INÍCIO DA ADIÇÃO JOTAMAKER AI: Rota para Exportação de Ranking em XLSX (Excel)
    app.get('/api/ranking/export-xlsx', isAuthenticated, async (req, res, next) => {
        try {
            // Usa a instância 'db' obtida da centralização
            const { period } = req.query;
            let dateFilter = '';
            const params = [];

            const now = new Date();
            if (period === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(today);
            } else if (period === 'week') {
                const dayOfWeek = now.getDay(); 
                const diff = now.getDate() - dayOfWeek; 
                const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(firstDayOfWeek);
            } else if (period === 'month') {
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                dateFilter = 'AND sa.date >= ?';
                params.push(firstDayOfMonth);
            }

            const query = `
                SELECT
                    s.name,
                    COALESCE(SUM(sa.value), 0) as totalSales
                FROM
                    sellers s
                LEFT JOIN
                    sales sa ON s.id = sa.sellerId ${dateFilter}
                GROUP BY
                    s.id
                ORDER BY
                    totalSales DESC
            `;

            const sortedSellers = await db.all(query, params);

            // Geração do XLSX
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Ranking de Vendas');

            // Definir cabeçalhos
            worksheet.columns = [
                { header: 'Posição', key: 'rank', width: 10 },
                { header: 'Vendedor', key: 'name', width: 30 },
                { header: 'Total Vendas', key: 'totalSales', width: 20, style: { numFmt: '"R$"#,##0.00' } } // Formato monetário
            ];

            // Adicionar dados
            sortedSellers.forEach((seller, index) => {
                const rank = index + 1;
                worksheet.addRow({
                    rank: rank,
                    name: seller.name,
                    totalSales: seller.totalSales
                });
            });

            // Configurar a resposta para download do arquivo XLSX
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="ranking_vendas_${period}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end(); // Finaliza a resposta

        } catch (err) {
            console.error('Erro ao exportar ranking para XLSX:', err);
            next(err);
        }
    });
    // FIM DA ADIÇÃO JOTAMAKER AI: Rota para Exportação de Ranking em XLSX (Excel)

    // --- MIDDLEWARE DE TRATAMENTO DE ERROS ---
    app.use((err, req, res, next) => {
        console.error('Um erro ocorreu:', err.stack);
        res.status(500).json({
            message: 'Ocorreu um erro inesperado no servidor.',
            error: err.message
        });
    });

    // Lógica de conexão do Socket.IO
    io.on('connection', (socket) => {
        console.log('✅ Um cliente se conectou:', socket.id);
        socket.on('disconnect', () => {
            console.log('❌ Um cliente se desconectou:', socket.id);
        });
    });

    // Inicia o servidor HTTP com Socket.IO
    server.listen(PORT, () => {
        console.log(`🚀 Servidor backend rodando em http://localhost:${PORT}`);
    });
};

startServer();