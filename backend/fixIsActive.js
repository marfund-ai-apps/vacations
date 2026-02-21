const db = require('./config/db');

async function run() {
    try {
        const [result] = await db.query(
            'UPDATE users SET is_active = 1 WHERE is_active IS NULL'
        );
        console.log(`Updated ${result.affectedRows} users.`);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
