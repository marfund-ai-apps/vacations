const db = require('./config/db');

async function run() {
    try {
        const [rows] = await db.query('SELECT id, full_name, email, role, manager_id FROM users WHERE email IN ("pcabrera@marfund.org", "automatizaciones.ia@marfund.org")');
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
