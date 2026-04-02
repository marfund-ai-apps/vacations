# Resumen Ejecutivo y Arquitectura Técnica
**Proyecto:** Sistema de Gestión de Vacaciones y Permisos - MAR Fund
**Audiencia:** Jefatura de Sistemas / Dirección Técnica

---

## 1. Visión General del Sistema
Se ha diseñado, desarrollado e implementado exitosamente la plataforma web interna para la gestión del ciclo de vida de vacaciones y permisos del personal de MAR Fund. La solución reemplaza los procesos manuales por un flujo digital automatizado (creación, revisión, aprobación y archivo), garantizando la trazabilidad y seguridad de los datos.

## 2. Pila Tecnológica (Tech Stack)
El sistema está construido bajo una arquitectura moderna de JavaScript (Stack MERN adaptado a código relacional), seleccionada por su alta compatibilidad, rendimiento y ecosistema open-source masivo:

* **Frontend:** React.js 18 empaquetado con Vite (SSR-Ready a futuro). Estilizado mediante TailwindCSS v4.
* **Backend:** Node.js v20 utilizando el framework Express.js.
* **Base de Datos:** MySQL 8+ (Motor relacional estructurado para integridad financiera/RRHH).
* **Autenticación:** Protocolo OAuth 2.0 vía Google Cloud Platform (GCP).
* **Automatización (Orquestación):** n8n (Motor de flujos de trabajo basado en nodos).
* **Infraestructura:** Easypanel (PaaS sobre VPS en la nube) administrando contenedores Docker aislados.

## 3. Arquitectura y Patrones de Diseño
El proyecto sigue una arquitectura **Cliente-Servidor Desacoplada**.

1. **Frontend (SPA - Single Page Application):** 
   - Diseño sin estado puro (Stateless UI).
   - Consume recursos mediante una API RESTful.
   - Construido estáticamente como activos web servidos a través de Nginx/Serve dentro del contenedor.

2. **Backend API (Node/Express):**
   - Estructura **MVC (Model-View-Controller)** simplificada (Service-Controller-Router).
   - Gestión de estado de sesiones centralizado: Las sesiones no viven en la RAM de Node, sino delegadas en `express-mysql-session` dentro de la base de datos, garantizando alta disponibilidad (si el nodo reinicia, nadie pierde su sesión).

3. **Integración Asíncrona (Event-Driven):**
   - El envío de notificaciones (emails) no bloquea el hilo principal del backend (Event Loop). Se delega mediante un patrón *Fire-and-Forget* hacia Webhooks de n8n, el cual procesa las plantillas HTML asíncronamente para enviar a Gmail.

## 4. Estrategia de Seguridad
* **Autenticación unificada restringida (SSO):** Se implementó Passport.js con Google Strategy. Las cuentas no manejan contraseñas locales. Solo correos validados `@marfund.org` (*y explícitamente habilitados en la DB*) pueden generar sesión.
* **RBAC (Role-Based Access Control):** Tres niveles de privilegios duros en el backend (`employee`, `manager`, `hr_admin/super_admin`), protegidos mediante middlewares de Express.
* **Cookies de Sesión Seguras:** Cifrado en tránsito (HTTPS) garantizado, con banderas de `HttpOnly` en las cookies generadas, previniendo ataques XSS de robo de token.
* **Cabeceras HTTP (Helmet):** Protección activa contra ataques Clickjacking y Sniffing de MIME-types.
* **Protección de Tokens en Email:** Las aprobaciones por correo electrónico se validan con tokens criptográficos de un solo uso (One-Time-Tokens) de 32 bytes con fecha de expiración configurada directamente en una tabla pivot de base de datos.

## 5. Infraestructura y Despliegue (DevOps)
El entorno vive en la nube, orquestado bajo Easypanel utilizando **Declaración estricta de Contenedores (Dockerfiles puros)**, descartando auto-constructores inestables (Nixpacks):
- **Aislamiento:** El Frontend y el Backend corren en contenedores de red blindada distintos.
- **Inyección en Build-Time:** Variables públicas en React (como URLs de API) se inyectan permanentemente durante la compilación en Docker.
- **Healthchecks:** El backend escucha estricta y externamente por el socket `0.0.0.0` para que el orquestador valide su tiempo de vida de forma ininterrumpida.
