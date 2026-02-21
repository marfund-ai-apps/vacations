CREATE DATABASE IF NOT EXISTS vacation_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vacation_system;

-- Tabla de usuarios (autenticados con Google OAuth)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    employee_number VARCHAR(50),
    position VARCHAR(255),                    -- Cargo
    role ENUM('employee', 'manager', 'hr_admin', 'super_admin') DEFAULT 'employee',
    manager_id INT NULL,                      -- FK al jefe inmediato
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabla principal de solicitudes
CREATE TABLE vacation_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(20) UNIQUE NOT NULL,  -- Número correlativo: VAC-2024-0001
    employee_id INT NOT NULL,
    request_type ENUM('vacation', 'permission', 'justified_absence') NOT NULL,
    reason TEXT,
    notes TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    manager_id INT NOT NULL,                     -- Jefe al momento de solicitar
    manager_comments TEXT,                       -- Comentarios del jefe al aprobar/denegar
    manager_decision_date TIMESTAMP NULL,
    notified_employee BOOLEAN DEFAULT FALSE,
    notified_manager BOOLEAN DEFAULT FALSE,
    notified_hr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(id),
    FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Tabla de rangos de fechas por solicitud (puede tener múltiples rangos)
CREATE TABLE request_date_ranges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    business_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id) ON DELETE CASCADE
);

-- Tabla de historial / auditoría
CREATE TABLE request_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,              -- 'created', 'approved', 'rejected', 'email_sent', etc.
    performed_by INT NULL,                     -- Usuario que realizó la acción
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id),
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Tabla de tokens para aprobación por email (link seguro enviado al jefe)
CREATE TABLE approval_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    action ENUM('approve', 'reject') NULL,     -- Se llena cuando el jefe hace clic
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES vacation_requests(id)
);

-- Vista para reporte de días por empleado por año
CREATE OR REPLACE VIEW v_employee_days_summary AS
SELECT 
    u.id AS employee_id,
    u.full_name,
    u.email,
    u.employee_number,
    u.position,
    vr.request_type,
    vr.status,
    YEAR(vr.created_at) AS fiscal_year,
    SUM(rdr.business_days) AS total_business_days,
    COUNT(DISTINCT vr.id) AS total_requests
FROM users u
LEFT JOIN vacation_requests vr ON u.id = vr.employee_id AND vr.status = 'approved'
LEFT JOIN request_date_ranges rdr ON vr.id = rdr.request_id
GROUP BY u.id, u.full_name, u.email, u.employee_number, u.position, 
         vr.request_type, vr.status, YEAR(vr.created_at);

-- Índices de rendimiento
CREATE INDEX idx_vacation_requests_employee ON vacation_requests(employee_id);
CREATE INDEX idx_vacation_requests_manager ON vacation_requests(manager_id);
CREATE INDEX idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX idx_vacation_requests_year ON vacation_requests(created_at);
CREATE INDEX idx_request_date_ranges_request ON request_date_ranges(request_id);
