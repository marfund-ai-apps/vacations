const db = require('./config/db');
const fs = require('fs');

async function run() {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', ['webmaster@marfund.org']);
        fs.writeFileSync('webmaster.json', JSON.stringify(rows, null, 2), 'utf8');
        console.log('Saved to webmaster.json');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
