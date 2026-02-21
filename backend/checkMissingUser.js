const db = require('./config/db');
const fs = require('fs');

async function run() {
    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = "automatizaciones.ia@marfund.org"'
        );
        fs.writeFileSync('output-id1.json', JSON.stringify(rows, null, 2), 'utf-8');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
