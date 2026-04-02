# Buenas Prácticas y Solución de Problemas: Despliegue en Easypanel 🚀

Esta guía documenta los aprendizajes, errores comunes y mejores prácticas adquiridas durante el despliegue del **Sistema de Vacaciones MAR Fund** (Frontend React/Vite + Backend Node.js) desde un entorno local de Windows hacia contenedores de producción Linux en Easypanel.

---

## 1. El Problema del Motor Nixpacks vs Dockerfile Manual

**Síntoma:** Durante el despliegue en Easypanel, los registros (`logs`) del build (fase de construcción) fallan con un error extraño: `UndefinedVar: Usage of undefined variable '$NIXPACKS_PATH'` o la compilación se corta silenciosamente.
**Causa:** Easypanel utiliza por defecto "Nixpacks" para detectar y compilar código automáticamente. Sin embargo, tiene bugs conocidos al intentar construir proyectos que están anidados dentro de subcarpetas (monorepos como `/frontend` o `/backend`).
**Mejor Práctica (Solución):**
- **Nunca usar Nixpacks para monorepos.** Siempre crear un archivo `Dockerfile` explícito y puro en la raíz de tu proyecto (ej. `/frontend/Dockerfile`).
- En la pestaña **Build** de Easypanel, cambiar el método a **Dockerfile**.

**⚠️ Ojo con las rutas duplicadas:**
Si en la configuración "General" de tu app en Easypanel ya indicaste que tu código vive en `/frontend` (Build Path), entonces el **Dockerfile Path** solamente debe decir `Dockerfile`.
Si escribes `/frontend/Dockerfile`, Easypanel lo buscará dentro de `/frontend/frontend/Dockerfile`, causando un colapso "Rojo" absoluto sin arrojar logs.

---

## 2. Variables de Entorno de React (Vite) en Docker

**Síntoma:** La página carga bien, pero al intentar conectarse al backend o iniciar sesión con Google, intenta viajar hacia `http://localhost:3001` en lugar del dominio en la nube, a pesar de que la variable pública de Easypanel dice otra cosa.
**Causa:** Vite (React) **no lee las variables de entorno en tiempo real del servidor**. Las variables que empiezan con `VITE_...` se inyectan permanentemente (hardcoded) en los archivos `.js` durante el momento preciso de la compilación (`npm run build`). Si el Dockerfile no recibe la variable en ese momento, Node.js usará lo que encuentre a la mano (usualmente el `.env` viejo o valores por defecto).
**Mejor Práctica (Solución):**
- En tu `Dockerfile` del Frontend, justifica la variable pública **ANTES** del comando de build usando `ARG` y `ENV`.

```dockerfile
# ...
COPY . .
# 1. Recibir la variable de Easypanel
ARG VITE_API_URL
# 2. Inyectarla al entorno de construcción
ENV VITE_API_URL=$VITE_API_URL
# 3. Compilar
RUN npm run build
```

---

## 3. Puertos Web vs. Puertos de Servicio en Easypanel

**Síntoma:** Easypanel dice que tu app está verde ("Running") pero al abrir el enlace público muestra una pantalla negra grande con el texto: **"Service is not reachable" (502 Bad Gateway)**.
**Causa:** El contenedor interno encendió su propio servidor web (ej. puerto 3000 o 3001), pero el Router principal de Easypanel no sabe a qué puerto enviar el tráfico de los visitantes.
**Mejor Práctica (Solución):**
- **Nunca exponer páginas web en la Pestaña "Ports".** Esa pestaña sirve para Base de datos o conexiones TCP crudas (romperá el servidor web).
- **Usar la Pestaña "Domains":** Ve al dominio web que te asignó Easypanel, edítalo, y en la pequeña casilla que dice **Port**, escribe el puerto interno que está usando tu Node.js (ej. `3000` para tu frontend React, o `3001` para tu backend Express).

---

## 4. El Crash Silencioso del Backend (SIGTERM)

**Síntoma:** El Backend dice "Servidor corriendo en el puerto 3001", pero inmediatamente después NPM muestra un error: `npm error signal SIGTERM`. La app muere a los pocos segundos.
**Causas y Soluciones:**
1. **El servidor no escucha al mundo exterior:** En Node.js, `app.listen(PORT)` por defecto solo escucha peticiones de la máquina local (`localhost`). El verificador de salud (Healthcheck) de Easypanel intenta pings externos, y al no recibir respuesta en 5 segundos, *asesina* el contenedor.
   - **Corrección:** `app.listen(PORT, '0.0.0.0', () => {...})`. El `0.0.0.0` le indica a Express escuchar conexiones desde afuera del contenedor.
2. **Errores asíncronos de Base de Datos:** Si usas `express-mysql-session`, y la nube no logra conectar la Base de Datos, se producirá un fallo fatal silencioso.
   - **Corrección:** Siempre atrapa (`.catch`) los eventos iniciales en `server.js`.
     `sessionStore.onReady().catch(err => console.error("Error BD", err));`

---

## 5. Google OAuth 2.0 en Nube Pública (Error 400: redirect_uri_mismatch)

**Síntoma:** Al Iniciar Sesión con Google desde la Nube, aparece una pantalla blanca de advertencia de Google indicando `Error 400: redirect_uri_mismatch`.
**Causa:** Por extrema seguridad, Google bloquea cualquier intento de usar una pantalla de Login si el servidor que la pide o el servidor a donde van a enviar tus datos de regreso **no está anotado en la lista blanca (Whitelist)** en Google Cloud Console.
**Mejor Práctica (Solución - Checklist Final):**
1. **Easypanel Backend Variables:** Asegurarse de que `APP_URL`, `FRONTEND_URL` y la clave secreta `GOOGLE_CALLBACK_URL` apunten a los verdaderos dominios en la nube de Easypanel (ya no `localhost`).
2. **Google Cloud Console - Orígenes JavaScript Autorizados:** Agregar la URL pública completa de tu **Frontend**.
3. **Google Cloud Console - URI de Redireccionamiento Autorizados:** Agregar el Path exacto hacia el **Backend** que atiende el callback. Ej: `https://mi-backend.easypanel.host/api/auth/google/callback`.
4. **⚠️ El Desvío Final (Backend Code):** En la función de autorización (`authController.js`), el Backend no debe dirigirte a él mismo (`APP_URL/dashboard`), sino a la cara visible (`FRONTEND_URL/dashboard`). Si no lo haces, recibirás un crudo `Cannot GET /dashboard` en pantalla blanca, porque un API no tiene páginas HTML.

---

### Resumen de Oro 🌟
1. Apps separadas y estables ➜ **Usa Dockerfile**.
2. React en Producción ➜ **Inyecta variables con ARG antes de compilar**.
3. Páginas Web No Encontradas ➜ **Enlaza el Puerto interno desde la pestaña Domains**.
4. Contenedores que se mueren ➜ **Asegura `0.0.0.0` y envuelve la conexión SQL**.
5. Google enojado ➜ **Actualiza las URLs autorizadas en Console Cloud y sincronízalas en tu código redireccionador**.
