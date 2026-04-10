# Nova: Sistema de Acceso por PIN y Modos Admin vs Empleado

---

## 1. Cómo Funciona el Acceso (Patrón Square)

En una PyME, el dueño tiene 1-5 empleados. No van a crear cuentas de email para cada cajero. El patrón estándar (Square, Loyverse, Toast, todos lo hacen igual):

- **El dueño** se logea con su cuenta real (Clerk: email + password + 2FA). Tiene acceso total.
- **Los empleados** acceden con un PIN de 4 dígitos en un dispositivo que ya está autenticado. No necesitan email, no necesitan cuenta de Clerk. El dueño les crea un PIN desde la configuración.

El dispositivo (celular, tablet, PC del negocio) ya tiene la sesión del negocio activa. El PIN solo cambia quién está operando dentro de esa sesión.

---

## 2. Flujo de Autenticación

### Primer acceso (el dueño configura)

```
1. Dueño abre nova.app en el navegador
2. Login con Clerk (email + password + 2FA opcional)
3. Clerk devuelve JWT con user_id y business_id
4. Nova carga el negocio (RLS se activa con business_id)
5. El dueño está en MODO ADMIN
```

### El dueño crea empleados

```
Configuración → Usuarios → Agregar empleado
  Nombre: Juan Pérez
  PIN: 1234 (4 dígitos, generado o elegido)
  [Guardar]
```

El empleado NO tiene email, NO tiene cuenta de Clerk. Solo existe en la tabla `users` de Nova con un PIN hasheado.

```sql
INSERT INTO users (business_id, name, role, pin_hash)
VALUES ('uuid-negocio', 'Juan Pérez', 'employee', hash('1234'));
```

### Dispositivo compartido (tablet/celular del negocio)

El dueño se logea una vez con Clerk en el dispositivo del negocio. Después de eso, el dispositivo queda autenticado como ese negocio. Cuando el dueño se va o cambia de turno:

```
┌─────────────────────────┐
│                         │
│    Nova                 │
│                         │
│    ¿Quién eres?         │
│                         │
│    ┌─────────────────┐  │
│    │ ● ● ● ●         │  │  ← PIN de 4 dígitos
│    └─────────────────┘  │
│                         │
│    [1] [2] [3]          │
│    [4] [5] [6]          │  ← teclado numérico
│    [7] [8] [9]          │
│    [←] [0] [OK]         │
│                         │
│    Juan P. · María G.   │  ← nombres de empleados
│    Pedro L.             │     (tap para autocompletar)
│                         │
└─────────────────────────┘
```

El empleado ingresa su PIN → Nova identifica quién es → cambia al MODO EMPLEADO. Toda acción queda registrada con el user_id de ese empleado.

### Cambio rápido de usuario

En un negocio con 2-3 cajeros que se turnan, el cambio debe ser instantáneo:

- El cajero actual toca "Cambiar usuario" (o el ícono de usuario en el header)
- Aparece la pantalla de PIN
- El nuevo cajero ingresa su PIN
- En <2 segundos está operando

No hay logout/login. No hay carga de página. Es un cambio de contexto dentro de la misma sesión del negocio.

---

## 3. Los 2 Modos de la App

### Modo Admin (Dueño)

**Cómo se activa:** Login con Clerk (email + password) o PIN del dueño.

**Qué ve y puede hacer:**

| Sección | Acceso |
|---|---|
| Dashboard | Completo: ventas, ganancia, comparativas, alertas, reportes |
| Vender | Completo: registrar ventas, anular, descuentos |
| Inventario | Completo: agregar/editar/eliminar productos, importar, variantes, precios, costos |
| Clientes | Completo: perfiles, segmentos, campañas, cobros |
| Cuentas | Completo: por cobrar, por pagar, cuadre de caja, cierre de día |
| Reportes | Completo: los 7 reportes, exportación, envío al contador |
| Contabilidad | Completo: catálogo de cuentas, exportación, SENIAT |
| Configuración | Completo: negocio, usuarios, métodos de pago, categorías, tasa BCV, 2FA, log |
| OCR | Completo: escanear facturas, confirmar, registrar |
| WhatsApp | Completo: consultas + acciones con confirmación |

**Indicador visual:** Badge o ícono que muestra "Admin" o el nombre del dueño en el header.

### Modo Empleado (Cajero/Vendedor)

**Cómo se activa:** PIN de 4 dígitos en dispositivo ya autenticado.

**Qué ve y puede hacer:**

| Sección | Acceso | Qué NO ve |
|---|---|---|
| Dashboard | Simplificado: ventas del día (solo las suyas), alertas de stock | Ganancia, costos, márgenes, comparativas, reportes financieros |
| Vender | Completo: registrar ventas, descuentos (hasta % configurado por el dueño) | Anular ventas (requiere PIN del dueño) |
| Inventario | Solo lectura: consultar stock, precios de venta, buscar productos | Costos, márgenes, editar productos, importar |
| Clientes | Básico: buscar cliente, ver nombre y saldo | Historial detallado, segmentos, campañas |
| Cuentas | No visible | Todo |
| Reportes | No visible | Todo |
| Contabilidad | No visible | Todo |
| Configuración | No visible | Todo |
| OCR | No disponible | Todo |
| WhatsApp | Solo consultas de solo lectura (si tiene teléfono registrado) | Acciones que modifican datos |

**Indicador visual:** Badge con el nombre del empleado en el header. Color diferente al admin (ej: header gris en vez de azul).

### Acciones que requieren PIN del dueño (escalación)

Algunas acciones son del empleado pero necesitan aprobación del dueño:

| Acción | Qué pasa |
|---|---|
| Anular una venta | "Ingresa el PIN del dueño para anular" → dueño ingresa PIN → se anula |
| Descuento mayor al límite | "Descuento de 30% requiere aprobación. PIN del dueño:" → dueño aprueba |
| Abrir caja sin venta | "Apertura de caja requiere PIN del dueño" |
| Devolver dinero | "Devolución de $25 requiere PIN del dueño" |

Esto es exactamente como lo hace Square: el cajero no puede hacer ciertas cosas sin que el dueño (o gerente) ingrese su PIN en el momento.

---

## 4. Implementación Técnica

### Tabla de usuarios

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  
  -- Auth: Clerk (solo dueños) o PIN (empleados)
  clerk_id TEXT,                    -- Solo dueños tienen Clerk ID
  
  -- Datos del usuario
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'employee')),
  pin_hash TEXT NOT NULL,           -- bcrypt hash del PIN de 4 dígitos
  
  -- WhatsApp (opcional)
  phone TEXT,
  whatsapp_enabled BOOLEAN DEFAULT false,
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Flujo de autenticación en el backend

```typescript
// Middleware de autenticación: soporta JWT de Clerk O PIN
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader?.startsWith('Bearer ')) {
    // Auth por JWT de Clerk (dueño desde su dispositivo personal)
    const token = authHeader.split(' ')[1];
    const clerkUser = await clerk.verifyToken(token);
    const user = await db.query(
      "SELECT * FROM users WHERE clerk_id = $1", [clerkUser.sub]
    );
    c.set('user', user);
    c.set('businessId', user.business_id);
    
  } else if (authHeader?.startsWith('Pin ')) {
    // Auth por PIN (empleado en dispositivo compartido)
    // El header incluye: Pin {business_id}:{pin}
    const [businessId, pin] = authHeader.split(' ')[1].split(':');
    const employees = await db.query(
      "SELECT * FROM users WHERE business_id = $1 AND is_active = true",
      [businessId]
    );
    const user = employees.find(e => bcrypt.compareSync(pin, e.pin_hash));
    if (!user) return c.json({ error: 'PIN inválido' }, 401);
    
    c.set('user', user);
    c.set('businessId', businessId);
    
  } else {
    return c.json({ error: 'No autorizado' }, 401);
  }
  
  // Setear RLS
  await db.query("SET app.current_business_id = $1", [c.get('businessId')]);
  
  await next();
}
```

### Flujo en el frontend (Nuxt 4)

```typescript
// composables/useAuth.ts
export function useAuth() {
  const user = useState<User | null>('user', () => null);
  const isAdmin = computed(() => user.value?.role === 'owner');
  const isEmployee = computed(() => user.value?.role === 'employee');
  
  // Login del dueño (Clerk)
  async function loginOwner() {
    // Clerk maneja el flujo de login
    const clerkUser = await useClerk().signIn();
    // Obtener usuario de Nova
    const novaUser = await $fetch('/api/auth/me');
    user.value = novaUser;
  }
  
  // Login de empleado (PIN en dispositivo compartido)
  async function loginEmployee(pin: string) {
    const businessId = localStorage.getItem('nova_business_id');
    const res = await $fetch('/api/auth/pin', {
      method: 'POST',
      body: { businessId, pin }
    });
    user.value = res.user;
  }
  
  // Cambio rápido de usuario
  async function switchUser(pin: string) {
    await loginEmployee(pin);
    // No recarga la página, solo cambia el contexto
  }
  
  // Verificar PIN del dueño para acciones restringidas
  async function verifyOwnerPin(pin: string): Promise<boolean> {
    const res = await $fetch('/api/auth/verify-owner-pin', {
      method: 'POST',
      body: { pin }
    });
    return res.valid;
  }
  
  return { user, isAdmin, isEmployee, loginOwner, loginEmployee, switchUser, verifyOwnerPin };
}
```

### Cómo la app cambia entre modos

```vue
<!-- layouts/default.vue -->
<template>
  <div :class="isAdmin ? 'admin-mode' : 'employee-mode'">
    <!-- Header cambia según el modo -->
    <AppHeader>
      <template #user>
        <UserBadge 
          :name="user.name" 
          :role="user.role"
          @click="showPinSwitch = true" 
        />
      </template>
    </AppHeader>

    <!-- Sidebar: admin ve todo, empleado ve menos -->
    <Sidebar v-if="isDesktop">
      <SidebarItem to="/dashboard" icon="home" label="Inicio" />
      <SidebarItem to="/sales" icon="cart" label="Vender" />
      <SidebarItem to="/inventory" icon="box" label="Inventario" />
      <SidebarItem to="/clients" icon="users" label="Clientes" />
      <SidebarItem v-if="isAdmin" to="/accounts" icon="wallet" label="Cuentas" />
      <SidebarItem v-if="isAdmin" to="/reports" icon="chart" label="Reportes" />
      <SidebarItem v-if="isAdmin" to="/accounting" icon="file" label="Contabilidad" />
      <SidebarItem v-if="isAdmin" to="/settings" icon="gear" label="Config." />
    </Sidebar>

    <!-- Contenido -->
    <main>
      <slot />
    </main>

    <!-- Modal de cambio de usuario -->
    <PinSwitchModal v-model="showPinSwitch" @switch="switchUser" />
  </div>
</template>
```

### Protección de rutas

```typescript
// middleware/admin-only.ts
export default defineNuxtRouteMiddleware((to) => {
  const { isAdmin } = useAuth();
  
  const adminRoutes = ['/accounts', '/reports', '/accounting', '/settings'];
  
  if (adminRoutes.some(r => to.path.startsWith(r)) && !isAdmin.value) {
    return navigateTo('/dashboard');
  }
});
```

### Protección dentro de páginas

```vue
<!-- pages/inventory/index.vue -->
<template>
  <div>
    <!-- Todos ven la lista de productos -->
    <ProductList :products="products" />
    
    <!-- Solo admin ve costos y márgenes -->
    <template v-if="isAdmin">
      <ProductCostColumn />
      <ProductMarginColumn />
    </template>
    
    <!-- Solo admin puede editar -->
    <ProductEditButton v-if="isAdmin" />
    
    <!-- Solo admin puede importar -->
    <ImportExcelButton v-if="isAdmin" />
  </div>
</template>
```

---

## 5. Pantalla de PIN (Diseño)

### En dispositivo compartido (tablet/celular del negocio)

Cuando la app se abre o cuando alguien toca "Cambiar usuario":

```
┌─────────────────────────┐
│                         │
│         NOVA            │
│    Bodega Juan          │
│                         │
│    ┌─┐ ┌─┐ ┌─┐ ┌─┐     │
│    │●│ │●│ │○│ │○│     │  ← 4 dots (2 ingresados)
│    └─┘ └─┘ └─┘ └─┘     │
│                         │
│    ┌───┐ ┌───┐ ┌───┐   │
│    │ 1 │ │ 2 │ │ 3 │   │
│    └───┘ └───┘ └───┘   │
│    ┌───┐ ┌───┐ ┌───┐   │
│    │ 4 │ │ 5 │ │ 6 │   │
│    └───┘ └───┘ └───┘   │
│    ┌───┐ ┌───┐ ┌───┐   │
│    │ 7 │ │ 8 │ │ 9 │   │
│    └───┘ └───┘ └───┘   │
│    ┌───┐ ┌───┐ ┌───┐   │
│    │ ← │ │ 0 │ │ ✓ │   │
│    └───┘ └───┘ └───┘   │
│                         │
│    Juan · María · Pedro │  ← tap en nombre = autoselect
│                         │
│    [Iniciar como dueño] │  ← abre login de Clerk
│                         │
└─────────────────────────┘
```

- Botones grandes (60px) para dedos
- Al ingresar 4 dígitos, se valida automáticamente (no hay que tocar OK)
- Si el PIN es correcto: transición instantánea al modo correspondiente
- Si el PIN es incorrecto: vibración + "PIN incorrecto" + limpiar
- 5 intentos fallidos: bloqueo de 5 minutos
- Los nombres de empleados abajo son atajos visuales (no revelan el PIN)

### En dispositivo personal del dueño

El dueño usa su celular personal con Clerk (email + password). No ve la pantalla de PIN. Va directo al Modo Admin. Si quiere cambiar a un empleado (para probar), puede ir a Configuración → "Ver como empleado".

---

## 6. Resumen

| Concepto | Cómo funciona |
|---|---|
| **Dueño accede** | Clerk (email + password + 2FA). Acceso total. Modo Admin |
| **Empleado accede** | PIN de 4 dígitos en dispositivo compartido. Acceso limitado. Modo Empleado |
| **Dispositivo compartido** | El dueño se logea una vez con Clerk. Después, los empleados usan PIN |
| **Cambio de usuario** | Tap en ícono de usuario → PIN → cambio instantáneo (<2s) |
| **Acciones restringidas** | Anular venta, descuento grande, abrir caja → requiere PIN del dueño |
| **Modo Admin** | Ve todo: costos, márgenes, reportes, configuración, cuentas, contabilidad |
| **Modo Empleado** | Ve: vender, consultar stock (sin costos), buscar clientes (básico). No ve: reportes, cuentas, configuración, contabilidad |
| **Accountability** | Cada acción registra user_id del empleado. Log completo. Gamificación por vendedor |
| **Seguridad** | PIN hasheado con bcrypt. 5 intentos → bloqueo 5 min. Log de accesos |
