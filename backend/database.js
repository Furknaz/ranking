// ranking/backend/database.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs'); // Necessário para criar o admin inicial

let db;

const initializeDatabase = async () => {
    if (db) {
        return db; // Retorna a instância existente se já estiver conectada
    }

    // Conecta ao banco de dados
    db = await open({
        filename: process.env.DB_FILE || './database.sqlite',
        driver: sqlite3.Database
    });

    // Habilita o suporte a chaves estrangeiras para garantir o ON DELETE CASCADE.
    await db.run('PRAGMA foreign_keys = ON');

    // Garante que as tabelas existam
    await db.exec(`CREATE TABLE IF NOT EXISTS sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, image TEXT, totalSales REAL DEFAULT 0)`);
    await db.exec(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, sellerId INTEGER NOT NULL, value REAL NOT NULL, date TEXT NOT NULL, FOREIGN KEY (sellerId) REFERENCES sellers(id) ON DELETE CASCADE)`);
    
    // Tabela 'users' atualizada para incluir fullName, email, phone, profilePic
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            fullName TEXT,
            email TEXT,
            phone TEXT,
            profilePic TEXT -- Armazenará a imagem em Base64
        )
    `);

    // CORREÇÃO: Adiciona colunas apenas se não existirem, sem usar IF NOT EXISTS no ALTER TABLE
    const addColumnIfNotExists = async (tableName, columnName, columnType) => {
        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const columnExists = tableInfo.some(col => col.name === columnName);
        if (!columnExists) {
            await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
            console.log(`Adicionada coluna '${columnName}' à tabela '${tableName}'.`);
        }
    };

    await addColumnIfNotExists('users', 'fullName', 'TEXT');
    await addColumnIfNotExists('users', 'email', 'TEXT');
    await addColumnIfNotExists('users', 'phone', 'TEXT');
    await addColumnIfNotExists('users', 'profilePic', 'TEXT');
    await addColumnIfNotExists('users', 'creationDate', 'TEXT'); // INÍCIO DA ADIÇÃO JOTAMAKER AI

    // Adiciona um usuário admin padrão se a tabela estiver vazia, para o primeiro login.
    // A senha é 'admin123'. É crucial trocá-la depois!
    const adminUser = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('admin123', salt);
        // Inserindo com os novos campos
        await db.run('INSERT INTO users (username, password_hash, fullName, email, creationDate) VALUES (?, ?, ?, ?, ?)', ['admin', passwordHash, 'Administrador Padrão', 'admin@example.com', new Date().toISOString()]);
        console.log('🔑 Usuário "admin" padrão criado com a senha "admin123" e dados de perfil.');
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sellerId INTEGER NOT NULL,
            description TEXT,
            target_value REAL NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT DEFAULT 'pending', 
            FOREIGN KEY (sellerId) REFERENCES sellers(id) ON DELETE CASCADE
        )
    `);
    
    console.log('🔗 Banco de dados conectado e tabelas criadas/atualizadas.');
    return db;
};

const getDb = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
};

module.exports = { initializeDatabase, getDb };