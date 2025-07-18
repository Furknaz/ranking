// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Dependências
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const http = require('http');
const { Server } = require("socket.io");

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

// Middlewares Globais
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Variável para a conexão com o banco de dados
let db;

// Função para notificar clientes sobre atualizações
const broadcastUpdate = () => {
    io.emit('update');
    console.log('📢 Notificação de atualização enviada para todos os clientes.');
};

// --- FUNÇÃO AUXILIAR ---
// Recalcula e atualiza o total de vendas de um vendedor
const updateSellerTotalSales = async (sellerId) => {
    if (!db) return; // Garante que o db existe
    const result = await db.get('SELECT SUM(value) AS total FROM sales WHERE sellerId = ?', [sellerId]);
    const totalSales = result.total || 0;
    await db.run('UPDATE sellers SET totalSales = ? WHERE id = ?', [totalSales, sellerId]);
};

// --- INICIALIZAÇÃO DO SERVIDOR ---
const startServer = async () => {
    // Conecta ao banco de dados
    db = await open({
        filename: process.env.DB_FILE || './database.sqlite', // Adicionado um fallback
        driver: sqlite3.Database
    });

    // Habilita o suporte a chaves estrangeiras para garantir o ON DELETE CASCADE.
    await db.run('PRAGMA foreign_keys = ON');

    // Garante que as tabelas existam
    await db.exec(`CREATE TABLE IF NOT EXISTS sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT, totalSales REAL DEFAULT 0)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, sellerId INTEGER NOT NULL, value REAL NOT NULL, date TEXT NOT NULL, FOREIGN KEY (sellerId) REFERENCES sellers(id) ON DELETE CASCADE)`);
    console.log('🔗 Banco de dados conectado e tabelas criadas.');
    
    // --- ROTAS DA API (MOVIDO PARA DENTRO DO START) ---
    // CORREÇÃO: As rotas são carregadas e configuradas DEPOIS que a variável 'db' é inicializada.
    const sellersRoutes = require('./routes/sellers');
    const salesRoutes = require('./routes/sales');

    app.use('/api/vendedores', sellersRoutes(db, broadcastUpdate));
    app.use('/api/vendas', salesRoutes(db, updateSellerTotalSales, broadcastUpdate));

    // Rota de ranking principal
    app.get('/api/ranking', async (req, res, next) => {
        try {
            const sortedSellers = await db.all('SELECT * FROM sellers ORDER BY totalSales DESC');
            res.json(sortedSellers);
        } catch (err) {
            next(err);
        }
    });

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