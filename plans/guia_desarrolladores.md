# Guía de Desarrollo y Mantenimiento 💻
**Proyecto:** Sistema de Gestión de Vacaciones y Permisos - MAR Fund
**Audiencia:** Equipo de Desarrollo / Administradores de Sistemas

🚀 ¡Bienvenidos al código fuente de MAR Fund Vacancies! Este repositorio (Monorepo) contiene las piezas exactas para mantener, escalar y mejorar la herramienta base.

---

## 🏗️ 1. Estructura del Proyecto (Monorepo)

El proyecto está dividido físicamente y lógicamente en dos carpetas primarias independientes:
```text
/solicitud-vacaciones-app/
├── /backend/    # Servidor Node.js (API REST)
├── /frontend/   # Cliente React (SPA en Vite)
├── /database/   # Scripts SQL para el esquema y pruebas
└── buenas_practicas_easypanel.md # Tips de DevOps (Cloud)
```
* **Separación de Responsabilidades:** El Frontend maneja la presentación pura (`npm run dev`) y el Backend la lógica de negocios y la Base de Datos (`npm start`). Para probar localmente se requiere iniciar ambas terminales.

---

## 🔑 2. El Flujo de Autenticación (¡Lo más Crítico!)

No hay contraseñas en todo el sistema. Toda la seguridad descansa en la API de Google (Passport.js).

**¿Cómo es el viaje?**
1. Un usuario no autenticado hace clic en "Ingresar". El React Frontend dirige TODO tu navegador puro y duro a `GET /api/auth/google`.
2. El **Backend** intercepta (en `authRoutes.js`), inicia `passport`, y redirecciona a Google.
3. El usuario autoriza su cuenta. Google regresa (hace *Callback*) hacia la URL secreta: `GET /api/auth/google/callback`.
4. El Backend lee el token. **Hace una consulta interna a MySQL:**
   - ¿El email existe en nuestra tabla `users`? -> Autentica su sesión y le inserta la cookie.
   - ¿No existe? -> Lo rebota.
5. Finalmente, el Backend hace una redirección 302 hacia el **Frontend URL** (`FRONTEND_URL/dashboard o /login?error...`).

**Mantenimiento:** Si se te rompe el inicio de sesión, el 99% de las veces es un desajuste entre:
* Las URLs Autorizadas en la Consola de Google Cloud.
* Las variables `.env` de tu Backend (`APP_URL` y `FRONTEND_URL`).

---

## ⚙️ 3. Las Entidades Base y Variables de Entorno (.env)

El corazón de los despliegues reside en el `.env`. Si bajas el proyecto a local, debes construir dos `.env`:
- **En `/backend/.env`**: Necesita los credenciales de MySQL nativo de dev/prod, los secrets de Google GCP, el secret alfanumérico para firmar cookies (`SESSION_SECRET`), y tu dominio (`APP_URL` / `FRONTEND_URL`).
- **En `/frontend/.env`**: Requiere `VITE_API_URL=http://localhost:3001/api` para funcionar.

> [!WARNING]
> React congela sus variables en tiempo de compilación. Las variables `VITE_...` en el Frontend se "inyectan" obligatoriamente mediante un `ARG` en tu Dockerfile público durante `npm run build`. Si no prevés esto en Easypanel, tu frontend usará un string equivocado (`localhost`) eternamente por caché.

---

## 📧 4. ¿Cómo funciona n8n (Los Webhooks)?

No usamos NPM libraries como `nodemailer` o `sendgrid` que trancan el sistema. Usamos Webhooks hacia n8n para enviar correos.
**El archivo mágico:** `/backend/services/n8nService.js`

**El Patrón:**
1. Cuando un endpoint del `requestController.js` completa agresivamente un `COMMIT` en la DB, reúne los datos.
2. Ejecuta *Asíncronamente* (sin obligar a la respuesta principal a esperar) un Disparo HTTP POST general mediante `axios`.
3. Lo dispara hacia una `Production URL` de Webhook que pertenece a Easypanel (n8n).
4. Nuestro Backend se olvida del asunto inmediatamente y retorna "201 Creado" al usuario. n8n lidia con el correo de fondo.

**Mantenimiento:**
Si vas a agregar una nueva notificación en el futuro (ej. Recordatorio de vacaciones), todo lo que debes hacer es: (A) Crear tu Webhook 3 en n8n, (B) Pegar su URL en el `Environment` del servidor y (C) Redactar una nueva función de exportación corta en `n8nService.js` armando el `payload` JSON correspondiente.

---

## 🕹️ 5. Pasos de Desarrollo Local (Onboarding D1)

1. Revisa que tu Motor local de MySQL corra por el 3306 e inyecta la DB desde `/database/schema.sql`.
2. Introduce tu propio correo electrónico dentro de esa BD generada y date a ti mismo el rol `super_admin` con el fin explícito de poder saltar la autenticación restringida de Google (y no quedar bloqueado de tu propia app en Dev).
3. Entra a las credenciales de Google Cloud, y activa `http://localhost:3001/api/auth/google/callback` y `http://localhost:3000` (El cliente react) a esa app temporal provisionalmente.
4. Terminal A: `cd backend && npm install && npm run dev`
5. Terminal B: `cd frontend && npm install && npm run dev`
