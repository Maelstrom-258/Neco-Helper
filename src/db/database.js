const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.dirname(__filename);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite com sucesso.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        
        db.run(`
            CREATE TABLE IF NOT EXISTS ticket_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                channel_id TEXT,
                message_id TEXT,
                name TEXT,
                channel_name_format TEXT DEFAULT 'dd-timecreated-username',
                initial_message TEXT,
                final_message TEXT,
                permissions TEXT DEFAULT '[]',
                cooldown INTEGER DEFAULT 60,
                feedback_enabled BOOLEAN DEFAULT 0,
                hide_from_users BOOLEAN DEFAULT 0,
                lifetime INTEGER DEFAULT 3600,
                user_can_close BOOLEAN DEFAULT 1
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                channel_id TEXT,
                panel_id INTEGER,
                creator_id TEXT,
                status TEXT DEFAULT 'open',
                created_at INTEGER,
                closed_at INTEGER,
                messages_count INTEGER DEFAULT 0
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS embeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                name TEXT,
                data TEXT,
                creator_id TEXT
            )
        `);
    });
}

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const allQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = {
    db,
    runQuery,
    getQuery,
    allQuery
};
