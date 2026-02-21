const db = require('./config/db');
const fs = require('fs');

async function run() {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, position, email FROM users WHERE role IN ("manager", "hr_admin", "super_admin") AND is_active = 1'
        );
        fs.writeFileSync('output-utf8.json', JSON.stringify(rows, null, 2), 'utf-8');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
