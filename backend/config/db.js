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
    // Interpretar los TIMESTAMP/DATETIME de la BD como UTC. mysql2 por defecto usa
    // 'local' (zona del contenedor Node); si el contenedor corre en hora Guatemala,
    // malinterpreta los timestamps guardados en UTC y los desfasa +6h (ej. created_at
    // se veía a las 9pm en lugar de la tarde). Con 'Z' se crean instantes UTC correctos
    // y el frontend (dateUtils) los muestra en America/Guatemala.
    timezone: 'Z',
    // Devolver columnas DATE como 'YYYY-MM-DD' (string) para evitar corrimientos de
    // zona horaria (ej. fecha_ingreso). No afecta TIMESTAMP/DATETIME.
    dateStrings: ['DATE']
});

module.exports = pool;
