# Guía de Traspaso y Desarrollo Continuo - Abril 2026
**Proyecto:** Plataforma de Gestión de Planilla y Vacaciones (MAR Fund)
**Audiencia:** Nuevo Equipo de Desarrollo de Software (Onboarding Técnico)

¡Bienvenidos al equipo! Este documento ha sido diseñado estratégicamente para proporcionar todo el contexto, herramientas y hojas de ruta (roadmap) necesarios para que puedan tomar el control del sistema de Inmediato, sin fricciones y con total seguridad.

---

## 🏛️ 1. Arquitectura y Componentes Clave

El proyecto es un **Monorepo** que aisla responsabilidades. Actualmente se despliega mediante repositorios Git sincronizados hacia un PaaS (Easypanel) que gestiona los Docker containers.

### A. Frontend (Directorio `/frontend`)
* **Stack:** `React 18` + `Vite` + `TailwindCSS v4`.
* **Enrutamiento:** `react-router-dom` con protección de rutas basada en contextos (`AuthContext.jsx`).
* **Reglas Básicas:** 
  - La UI es completamente *Stateless* frente a recursos de BD. 
  - Las peticiones centralizadas al API siempre incluyen credenciales (`withCredentials: true` en `axios`) para adjuntar la cookie de sesión de HTTPOnly.
  - La URL del backend se inyecta en compilación vía la variable de entorno `VITE_API_URL` alojada en el Dockerfile.

### B. Backend API (Directorio `/backend`)
* **Stack:** `Node.js 20` (Alpine) + `Express`.
* **Patrón de Diseño:** Patrón de Rutas -> Controladores (`Controllers`) -> Servicios (`/services`).
* **Seguridad Absoluta:**
  - **No existen passwords locales.** Autenticación delegada 100% a GCP (Google Cloud) mediante `Passport.js` (Estrategia Google OAuth 2.0). 
  - Gestión de sesiones confiada a `express-mysql-session`, permitiendo la persistencia horizontal sin sobrecargar la RAM del nodo (Si Node reinicia, nadie se desloguea).
  - Configuración estricta en CORS y CSRF (`SameSite=none; Secure` en producción) habilitando el cruce de subdominios.

### C. Base de Datos & Workflows
* **Core:** `MySQL 8+` actuando de única fuente de verdad (Single Source of Truth).
* **Colas Asíncronas (Correos):** El envío de emails y flujos empresariales no detiene la API (el loop principal). Usamos Webhooks hacia **n8n** (n8nService.js). El backend dispara la info (Request Created -> `Fire-and-Forget`) y n8n maqueta plantillas HTML y consume los SMTP/APIs de correo externos.

---

## 🚀 2. Primeros Pasos: Setup Local

Para comenzar a contribuir al código, necesitan configurar su entorno de desarrollo:

1. **Clonar e instalar dependencias:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Levantar la BBDD (MySQL):**
   - Ejecuta el archivo en `/database/schema.sql` en tu MySQL local (Puerto 3306).
   - Registra tu cuenta de correo manualmente con rol `'super_admin'` para testear.
3. **Generar Archivos `.env`:**
   - Deberás tener llaves de API (Client ID y Secret de Google OAuth). El CTO las proveerá.
   - Crea un `backend/.env` guiándote desde el `.env.example`. Asegúrate que `FRONTEND_URL` sea `http://localhost:3000`.
4. **Levantar Entorno:**
   - En consola A: `npm run dev` (En backend - Puerto 3001).
   - En consola B: `npm run dev` (En frontend - Puerto 3000).

---

## 📈 3. Roadmap de Optimización (Tareas Hacia el Futuro)

La plataforma actual cumple la regla de oro: *"El sistema feliz de MVP funciona"*. El siguiente nivel es volverlo indestructible, preparado para absorber nuevas reglas de recursos humanos (Planilla Completa) sin penalizar el rendimiento.

Aquí hay una matriz sugerida de oportunidades técnicas para el nuevo equipo:

### Fase 1: Calidad de Código y Estabilidad (Q2 2026)
- [ ] **Migración Parcial a TypeScript:** Comenzar a transcribir los modelos del backend y prop-types de React hacia TypeScript para reducir bugs silenciosos (`TypeError: undefined is not a function`).
- [ ] **Pruebas End-to-End (E2E):** Implementar Playwright o Cypress. Configurar una prueba donde un empleado "bot" genere una solicitud ficticia para validar que MySQL no devuelva bloqueos.
- [ ] **Configurar un Logger robusto:** Reemplazar `console.log()` por librerías como `Winston` o `Pino`. Monitorear y almacenar métricas de desempeño de las consultas en base de datos.

### Fase 2: Optimización de Backend/BBDD (Q3 2026)
- [ ] **Soft-Deletes (Borrado Lógico):**  Implementar una columna `deleted_at` para Empleados o Roles. Actualmente un borrado duro en DB podría dejar registros contables SQL huérfanos. 
- [ ] **Límites de Ritmo (Rate Limiting):** Instalar `express-rate-limit` para bloquear ataques DDoS o inundaciones de clics en solicitudes de vacaciones por segundo.
- [ ] **Validadores Robustos:** Implementar validación de payloads con librerías como `Joi` o `Zod` antes de que los request body toquen la lógica de negocio (`requestController.js`).

### Fase 3: Evolución Arquitectónica (Q4 2026+)
- [ ] **Sistemas de Caché (Redis):** Integrar Redis para cachear las respuestas pesadas, como "Configuración pública" o "Datos de usuario constante" donde el I/O sobre MySQL es inncesario.
- [ ] **Gestión de Estados Modernos en React:** Evaluar si React Query (`@tanstack/react-query`) debe ser introducido para gestionar la persistencia y revalidación en caché de los "Listados de Permisos", evitando redibujos excesivos de la vista de React.
- [ ] **Canalizar CI/CD:** Implementar Github Actions para compilar el backend, ejecutar Linting y Unit tests antes de fusionar `Pull Requests` a la rama de `main`.

---

## 🤝 4. Notas Críticas Adicionales para los Nuevos Devs

* **Modificar Reglas UI no modifica el Backend:** Si deben añadir reglas como "No se pueden pedir más de 12 días seguidos", recuerda auditar estas validaciones **dentro del Controlador Backend** y no depender ciegamente del Frontend.
* **El Orquestador (n8n):** Si se añade un módulo nuevo a "Planillas" como "Descuentos", la comunicación por Webhooks permite que no programemos notificaciones de correos en Node. Solo dispara la alerta a un canal Webhook nuevo en n8n y configúralo visualmente allá. 
* **Las Migraciones SQL:** Actualmente el esquema en DB es plano. Sería idóneo considerar heramientas de migración continua como *Knex.js*, *Sequelize CLI* o *Prisma* para versiones de código estables.

¡Mucho éxito con el relevo! Tienen un producto rápido, robusto y una excelente base escalable.
