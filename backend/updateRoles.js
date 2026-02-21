const db = require('./config/db');

async function run() {
    try {
        await db.query(`UPDATE users SET role = 'super_admin' WHERE email IN ('pcabrera@marfund.org', 'automatizaciones.ia@marfund.org')`);
        console.log("Updated roles successfully.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
