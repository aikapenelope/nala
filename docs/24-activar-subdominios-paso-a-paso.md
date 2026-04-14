# Nova: Activar Subdominios — Paso a Paso

> Fecha: Abril 2026
> Prerequisito: todo el codigo ya esta mergeado (PRs #66-#73). Solo falta configuracion.
> Tiempo estimado: 30-45 minutos.

---

## Paso 1: Comprar dominio

Comprar un dominio `.com` dedicado para los subdominios de tenant. Opciones:

- `novapp.com`
- `usenova.com`
- `getnova.com`
- `nova-app.com`

Cualquier registrador funciona (Cloudflare Registrar, Namecheap, Google Domains). Si lo compras en Cloudflare Registrar, el paso 2 es automatico.

**Costo:** ~$10-15/ano.

**Por que un dominio dedicado:** `bodegadonpedro.nova.aikalabs.cc` es un subdominio de tercer nivel. El SSL gratuito de Cloudflare (Universal SSL) solo cubre hasta primer nivel. Con un dominio dedicado, `bodegadonpedro.novapp.com` es primer nivel y el SSL es gratis.

---

## Paso 2: Configurar DNS en Cloudflare

Si el dominio NO esta en Cloudflare, primero cambiar los nameservers del registrador a los de Cloudflare.

Luego, en Cloudflare Dashboard -> el nuevo dominio -> DNS:

**Registro 1: wildcard para subdominios de tenant**
```
Tipo:    CNAME
Nombre:  *
Destino: nova.aikalabs.cc
Proxy:   Activado (nube naranja)
```

**Registro 2: dominio raiz (para que novapp.com tambien funcione)**
```
Tipo:    CNAME
Nombre:  @
Destino: nova.aikalabs.cc
Proxy:   Activado (nube naranja)
```

**Verificar que funciona:**
```bash
dig +short bodegadonpedro.novapp.com
# Deberia mostrar IPs de Cloudflare (172.67.x.x o 104.21.x.x)
```

**SSL:** Cloudflare genera certificado automaticamente para `*.novapp.com` porque es primer nivel. No hay que hacer nada extra.

---

## Paso 3: Configurar Coolify

Ir a Coolify Dashboard -> el servicio `nova-web`.

**3a. Agregar dominio wildcard**

En la seccion de dominios del servicio, agregar:
```
*.novapp.com
```

Coolify genera la regla de Traefik automaticamente. No necesitas editar archivos de Traefik.

Si Coolify pide confirmacion o muestra un campo de "Custom Domain", escribir `*.novapp.com` y guardar.

**3b. Agregar variables de entorno al servicio nova-web**

```
NUXT_PUBLIC_TENANT_DOMAIN=novapp.com
```

**3c. Agregar variables de entorno al servicio nova-api**

```
TENANT_DOMAIN=novapp.com
```

**3d. Redesplegar ambos servicios**

Coolify -> nova-web -> Redeploy
Coolify -> nova-api -> Redeploy

---

## Paso 4: Configurar Clerk

Ir a Clerk Dashboard (dashboard.clerk.com) -> Settings -> Domains.

**4a. Agregar el nuevo dominio**

Agregar `novapp.com` como dominio permitido. Esto permite que Clerk comparta sesiones entre `novapp.com` y todos sus subdominios (`bodegadonpedro.novapp.com`, etc.).

**4b. Verificar DNS de Clerk**

Clerk puede pedir que agregues registros DNS de verificacion (CNAME o TXT). Seguir las instrucciones en el dashboard de Clerk. Estos registros se agregan en Cloudflare en la zona del nuevo dominio.

---

## Paso 5: Verificar

Esperar 2-5 minutos para que DNS propague y Coolify redespliegue.

**5a. Verificar DNS**
```bash
dig +short test123.novapp.com
# Debe mostrar IPs de Cloudflare
```

**5b. Verificar SSL**
```bash
curl -s -o /dev/null -w "%{http_code}" https://test123.novapp.com
# Debe retornar 200 o 302 (redirect al catalogo o landing)
```

**5c. Verificar catalogo publico**

Si ya hay un negocio con slug en la DB:
```bash
curl -s https://{slug}.novapp.com
# Debe mostrar el catalogo publico del negocio
```

Si no hay negocios con slug todavia, crear uno desde el onboarding. El formulario ahora pide un slug.

**5d. Verificar que la app principal sigue funcionando**
```bash
curl -s https://nova.aikalabs.cc
# Debe funcionar como antes
```

---

## Paso 6: Verificar CORS

Abrir el navegador en `https://bodegadonpedro.novapp.com` (o cualquier subdominio). Abrir DevTools -> Console. Si hay errores de CORS, verificar que `TENANT_DOMAIN=novapp.com` esta configurado en nova-api.

---

## Resumen de cambios por servicio

### Cloudflare (nuevo dominio)
- `*.novapp.com` CNAME `nova.aikalabs.cc` (proxied)
- `novapp.com` CNAME `nova.aikalabs.cc` (proxied)
- Registros DNS de Clerk (si los pide)

### Coolify: nova-web
- Dominio: agregar `*.novapp.com`
- Env: `NUXT_PUBLIC_TENANT_DOMAIN=novapp.com`
- Redeploy

### Coolify: nova-api
- Env: `TENANT_DOMAIN=novapp.com`
- Redeploy

### Clerk Dashboard
- Agregar `novapp.com` como dominio permitido
- Verificar DNS si lo pide

---

## Si algo falla

| Sintoma | Causa probable | Solucion |
|---|---|---|
| `dig` no resuelve | DNS no propagado | Esperar 5-10 min. Verificar que el registro esta proxied en Cloudflare |
| SSL error (ERR_SSL) | Certificado no generado | Esperar 5-15 min. Cloudflare genera el cert automaticamente |
| 404 en el subdominio | Coolify no tiene el wildcard | Verificar que `*.novapp.com` esta en los dominios del servicio nova-web |
| CORS error en console | TENANT_DOMAIN no configurado en nova-api | Agregar `TENANT_DOMAIN=novapp.com` y redesplegar nova-api |
| Clerk no funciona en subdominio | Dominio no agregado en Clerk | Agregar novapp.com en Clerk Dashboard -> Domains |
| Onboarding no pide slug | PR #73 no desplegado | Verificar que el ultimo deploy de nova-web incluye el commit de PR #73 |
| Catalogo muestra "No se encontro" | Negocio no tiene slug en DB | Crear un negocio nuevo desde el onboarding (ahora pide slug) |
