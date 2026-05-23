# Plan de Actualización — Beneficio Día Adicional por Antigüedad

**Fecha:** 23/05/2026  
**Branch:** main  
**Commits:** `91fbc61` → `b7a027c` → `4f69537` → `4c71aca`

---

## Cambios implementados

### 1. Importación de saldos — cambio de Excel a CSV con previsualización

- Nuevo endpoint `POST /api/users/preview-balances` — parsea el archivo y devuelve datos **sin guardar**
- Parser CSV propio en `importController.js` con manejo de BOM UTF-8 (Excel en Windows)
- Acepta columna `No. Colaborador` o `Código Colaborador`
- Flujo de dos pasos en Admin: seleccionar `.csv` → modal de previsualización (verde/amarillo/rojo) → "Confirmar carga (N)" → resultado

**Archivos modificados:**
- `backend/controllers/importController.js`
- `backend/routes/userRoutes.js`
- `frontend/src/pages/Admin.jsx`

---

### 2. Nuevos campos en tabla `users`

Dos columnas booleanas para beneficio por antigüedad:

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `benefit_extra_day` | `tinyint(1)` | `0` | Elegible para día extra anual por antigüedad |
| `benefit_extra_day_used` | `tinyint(1)` | `0` | Ya gozó el beneficio en el período actual |

**Migración requerida en producción (ejecutar una sola vez):**
```sql
ALTER TABLE users
  ADD COLUMN benefit_extra_day tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN benefit_extra_day_used tinyint(1) NOT NULL DEFAULT 0;
```

**Archivos modificados:**
- `database/schema.sql`
- `backend/controllers/userController.js` — `updateUser` y `createUser` incluyen ambos campos

---

### 3. Admin — tabla de solo lectura + modal de edición

**Tabla:**
- Eliminada la edición inline; filas ahora son de solo lectura con `hover:bg-gray-50`
- Nueva columna **"Antigüedad"**: badge `★ Aplica` (ámbar) + `Gozado` (verde) / `Pendiente` (gris)
- Botones de acción con `cursor-pointer`: `+ Días` · `Editar` · `Reporte` · `Desactivar`

**Modal "Ficha del Colaborador"** (se abre al hacer clic en "Editar"):

| Sección | Campos |
|---|---|
| Cabecera (read-only) | Avatar · Código Colaborador · Email · Fecha creación · Fecha actualización |
| Información Personal | Nombre Completo · Puesto · Días Base de Vacaciones |
| Sistema | Rol · Supervisor Inmediato · Activo (checkbox) |
| Beneficio Antigüedad | Aplica beneficio día adicional · Ya gozó el beneficio |

**Backend — `updateUser` actualizado** para aceptar además:
- `full_name`
- `is_active`

**Archivos modificados:**
- `frontend/src/pages/Admin.jsx`
- `backend/controllers/userController.js`

---

## Pasos pendientes en producción

1. Ejecutar `git pull origin main` en el servidor
2. Reiniciar el backend (nodemon / PM2)
3. Ejecutar la migración SQL en la base de datos:

```sql
ALTER TABLE users
  ADD COLUMN benefit_extra_day tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN benefit_extra_day_used tinyint(1) NOT NULL DEFAULT 0;
```
