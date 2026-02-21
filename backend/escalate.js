const db = require('./config/db');

async function run() {
    try {
        await db.query('UPDATE users SET role = "super_admin" WHERE email = "automatizaciones.ia@marfund.org"');
        console.log("Updated Automatizaciones IA to super_admin");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
