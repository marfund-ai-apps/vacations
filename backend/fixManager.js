const db = require('./config/db');

async function run() {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = "automatizaciones.ia@marfund.org"');
        console.log("Current user:", rows[0]);
        // Set manager_id to 8 (Directora General) just so the UI shows it as disabled
        await db.query('UPDATE users SET manager_id = 8 WHERE email = "automatizaciones.ia@marfund.org"');
        console.log("Assigned manager_id 8 to automatizaciones.ia@marfund.org");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
