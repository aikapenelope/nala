# Nala: Roadmap + Analisis de producto — Mayo 2026

> Fuente unica de verdad. Reemplaza docs 45, 46, 47 y todos los anteriores.
> Actualizado: 14 mayo 2026 post-sesion completa (PRs #265-#275).

---

## Change log de esta sesion

| PR | Tipo | Descripcion |
|----|------|-------------|
| #265 | fix | RLS crash: validar columnas antes de aplicar policies |
| #266 | fix | Image upload: bucket nunca se creaba, agregar initStorage() |
| #267 | fix | Image proxy: mover a ruta publica sin auth |
| #268 | fix | CORP header: secureHeaders() bloqueaba img cross-origin |
| #272 | feat | Multi-imagen backend: tabla product_images, 4 endpoints, proxy por ID |
| #273 | feat | Multi-imagen frontend: galeria en inventario + carousel en storefront |
| #274 | merge | Merge de #272 (backend multi-imagen) |
| #275 | feat | Simplificar ventas: quick sale endpoint + POS inline checkout |

### Detalle tecnico de los fixes de imagenes (#265-#268)

El cuadro azul con "?" en el inventario tenia 4 capas de problemas:

1. **Bucket nunca se creaba** — `ensureBucket()` existia pero nunca se llamaba desde `index.ts`
2. **Proxy detras de auth** — `<img>` tags no envian Authorization headers
3. **CORP header** — `secureHeaders()` ponia `Cross-Origin-Resource-Policy: same-origin`, bloqueando imagenes cross-origin
4. **Solucion CORP** — `c.header()` y `c.res.headers.set()` no sobreescribian porque `secureHeaders()` ejecuta post-next (LIFO). Solucion: registrar `secureHeaders({ crossOriginResourcePolicy: "cross-origin" })` scoped a `/images/*` ANTES del global

### Detalle del multi-imagen (#272-#274)

- Nueva tabla `product_images` (1:N con products, max 5, sort_order)
- Endpoints: upload, list, delete, reorder
- Proxy: `/images/products/:productId` (principal) + `/images/products/:productId/:imageId` (especifica)
- Storefront: carousel CSS snap con swipe + dot indicators
- Inventario: grid de thumbnails con upload, delete, badge "1ra"
- Migracion automatica de `products.image_url` existente a `product_images`

### Detalle de simplificacion de ventas (#275)

- Nuevo endpoint `POST /api/sales/quick` — venta por monto sin producto
- POS rediseñado: metodos de pago inline en el ticket, confirmar sin navegar
- Boton "$ Rapida" para ventas sin producto (modal)
- Checkout avanzado (`/sales/checkout`) sigue existiendo para fiado, recargos, IGTF

---

## Estado actual del sistema

| Metrica | Valor |
|---------|-------|
| LOC | ~32,000 |
| Tablas | 34 |
| Migraciones | 17 |
| Paginas frontend | 35 |
| Componentes | 11 |
| Composables | 13 |
| Tests | 14 archivos |
| CI | GitHub Actions (turbo typecheck + lint + test + build) |
| PRs | #79-#275 |

### Que funciona

- POS con categorias, barcode scanner, creacion rapida, checkout inline, venta rapida
- Dashboard con 10 API calls en paralelo, pull-to-refresh, skeleton loading
- Inventario con semaforo, prediccion de agotamiento, multi-imagen (5 fotos), lista/grid
- Storefront PWA con checkout, carousel de imagenes, infinite scroll, IGTF
- OCR de facturas (GPT-4o-mini vision)
- Cierre/apertura de caja
- Cuentas por cobrar con cobro por WhatsApp
- Reportes en 3 tabs + export Excel
- Tasa BCV manual + auto-fetch
- Pedidos online con confirmacion rapida + sonido
- Toast notifications
- Devolucion parcial (API, falta UI)
- Proxy de imagenes publico con CORP cross-origin
- Command palette (Cmd+K)

---

## Como funcionan las ventas hoy

### Modo 1: Venta con producto (POS)

```
Tab "Vender" → Grilla de productos → Toca producto → Se agrega al ticket
→ Selecciona metodo de pago (inline) → "Confirmar venta"
```

**3 taps.** El producto se busca por:
- **Nombre**: escribes en el buscador y aparece
- **Categoria**: tabs arriba filtran la grilla
- **Codigo de barras**: el boton de camara abre el scanner, detecta el codigo, y agrega el producto automaticamente al ticket
- **Barcode gun**: si tienes un lector USB, escribes en el campo de busqueda y al dar Enter se agrega automaticamente

El ticket muestra los items con +/- para cantidad. Abajo aparecen los metodos de pago como pills (Efectivo, P. Movil, Binance, Zelle, Transfer.). Tocas uno, confirmas, listo.

Para opciones avanzadas (fiado, recargos, IGTF, split payment) hay un link "Fiado, recargos, IGTF →" que lleva al checkout completo.

### Modo 2: Venta rapida (sin producto)

```
Boton verde "$ Rapida" → Modal: monto + descripcion + metodo de pago → "Registrar"
```

**3 taps.** No necesitas tener productos en inventario. Solo pones cuanto te pagaron y como. Util para servicios, ventas informales, o cuando no tienes el producto cargado.

### Modo 3: Tienda online (storefront)

```
Cliente abre tu-negocio.novaincs.com → Catalogo con carousel → Agrega al carrito
→ Checkout con datos + metodo de pago → Pedido llega a tu dashboard
```

El dueno confirma el pedido desde `/orders` con un tap.

### Lo que NO esta automatizado

- No hay integracion con pasarelas de pago (Stripe, MercadoPago). Los pagos se registran manualmente.
- No hay facturacion electronica (SENIAT/ISLR).
- No hay conexion con WhatsApp Business API. Los mensajes son via `wa.me` links (el usuario abre WhatsApp manualmente).

---

## Treinta vs Nala: Analisis de enfoque

### Que es Treinta realmente

Treinta **no es un sistema de ventas**. Es un **registro de flujo de caja** con inventario opcional. Su core es:

1. **Registrar que entro dinero** — tocas "+", pones monto, metodo de pago, listo
2. **Registrar que salio dinero** — gastos, deudas
3. **Ver cuanto gane hoy** — balance diario

El inventario, el catalogo virtual, y el "POS" son features secundarios que se construyeron encima de ese core. La prueba: puedes usar Treinta sin crear un solo producto. Solo registras ventas por monto.

### El catalogo virtual de Treinta

Treinta tiene un "catalogo virtual" que es basicamente una pagina web con tus productos que puedes compartir por WhatsApp. Pero segun las reviews del App Store:

> "La aplicacion tiene problemas para generar el catalogo virtual"
> "Estamos trabajando en la reestructuracion del catalogo virtual"

Es un feature que no funciona bien y que Treinta misma reconoce que esta en reconstruccion. No es su fortaleza.

### Donde Treinta gana

- **Simplicidad brutal**: registrar una venta es 2 taps
- **No requiere setup**: no necesitas crear productos para empezar
- **Mobile-first**: diseñada para el celular del bodeguero
- **7 millones de usuarios**: efecto de red, confianza

### Donde Nala ya gana sobre Treinta

| Feature | Treinta | Nala |
|---------|---------|------|
| Multi-imagen por producto | 1 foto | 5 fotos con galeria |
| Storefront PWA | Catalogo basico (roto segun reviews) | PWA completa con checkout, carousel, pedidos |
| OCR de facturas | No | Si (GPT-4o-mini) |
| Tasa BCV automatica | No | Si |
| IGTF automatico | No | Si |
| Semaforo de stock | Alertas basicas | Semaforo visual + prediccion de agotamiento |
| Devolucion parcial | No | Si (API) |
| Cierre de caja | No | Si |
| Subdominio por tenant | No | Si (slug.novaincs.com) |
| Codigo abierto | No | Si |

### Donde Treinta gana sobre Nala

| Feature | Treinta | Nala |
|---------|---------|------|
| Venta sin producto | Core del producto | Recien agregado (PR #275) |
| Recargas telefonicas | Si | No |
| Facturacion electronica | Si (Pro) | No |
| App nativa (Play Store) | Si | PWA (no en store) |
| Onboarding | 30 segundos | Requiere Clerk signup |
| Multi-idioma | Si | Solo español |
| Soporte en español | Si (chat) | No |

---

## Que nos falta como producto

### Critico: Lo que impide que alguien use Nala hoy

1. **Onboarding demasiado largo** — Clerk signup + crear negocio + configurar. Treinta: descargas, pones nombre, listo. Nala necesita un onboarding de 60 segundos maximo.

2. **No hay app en Play Store** — La PWA funciona pero la gente busca en la tienda. Sin presencia en Play Store, no existes para el 90% del mercado. Se puede empaquetar la PWA con TWA (Trusted Web Activity) o Capacitor.

3. **El POS no se entiende sin explicacion** — Tu confusion lo demuestra. Un usuario nuevo no sabe que tiene que tocar un producto de la grilla para venderlo. Necesita un tutorial interactivo o un flujo mas obvio (boton grande "Registrar venta" en el centro).

### Importante: Lo que nos diferenciaria

4. **Compartir catalogo por WhatsApp** — Treinta lo tiene (roto). Nala tiene el storefront pero no tiene un boton "Compartir mi catalogo" que genere un link bonito para WhatsApp. Esto es trivial de implementar pero es el feature #1 que piden los usuarios de Treinta.

5. **Notificaciones push de pedidos** — El sonido existe pero no hay push notifications. Cuando un cliente hace un pedido, el dueno deberia recibir una notificacion en el celular aunque la app este cerrada.

6. **Recibo PDF bonito** — El endpoint existe pero no hay boton visible. Un recibo compartible por WhatsApp con el logo del negocio es diferenciador.

### Nice to have: Lo que nos haria premium

7. **WhatsApp Business API** — Recibir pedidos por chat, enviar confirmaciones automaticas, catalogo por WhatsApp. Requiere Meta Business verification. Es el holy grail para PyMEs latinas.

8. **Facturacion electronica** — Requerido legalmente en Colombia, Mexico, y eventualmente Venezuela. Treinta lo tiene en Pro.

9. **App nativa en Play Store** — TWA wrapper de la PWA. Cuesta 25 USD la cuenta de Google Play.

---

## Que hace Nova por detras (y por que ya es mas complejo que Treinta)

Nova parece simple por fuera pero por detras hace mucho mas que Treinta. Esto es lo que pasa automaticamente cuando registras una venta:

### Al confirmar una venta (POST /api/sales)

1. **Valida stock** — verifica que cada producto tiene suficiente inventario
2. **Descuenta stock** — resta la cantidad vendida de cada producto
3. **Registra movimiento de stock** — crea un registro en `stock_movements` con tipo "sale" para auditoria
4. **Calcula costo** — suma el costo de los productos vendidos para calcular ganancia
5. **Aplica tasa BCV** — convierte el total a bolivares automaticamente
6. **Registra pagos** — soporta pagos divididos (parte efectivo, parte pago movil)
7. **Si es fiado** — crea cuenta por cobrar automatica, actualiza balance del cliente, valida limite de credito
8. **Genera asientos contables** — debito/credito automatico en el plan de cuentas
9. **Registra actividad** — log de auditoria con quien hizo la venta y cuando
10. **Todo en transaccion atomica** — si algo falla, nada se guarda (no queda data inconsistente)

### Al anular una venta (POST /api/sales/:id/void)

1. **Restaura stock** de cada producto
2. **Revierte cuenta por cobrar** si era fiado
3. **Revierte balance del cliente**
4. **Revierte asientos contables**
5. **Registra movimiento de stock** tipo "void"
6. **Requiere razon** obligatoria

### Al hacer devolucion parcial (POST /api/sales/:id/return)

1. **Restaura stock** solo de los items devueltos
2. **Calcula reembolso** proporcional
3. **Registra movimiento** tipo "credit_note"

### Reportes automaticos

- **Ventas del dia** con ganancia, costo, margen
- **Top productos** por cantidad y por ingreso
- **Ventas por metodo de pago** (donut chart)
- **Ventas por canal** (POS, WhatsApp, delivery, online)
- **Prediccion de agotamiento** por producto (dias restantes basado en velocidad de venta)
- **Semaforo de stock** (verde/amarillo/rojo/gris) calculado en tiempo real
- **Export a Excel** de reportes e inventario

### Lo que Treinta NO hace

| Feature | Nova | Treinta |
|---------|------|---------|
| Transaccion atomica (rollback si falla) | Si | No |
| Asientos contables automaticos | Si | No |
| Prediccion de agotamiento | Si | No |
| Devolucion parcial | Si | No |
| Validacion de limite de credito | Si | No |
| Movimientos de stock auditables | Si | No |
| Tasa BCV automatica | Si | No |
| IGTF automatico | Si | No |
| OCR de facturas | Si | No |
| Storefront PWA con checkout | Si | Catalogo basico (roto) |
| Multi-imagen con carousel | Si | 1 foto |
| Subdominio por tenant | Si | No |

### Conclusion

Nova ya es significativamente mas complejo que Treinta en el backend. Lo que falta no es complejidad — es **pulir la experiencia de usuario** para que toda esa complejidad sea invisible. El usuario deberia sentir que es tan simple como Treinta, pero con superpoderes por detras.

Las cosas que mas impacto tendrian:
1. **Mostrar errores en vez de pantallas vacias** (fix en este PR)
2. **Tutorial de primer uso** en el POS
3. **Boton compartir catalogo** por WhatsApp
4. **App en Play Store** (TWA wrapper)

---

## Orden de ejecucion recomendado

```
Inmediato (esta semana):
  - Boton "Compartir catalogo" por WhatsApp ......... 2 horas
  - Boton "Compartir recibo" en historial ........... 2 horas
  - Tutorial interactivo en POS (primer uso) ........ 4 horas
  - UI de devolucion parcial ........................ 1 dia

Siguiente semana:
  - Simplificar onboarding (menos pasos) ............ 1 dia
  - Push notifications para pedidos ................. 1 dia
  - Consistencia visual en paginas secundarias ....... 3 horas
  - Ocultar paginas sin uso (cotizaciones, etc) ...... 1 hora

Semana 3-4:
  - TWA wrapper para Play Store ..................... 2 dias
  - Personalizacion storefront (logo, colores) ...... 2 dias
  - Multi-usuario (Clerk Organizations) ............. 3 dias

Futuro:
  - WhatsApp Business API ........................... 2 semanas
  - Facturacion electronica ......................... 2 semanas
```

---

## Docs deprecados

Todos los docs anteriores (01-47, PRODUCTION-ROADMAP, AUTH-*) son historicos.

**Fuente de verdad: este archivo (docs/48-roadmap-analisis-producto.md).**
