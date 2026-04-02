# Integración de Notificaciones: Backend a n8n 📧

Este documento detalla la hoja de ruta para conectar el Sistema de Vacaciones MAR Fund con n8n para el envío automatizado de correos electrónicos. 

Dado que **n8n ya está habilitado en Easypanel** y las **credenciales de Gmail están configuradas**, nos enfocaremos netamente en la construcción de los flujos de trabajo (Workflows) y la conexión con nuestro Backend (Node.js).

---

## 🏗️ Arquitectura de la Solución

El flujo de comunicación será **Unidireccional (Backend ➜ n8n)** mediante **Webhooks**.
Cuando ocurre un evento crítico en la plataforma (ej. un empleado pide vacaciones), el Backend hará una petición `POST` (HTTP Request) invisible a una URL específica de n8n, enviando todos los datos necesarios (nombre, fechas, enlace para aprobar). n8n recibirá esos datos, armará una plantilla HTML bonita y enviará el correo por Gmail.

---

## 🚀 Plan de Acción Paso a Paso

### Paso 1: Creación de los Workflows en n8n
Vamos a crear 3 flujos de trabajo (Workflows) distintos en n8n, uno para cada escenario. Cada uno tendrá la siguiente estructura:
1. **Webhook (Trigger):** Un nodo que escucha peticiones `POST` y genera una URL o Endpoint único de producción.
2. **Gmail (Action):** Un nodo conectado a `rrhh@marfund.org` que recibe los datos del Webhook y los envía.

**Los 3 Escenarios:**
1. **Flujo A: Nueva Solicitud (Empleado ➜ RRHH)**
   - **Gatillo:** El empleado guarda la solicitud.
   - **Datos que enviará el backend:** Nombre del empleado, Fechas (Inicio y Fin), Días solicitados, Tipo de solicitud.
   - **Destinatario del correo:** `rrhh@marfund.org`.
2. **Flujo B: Aprobación de RRHH (RRHH ➜ Jefe/Supervisor)**
   - **Gatillo:** HR Admin revisa y aprueba el paso 1.
   - **Datos que enviará el backend:** Nombre del empleado, Fechas, Nombre del supervisor, Enlace directo a la solicitud en el sistema.
   - **Destinatario del correo:** Correo del supervisor.
3. **Flujo C: Decisión Final del Supervisor (Jefe ➜ Empleado y RRHH)**
   - **Gatillo:** El Jefe Aprueba o Rechaza la solicitud.
   - **Datos que enviará el backend:** Decisión (Aprobado/Rechazado), Comentarios del jefe, Nombre del empleado.
   - **Destinatario del correo:** Correo del Empleado (para notificarle) y con Copia (CC) a RRHH (para el archivo).

### Paso 2: Actualización de Variables de Entorno en Backend
Una vez creados los 3 Webhooks en n8n, este nos dará 3 URLs públicas denominadas "Production URLs".
Iremos a **Easypanel > Backend (`vacations-app`) > Environment** y agregaremos estas variables:
```env
N8N_WEBHOOK_NEW_REQUEST=https://n8n.tu-dominio.com/webhook/nueva-solicitud
N8N_WEBHOOK_HR_APPROVED=https://n8n.tu-dominio.com/webhook/aprobacion-rrhh
N8N_WEBHOOK_FINAL_DECISION=https://n8n.tu-dominio.com/webhook/decision-final
```
*(Luego daremos Deploy al Backend para que las reconozca).*

### Paso 3: Modificación del Código del Backend (`requestController.js`)
Actualizaremos nuestro archivo controlador encargado de gestionar las solicitudes para que "dispare" el Webhook (usando `axios` o la función `fetch` nativa de Node) justo después de guardar los cambios en la Base de Datos.

**Ejemplo de lo que programaremos en Node.js:**
```javascript
// Después de insertar la solicitud a MySQL...
try {
  await fetch(process.env.N8N_WEBHOOK_NEW_REQUEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empleado: req.user.full_name,
      fecha_inicio: start_date,
      fecha_fin: end_date,
      dias: total_days
    })
  });
} catch (error) {
  console.error('Error enviando notificación a n8n', error);
  // No detenemos la aplicación si falla el correo
}
```

### Paso 4: Pruebas End-to-End en Producción
Entraremos al **Frontend** público con un usuario de prueba, crearemos una solicitud y seguiremos el ciclo de vida completo (Empleado -> HR -> Jefe), confirmando en tiempo real que los correos lleguen correctamente a las bandejas de entrada correspondientes con la plantilla esperada.

---

**¿Listo para empezar?**
Si estás de acuerdo con este plan, el siguiente movimiento es que ingreses a tu **panel de n8n** publicamente y preparemos el primer Webhook (Nueva Solicitud).
