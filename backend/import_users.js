const xlsx = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function importData() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
    });

    try {
        console.log("Checking and updating schema...");

        // Check if new columns exist
        const [columns] = await connection.query(`SHOW COLUMNS FROM users`);
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('base_vacation_days')) {
            await connection.query(`ALTER TABLE users ADD COLUMN base_vacation_days INT DEFAULT 15`);
            console.log("Added column base_vacation_days");
        }

        // We probably don't need assistant_email since the column in the sheet actually contains the employee's own email, 
        // but we'll add it anyway just in case they decide to use it later as stated in the prompt.
        if (!colNames.includes('assistant_email')) {
            await connection.query(`ALTER TABLE users ADD COLUMN assistant_email VARCHAR(255) NULL`);
            console.log("Added column assistant_email");
        }

        console.log("Reading Excel file...");
        const workbook = xlsx.readFile('../Datos para IA vacaciones - v2.xlsx');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

        console.log(`Found ${data.length} records. Processing Pass 1: Inserting all employees...`);

        for (const row of data) {
            // Mapping based on the exact headers in the file.
            // "No.", "Nombre Colaborador", "No Empleado", "Puesto", "Dias vacacion", "Correo Asistente", "Nombre del Jefe Inmediato", "Correo Jefe inmediato"

            // Note: Data analysis shows "Correo Asistente" is actually the employee's email.
            const fullName = row['Nombre Colaborador'];
            const employeeNumber = row['No Empleado']?.toString() || null;
            const position = row['Puesto'];
            const baseVacationDays = row['Dias vacacion'] || row['Días vacaciones'] || 15;

            // Getting the email (sometimes header varies slightly)
            const email = row['Correo Asistente'] || row['Correo Institucional'] || null;

            if (!email || !fullName) {
                console.log(`Skipping invalid row: ${JSON.stringify(row)}`);
                continue;
            }

            // check if user exists
            const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);

            if (existing.length === 0) {
                // Determine a fake google_id since it's required and unique
                const fakeGoogleId = 'disabled_' + email;
                await connection.query(`
                    INSERT INTO users (email, full_name, employee_number, position, base_vacation_days, google_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [email, fullName, employeeNumber, position, baseVacationDays, fakeGoogleId]);
                console.log(`Inserted user: ${email}`);
            } else {
                await connection.query(`
                    UPDATE users SET full_name = ?, employee_number = ?, position = ?, base_vacation_days = ?
                    WHERE email = ?
                `, [fullName, employeeNumber, position, baseVacationDays, email]);
                console.log(`Updated user: ${email}`);
            }
        }

        console.log("Pass 2: Linking Managers...");
        for (const row of data) {
            const email = row['Correo Asistente'] || row['Correo Institucional'] || null;
            const managerEmail = row['Correo Jefe inmediato'];

            if (!email || !managerEmail) continue;

            // Find manager ID
            const [managerRows] = await connection.query('SELECT id FROM users WHERE email = ?', [managerEmail]);
            if (managerRows.length > 0) {
                const managerId = managerRows[0].id;
                await connection.query('UPDATE users SET manager_id = ? WHERE email = ?', [managerId, email]);
                // Set the manager's role to 'manager' if they are currently 'employee'
                await connection.query('UPDATE users SET role = "manager" WHERE id = ? AND role = "employee"', [managerId]);
                console.log(`Linked ${email} -> Manager ${managerEmail}`);
            } else {
                console.log(`Manager ${managerEmail} not found for user ${email}`);
            }
        }

        console.log("Import completed successfully!");

    } catch (e) {
        console.error("Error during import:", e);
    } finally {
        await connection.end();
    }
}

importData();
