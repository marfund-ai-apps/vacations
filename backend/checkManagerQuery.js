const db = require('./config/db');

async function run() {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, position, email FROM users WHERE role IN ("manager", "hr_admin", "super_admin") AND is_active = 1'
        );
        console.log(JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
