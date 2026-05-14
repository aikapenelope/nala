# Post-mortem: Imagenes de productos (cuadro azul con ?)

## Cronologia de PRs

| PR | Problema | Fix |
|----|----------|-----|
| #264 | Imagenes no se veian (presigned URLs apuntaban a MinIO privado) | Proxy endpoint `/api/products/:id/image` |
| #265 | API crasheaba al arrancar (RLS en `sale_return_items` sin `business_id`) | Validar columnas antes de aplicar RLS |
| #266 | Upload de imagenes fallaba (bucket nunca se creaba) | `initStorage()` en boot sequence, bucket default `nova-media` |
| #267 | Imagenes seguian sin verse (proxy estaba detras de auth) | Ruta publica `/images/products/:id` sin auth |
| #268 | Imagenes **aun** sin verse (CORP header bloqueaba cross-origin) | `secureHeaders()` scoped con `crossOriginResourcePolicy: "cross-origin"` para `/images/*` |

## Causa raiz final (PR #268)

El middleware `secureHeaders()` de Hono pone `Cross-Origin-Resource-Policy: same-origin` en todas las respuestas. Este header le dice al browser: "no cargues este recurso si viene de otro origen".

- Frontend: `https://novaincs.com`
- API: `https://api.novaincs.com`
- Son origenes diferentes → browser bloquea `<img src="https://api.novaincs.com/images/...">`

**Nota:** Esto NO es CORS clasico. Es **CORP** (Cross-Origin Resource Policy), un mecanismo diferente que aplica incluso a `<img>` tags.

## Intentos fallidos y por que

### Intento 1: `c.header()` en sub-router
```typescript
// images.ts
images.use("*", async (c, next) => {
  await next();
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
});
```
**Fallo porque:** `c.header()` no sobreescribe headers ya seteados por el middleware padre.

### Intento 2: `c.res.headers.set()` en middleware de app.ts
```typescript
// app.ts
app.use("/images/*", async (c, next) => {
  await next();
  c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
});
```
**Fallo porque:** `secureHeaders()` tambien usa `ctx.res.headers.set()` **despues** de `await next()`. Como `secureHeaders()` esta registrado antes (mas externo), sale **despues** en el LIFO del middleware stack, sobreescribiendo el valor.

### Solucion final: `secureHeaders()` scoped
```typescript
// app.ts — registrar ANTES del global
app.use("/images/*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
app.use("*", secureHeaders());
```
**Funciona porque:** En Hono, cuando dos middlewares matchean la misma ruta, el registrado primero sale ultimo (LIFO). El scoped `/images/*` sale despues del global `"*"`, asi que su `headers.set("cross-origin")` sobreescribe el `headers.set("same-origin")` del global.

## Leccion aprendida

En Hono, `secureHeaders()` setea headers **post-next** con `ctx.res.headers.set()`. No se puede sobreescribir desde middlewares internos. La unica forma confiable es usar otra instancia de `secureHeaders()` con path-scoping registrada **antes** del global.

## Bucket migration (tambien en PR #268)

`initStorage()` ahora incluye migracion automatica del bucket legacy `order-proofs` a `nova-media`. En este caso no fue necesaria (el bucket legacy nunca existio), pero queda como safety net para futuros deploys.
