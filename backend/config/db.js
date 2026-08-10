const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    // Devolver columnas DATE como 'YYYY-MM-DD' (string) para evitar corrimientos de
    // zona horaria (ej. fecha_ingreso). No afecta TIMESTAMP/DATETIME.
    dateStrings: ['DATE']
});

module.exports = pool;
