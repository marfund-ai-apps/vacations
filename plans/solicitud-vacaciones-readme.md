# Sistema de Gestión de Vacaciones MAR Fund - Resumen Ejecutivo y Técnico

Este documento sirve como un resumen detallado del progreso, arquitectura, decisiones de diseño y el estado actual del proyecto del Sistema de Gestión de Vacaciones para MAR Fund. Está diseñado para facilitar la transición a otros desarrolladores o modelos de IA.

## 1. Descripción General del Proyecto

El objetivo es desarrollar una plataforma web para automatizar el proceso de solicitud, aprobación, y seguimiento de vacaciones de los empleados de MAR Fund. La aplicación reemplaza los procesos manuales ofreciendo una interfaz gráfica moderna, cálculos automáticos de días disponibles, notificaciones por correo electrónico y flujos de aprobación multinivel.

## 2. Pila Tecnológica (Tech Stack)

*   **Frontend:** React 18, Vite, Tailwind CSS v4, React Router v6, Axios, react-hot-toast.
*   **Backend:** Node.js, Express.js.
*   **Base de Datos:** MySQL (Alojada en un servidor VPS remoto vía Easypanel).
*   **Autenticación:** Google OAuth 2.0 (Passport.js), manejo de sesiones con `express-session` y almacenamiento de sesiones en MySQL (`express-mysql-session`).
*   **Automatización / Flujos de Trabajo:** n8n (para leer datos de empleados desde Google Sheets y enviar correos electrónicos vía Gmail).
*   **Infraestructura:** Easypanel (para despliegue), VPS en Hostinger.

## 3. Estado Actual del Desarrollo (Fases Completadas)

### Fase 1: Configuración del Proyecto y Base de Datos (Completada)
*   Diseño y creación del esquema de la base de datos MySQL (Tablas: `users`, `vacation_requests`, `request_history`, `request_date_ranges`, `approval_tokens`, vista `v_employee_days_summary`).
*   Configuración inicial del repositorio monorepo con carpetas `frontend/` y `backend/`.
*   Creación de scripts SQL (`schema.sql` y `data.sql`).

### Fase 2: Configuración del Backend y Autenticación Principal (Completada)
*   Implementación de Express server con middlewares de seguridad (Helmet, CORS).
*   Conexión a la base de datos MySQL usando connection pools (`mysql2/promise`).
*   Integración exitosa de Google OAuth 2.0. El sistema auto-registra a usuarios con correos de `@marfund.org` en su primer login.
*   Configuración de inicio de sesión persistente usando cookies de sesión almacenadas en base de datos.
*   Creación de todos los endpoints REST API para (Requests, Users, Reports, Auth).
*   Middlewares de autorización basados en roles (Admin, HR, Manager, Employee).

### Fase 3: Integración y Automatización con n8n (Completada)
*   Desarrollo de dos flujos de trabajo en n8n:
    1.  `workflow_nueva_solicitud.json`: Se dispara cuando un empleado envía una solicitud. Busca en Google Sheets al jefe inmediato y envía un correo (Gmail) con un enlace mágico para aprobar/rechazar.
    2.  `workflow_decision_aprobacion.json`: Se dispara cuando el flujo de autorización se completa (aprobado o rechazado). Notifica al empleado y, si está aprobado, notifica a RRHH.
*   Los webhooks de n8n están conectados a los Controladores (Controllers) del backend.

### Fase 4: Frontend Base y Configuración Inicial (Completada)
*   Setup inicial de React 18 con Vite.
*   Integración de TailwindCSS v4 y configuración de variables/tema principal (Colores institucionales).
*   Implementación de un cliente Axios (`api.js`) configurado con `withCredentials: true` e interceptores para manejo de errores de autenticación.
*   Creación del `AuthContext` para el estado global de sesión de usuario y cierres de sesión controlados.
*   Implementación de Componentes de Enrutamiento (`App.jsx`, `ProtectedRoute.jsx`) para proteger rutas basados en Roles y Sesión.

### Fase 5: Desarrollo de Funciones Core de Frontend y Panel de Control (Completada)
*   **Gestión de Solicitudes:**
    *   **Formulario de Nueva Solicitud** (`NewRequest.jsx`): Lógica avanzada para selección de rangos de fechas o fechas individuales, omitiendo automáticamente fines de semana. Evita solapamientos con solicitudes pasadas.
    *   **Mis Solicitudes** (`MyRequests.jsx`): Interfaz con diseño de tablas divididas para mostrar "Pendientes de Autorización" y el "Historial de Solicitudes" procesadas.
    *   **Dashboard Principal** (`Dashboard.jsx`): Tarjetas de resumen para visualizar Días Asignados, Gozados y Saldo Disponible. Incorpora una vista rápida de las últimas 5 solicitudes, usando el formato de tablas divididas.
*   **Vistas Administrativas y de Jefatura:**
    *   **Aprobaciones por Equipo** (`PendingApprovals.jsx`): Pantalla exclusiva para Jefes (Managers) donde pueden ver únicamente las solicitudes de los empleados que tienen a su cargo.
    *   **Toda la Organización** (`AllRequests.jsx`): Vista global y paginada (exclusiva para Administradores de RRHH y Super Administradores) que lista todas las solicitudes de la empresa en tablas divididas.
*   **Administración de Personal (Admin.jsx):**
    *   Creación, edición y asignación de Jefes Inmediatos (`manager_id`).
    *   Control sobre los días base de vacaciones para cada caso particular.
    *   Asignación de roles de sistema (`employee`, `manager`, `hr_admin`, `super_admin`).
    *   **Soft Delete:** Función para "Desactivar" empleados que ya no laboran en MAR Fund. Se ocultan de las listas activas pero preservan el historial de reportes.
    *   **Empleados Inactivos** (`InactiveUsers.jsx`): Panel exclusivo para `super_admin` que permite consultar la lista de empleados desactivados y "Reactivarlos" de ser necesario.
*   **Mejoras UX/UI y Seguridad:**
    *   **Logo Corporativo:** Integración del logotipo original de MAR Fund en la barra de navegación y pantalla de Login.
    *   **Seguridad de Acceso:** Modificación en las Políticas de `Passport.js` para evitar que cualquier correo terminado en `@marfund.org` ingrese automáticamente. El sistema rechazará el login (mostrando una alerta visible) si el empleado no fue pre-registrado por RRHH en la Base de Datos.
    *   **Logout Directo:** Redireccionamiento inmediato de vistas al cerrar sesión.

## 4. Decisiones de Diseño Clave

1.  **Google OAuth como único método de Login:** Se decidió eliminar contraseñas. Esto aumenta la seguridad y facilita el onboarding.
2.  **Sesiones (Cookies) en lugar de JWT:** Para manejar la sesión se optó por un enfoque tradicional de Cookies y Store en Base de Datos (Stateful). Esto facilita la invalidación inmediata de sesiones (logout global útil para RRHH) sin depender de refresh tokens.
3.  **Manejo de Roles:** El sistema asigna por defecto el rol de `employee`. Los roles superiores (`hr`, `admin`, `manager`) deben ser concedidos manualmente en la base de datos por un Administrador, por motivos de seguridad inicial.
4.  **Desacoplamiento de Correos mediante n8n:** En lugar de enviar los correos directamente en el backend Node usando NodeMailer, se delegó la responsabilidad a webhooks de n8n. Esto permite que en el futuro RRHH pueda modificar las plantillas de correo visualmente.
5.  **Soft Delete (is_active):** Los registros de los empleados nunca se eliminan (`DELETE`), únicamente cambian de bandera (`UPDATE is_active = 0`) para preservar la integridad referencial del historial de solicitudes del año.

## 5. Próximos Pasos: Fase 6 (Cloud Deployment)

El sistema se encuentra completado al 100% en fase de Desarrollo Local. El siguiente y último paso corresponde al entorno DevOps:

1.  **Versionamiento en GitHub:** 
    *   Inicializar repositorio, añadir `.gitignore`, efectuar el primer commit y subir el código al servidor remoto usando la rama `main`.
2.  **Despliegue en Panel Hosting (Easypanel / Hostinger VPS):**
    *   Vincular Easypanel con el repositorio GitHub.
    *   Desplegar Backend Node.js como API (configurar `.env` para producción y puertos).
    *   Desplegar Frontend Vite/React.
    *   Levantar una base de datos MySQL 8 de Producción en el contenedor de Easypanel, restaurando el `schema.sql`.
    *   Configurar los apuntes DNS / subdominios (Ej: `vacaciones.marfund.org`) e instalar los certificados SSL Let's Encrypt desde el panel.
3.  **Puesta a punto de n8n (Notificaciones Core):**
    *   Levantar servicio de n8n en el mismo panel Easypanel.
    *   Configurar las credenciales seguras de la cuenta de remitente oficial `rrhh@marfund.org`.
    *   Empalmar y probar los dos flujos (Webhooks hacia la API del servidor local de la nube):
        *   **Workflow 1:** Dispara notificación a Jefe directo, copia a Solicitante, y copia a RRHH alertando de una Nueva Solicitud.
        *   **Workflow 2:** Dispara mensaje a Solicitante cuando su solicitud es Aprobada o Rechazada por el Jefe (y con copia a RRHH en caso de ser aprobada).
