# Nova: Sistema de Acceso para Empleados con Clerk

> Documento tecnico: como funciona el acceso de empleados, paso a paso.
> Fecha: Abril 2026

---

## Resumen

Los empleados acceden a Nova a traves de un **link de invitacion** generado por el admin.
El empleado abre el link, crea su cuenta en Clerk (email + password), y queda
autenticado con su propia sesion. No necesita saber el email del admin.

---

## Arquitectura

```
Admin (owner)                          Empleado
     |                                      |
     | 1. Crea empleado en /settings/team   |
     |    (nombre + email del empleado)     |
     |                                      |
     | 2. Backend llama Clerk API:          |
     |    createInvitation({                |
     |      emailAddress,                   |
     |      redirectUrl,                    |
     |      publicMetadata: {businessId}    |
     |    })                                |
     |                                      |
     | 3. Clerk envia email al empleado     |
     |    con link de invitacion            |
     |                                      |
     |                                      | 4. Empleado abre el email
     |                                      |    y hace click en el link
     |                                      |
     |                                      | 5. Clerk redirige a /auth/resolve
     |                                      |    (redirectUrl configurado)
     |                                      |
     |                                      | 6. Empleado crea su cuenta:
     |                                      |    - Clerk sign-up (email ya verificado)
     |                                      |    - Elige su password
     |                                      |
     |                                      | 7. /auth/resolve llama GET /api/me
     |                                      |    - Backend busca por clerkId
     |                                      |    - Si no existe: webhook lo crea
     |                                      |    - Devuelve NovaUser
     |                                      |
     |                                      | 8. Empleado ve el dashboard
     |                                      |    con permisos de empleado
```

---

## Flujo detallado

### Paso 1: Admin crea empleado

En `/settings/team`, el admin ingresa:

- **Nombre** del empleado
- **Email** del empleado (real, para que reciba la invitacion)

### Paso 2: Backend crea la invitacion

```typescript
// POST /api/employees
const invitation = await clerk.invitations.createInvitation({
  emailAddress: employeeEmail,
  redirectUrl: `https://${slug}.${tenantDomain}/auth/resolve`,
  publicMetadata: {
    businessId: currentUser.businessId,
    role: "employee",
    name: employeeName,
  },
});
```

Clerk envia un email automatico al empleado con un link de invitacion.
El email del empleado queda **automaticamente verificado** cuando acepta.

### Paso 3: Empleado acepta la invitacion

1. Abre el email de Clerk
2. Click en el link de invitacion
3. Clerk lo redirige al Account Portal de sign-up
4. El empleado elige su password
5. Clerk crea la cuenta y redirige a `redirectUrl` (/auth/resolve)

### Paso 4: Webhook crea el usuario en Nova

Cuando Clerk crea la cuenta del empleado, dispara un webhook `user.created`.
El backend recibe el webhook y:

1. Lee `publicMetadata.businessId` y `publicMetadata.role`
2. Crea el registro en la tabla `users` con `clerkId`, `businessId`, `role`
3. El empleado ya existe en Nova cuando `/auth/resolve` llama `GET /api/me`

### Paso 5: Empleado usa Nova

- Tiene su propia sesion de Clerk (su propio JWT)
- No depende del admin para renovar sesion
- Puede cerrar sesion y volver a entrar con email + password
- Ve solo las secciones permitidas para empleados

---

## Por que Invitations y no Sign-In Tokens

| Aspecto      | Sign-In Tokens (anterior)                                 | Invitations (actual)                        |
| ------------ | --------------------------------------------------------- | ------------------------------------------- |
| Cuenta Clerk | Creada por backend con datos sinteticos                   | Creada por el empleado con sus datos reales |
| Email        | Sintetico (`@employees.internal`)                         | Real (del empleado)                         |
| Password     | Aleatorio (nunca usado)                                   | Elegido por el empleado                     |
| Re-login     | Necesita nuevo token del admin                            | Email + password directamente               |
| Expiracion   | Token de 30 dias, un solo uso                             | Invitacion de 30 dias, cuenta permanente    |
| Robustez     | Fragil (email sintetico rechazado por Clerk)              | Robusto (flujo estandar de Clerk)           |
| Complejidad  | Alta (createUser + createSignInToken + accept-token page) | Baja (createInvitation, Clerk maneja todo)  |

---

## Cambios necesarios en el codigo

### Backend: `routes/team.ts`

**POST /employees** (crear empleado):

- Recibe `{ name, email }`
- Llama `clerk.invitations.createInvitation()` con el email
- Crea registro en DB con `role: "employee"` (sin `clerkId` todavia)
- Devuelve confirmacion

**Webhook `user.created`**:

- Nuevo endpoint que recibe webhooks de Clerk
- Lee `publicMetadata.businessId` y `publicMetadata.role`
- Actualiza el registro del empleado con el `clerkId` de Clerk

### Frontend: `/settings/team.vue`

- Campo "Email" en vez de solo "Nombre"
- Mensaje de confirmacion: "Se envio una invitacion a {email}"
- Sin modal de link para copiar (Clerk envia el email)

### Frontend: Eliminar `/auth/accept-token.vue`

- Ya no se necesita. Clerk maneja la redireccion post-signup.

---

## Configuracion requerida en Clerk Dashboard

1. **Users & Authentication > Email**: Habilitado (requerido para invitaciones)
2. **Users & Authentication > Password**: Habilitado
3. **Webhooks**: Configurar endpoint para `user.created`
   - URL: `https://api.novaincs.com/webhooks/clerk`
   - Eventos: `user.created`

---

## Permisos por rol

| Accion                  | Owner | Empleado |
| ----------------------- | ----- | -------- |
| Vender y cobrar         | Si    | Si       |
| Ver inventario          | Si    | Si       |
| Ver clientes            | Si    | Si       |
| Ver historial de ventas | Si    | Si       |
| Anular ventas           | Si    | No       |
| Crear/editar productos  | Si    | No       |
| Ajustar inventario      | Si    | No       |
| Ver reportes            | Si    | No       |
| Contabilidad            | Si    | No       |
| Gestionar empleados     | Si    | No       |
| Configurar negocio      | Si    | No       |
