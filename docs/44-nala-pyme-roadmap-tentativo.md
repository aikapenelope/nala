# Nala: Roadmap Tentativo -- Sistema PyME Moderno para Venezuela

> Mayo 2026. Analisis tentativo. Pendiente de revision y aprobacion.
> Referencia: Treinta (Colombia, $46M Series A, 7M+ usuarios), Fina (Venezuela).

---

## Posicionamiento

**Nala es un sistema de gestion para PyMEs venezolanas con tienda online y WhatsApp integrado.**

No es un ERP fiscal (no compite con Saint/Profit/Hybrid). No es una app para solopreneurs (eso es novaincs). Es el sistema que usa un negocio de 2-15 personas que quiere organizarse, vender online, y comunicarse con sus clientes por WhatsApp de forma profesional.

### Diferencia con novaincs

| | novaincs | Nala |
|---|---------|------|
| **Target** | Solopreneur, vendedor Instagram, <200 items | PyME, 2-15 personas, 200-2000 items |
| **Foco** | Catalogo visual + AI images + WhatsApp conversacional | Gestion operativa + storefront + WhatsApp transaccional |
| **Complejidad** | Minima (como Instagram) | Media (como Treinta/Fina pero moderno) |
| **Storefront** | PWA basica con AI images | PWA completa con checkout, pedidos, dark mode |
| **AI** | Agentes autonomos (venta, contenido, finanzas) | OCR facturas, tasa BCV auto, asistente basico |
| **Precio** | $0-15/mes | $15-30/mes |

---

## Referencia: Que hace Treinta (y que podemos aprender)

Treinta ($46M Series A, YC W21, 7M+ usuarios en LATAM) es la referencia mas cercana. Sus features:

### Lo que Treinta hace bien (y Nala deberia tener)
- **Ingesta de datos ultra-simple**: agregar producto = nombre + precio + foto. 3 campos. No 15
- **Venta en 2 toques**: tap producto, tap cobrar. Sin pasos intermedios
- **Fiado con recordatorio WhatsApp**: "Maria te debe $15" -> boton -> WhatsApp se abre con mensaje
- **Catalogo virtual compartible**: link que el cliente abre sin instalar nada
- **Estadisticas simples**: "hoy vendiste $X, esta semana $Y, este mes $Z". No 10 reportes
- **Restaurantes**: mesas, comandas, propinas, division de cuentas
- **Funciona offline**: registra y sincroniza despues
- **Onboarding en 5 minutos**: sin tutorial, sin configuracion compleja

### Lo que Treinta NO tiene (y es oportunidad para Nala)
- **Tienda online PWA real** (Treinta tiene "catalogo virtual" basico, no checkout completo)
- **WhatsApp API real** (Treinta usa links manuales, igual que Nala hoy)
- **OCR de facturas** (Treinta no tiene)
- **Tasa BCV automatica** (Treinta es colombiana, no maneja bimoneda)
- **IGTF automatico** (especifico Venezuela)
- **Pedidos online con flujo completo** (pending -> confirmed -> delivered)
- **Comprobante de pago con upload** (Treinta no tiene)

---

## Que esta sobredimensionado en Nala hoy

### Eliminar (no aporta valor, agrega complejidad)

| Feature | Tabla(s) | Razon |
|---------|---------|-------|
| Segmentos de clientes | `customerSegments` | CRM enterprise. 0% uso. Un PyME no segmenta |
| Unidades de medida | `unitsOfMeasure` | Sobreingenieria. Nadie convierte cajas a unidades |
| Cuentas bancarias | `bankAccounts` | El vendedor sabe sus cuentas. No necesita registrarlas |
| Preferencias de notificacion | `notificationPreferences` | No hay notificaciones reales implementadas |
| Tipos de recargo | `surchargeTypes` | Delivery fee ya esta en store_settings. Propinas se manejan en POS |
| Historial de precios | `priceHistory` | Se genera pero nadie lo consulta. Eliminar UI, mantener tabla |
| Offline sales queue | `useOfflineQueue` composable | Complejidad alta, uso ~0% |
| Product cache agresivo | `useProductCache` (1000 items) | Innecesario con buena conexion |
| Catalogo duplicado | `/catalogo/[slug]` pagina | Duplica el storefront `/tienda` |
| 10 paginas de reportes | 10 archivos .vue | Consolidar en 1 pagina con tabs |

### Simplificar

| Feature | Hoy | Deberia ser |
|---------|-----|-------------|
| Crear producto | 15+ campos en formulario | 4 campos: nombre, precio, stock, foto. El resto opcional/expandible |
| Reportes | 10 paginas separadas | 1 pagina con 3 tabs: Resumen, Ventas, Inventario |
| Settings | 7 sub-paginas | 1 pagina con secciones colapsables |
| Contabilidad | Pagina dedicada con asientos | Automatica e invisible. Sin UI dedicada |
| Proveedores | CRUD completo con pagina | Solo nombre en OCR. Sin pagina dedicada |

---

## Features nuevos y modernos para Venezuela 2026

### 1. Ingesta de datos por voz (Groq Whisper)
- El vendedor dice "agregar 10 harina pan a 1.50" y el producto se crea/actualiza
- Usa Groq Whisper (ya en el stack de novaincs) para transcripcion ultra-rapida
- Parsing con GPT-4o-mini para extraer: accion, producto, cantidad, precio
- **Por que es novedoso**: Ningun sistema en Venezuela tiene input por voz. El vendedor tiene las manos ocupadas (mostrador, cocina, almacen)

### 2. WhatsApp transaccional real (Cloud API)
- Notificacion automatica al vendedor cuando llega pedido
- Confirmacion automatica al cliente cuando se confirma pedido
- Recordatorio de fiado automatico ("Hola Maria, tienes $15 pendientes")
- Resumen diario al vendedor ("Hoy vendiste $450, 23 ventas")
- **Costo**: ~$0.008/msg utility en LATAM. 20 pedidos/dia = ~$5/mes
- **Por que es novedoso**: Ni Fina, ni Treinta, ni Saint tienen WhatsApp API real

### 3. Tasa BCV auto-fetch + IGTF automatico
- Jalar tasa BCV automaticamente cada dia (ya existe el scraper, solo falta automatizar)
- Calcular IGTF (3%) automaticamente en ventas en divisas
- Mostrar precio en Bs y USD en todo el sistema
- **Por que importa**: Obligatorio en Venezuela. Fina lo tiene. Nala deberia tenerlo

### 4. Scan-to-add (camara como input principal)
- Escanear barcode para agregar producto al ticket POS (ya existe basico)
- Escanear barcode para buscar producto en inventario
- Escanear factura del proveedor con OCR (ya existe)
- **Mejorar**: hacer el scanner mas fluido, con feedback haptico y sonido

### 5. Link de pago compartible
- Generar link unico por venta/pedido: `nala.app/pay/abc123`
- El cliente abre, ve el monto, los datos de Pago Movil/Binance/Zelle
- Sube comprobante de pago desde el mismo link
- El vendedor recibe notificacion por WhatsApp cuando el cliente paga
- **Por que es novedoso**: Ni Treinta ni Fina tienen esto. Es como un "mini-checkout" sin necesidad de storefront

### 6. Recetas/composicion (restaurantes)
- Crear receta: "Hamburguesa = 1 pan + 1 carne + 2 tomate + 1 lechuga"
- Al vender hamburguesa, se descuentan los ingredientes automaticamente
- Calcular costo real del plato basado en ingredientes
- **Referencia**: Treinta lo tiene para restaurantes. Es un diferenciador clave

### 7. Multi-usuario con roles
- Owner: todo
- Manager: todo menos config de negocio y anulaciones
- Cashier: vender, ver inventario, ver pedidos
- Invitacion por link o codigo (no Clerk Organizations)
- **Por que importa**: Un PyME de 5 personas necesita esto. Hoy es single-user

### 8. Dashboard inteligente con sugerencias
- "Tienes 3 productos con stock critico" -> tap -> ir a inventario
- "5 clientes te deben mas de $50" -> tap -> enviar cobro por WhatsApp
- "Vendiste 30% menos que la semana pasada" -> tap -> ver detalle
- No es AI autonoma (eso es novaincs). Son reglas simples con datos reales
- **Por que es novedoso**: Fina y Treinta tienen dashboards estaticos. Nala sugiere acciones

### 9. Notas de entrega / Comprobante de venta
- Documento basico post-venta (no factura fiscal)
- Nombre del negocio, fecha, items, total, metodo de pago
- Compartible por WhatsApp como imagen o PDF
- **Por que importa**: El cliente quiere un comprobante. Hoy solo existe PDF receipt

### 10. Import inteligente (Google Sheets + foto de lista)
- Import desde Google Sheets (ya planificado en novaincs via MCP)
- Import desde foto de lista de precios (OCR + parsing)
- El vendedor toma foto de la lista del proveedor -> se crean/actualizan productos
- **Por que es novedoso**: Nadie tiene import por foto. Es el OCR de facturas aplicado a listas de precios

---

## Buyer Persona ajustado

### Principal: Roberto -- Dueno de PyME (60% del target)

- **Edad:** 30-50 anos
- **Negocio:** Mini-market, ferreteria pequena, restaurante, distribuidora, tienda de repuestos
- **Productos:** 200-1000 items
- **Empleados:** 2-10 personas (cajeros, despachadores, cocineros)
- **Facturacion:** $2,000-$15,000 USD/mes
- **Dispositivo:** Android gama media + computadora en el mostrador
- **Hoy usa:** Fina, Excel, cuaderno, o Saint viejo sin actualizar
- **Dolor:** "Necesito organizarme pero los sistemas son complicados o caros"
- **Quiere:** Control sin complejidad. Ver numeros claros. Que sus clientes le pidan facil

### Secundario: Ana -- Administradora/Contadora (30% del target)

- **Rol:** Lleva las cuentas de 1-3 negocios del mismo dueno
- **Necesita:** Reportes claros, control de gastos, cierre de caja, historial
- **Hoy usa:** Excel + Fina + WhatsApp para coordinar con el dueno
- **Dolor:** "Paso horas consolidando datos de diferentes fuentes"

### Terciario: Carlos -- Comerciante pequeno (10% del target)

- **Mismo perfil del doc 43** (bodega, panaderia, <200 items)
- **Usa Nala en modo simple** (POS + inventario + storefront)
- **No necesita multi-usuario ni recetas**

---

## Diferenciadores vs competencia

| Feature | Treinta | Fina | Saint | Nala (propuesto) |
|---------|---------|------|-------|-----------------|
| POS movil | Si | Si | No | Si |
| Inventario | Si | Si | Si | Si |
| Fiado + cobro WhatsApp | Si (link) | Si (link) | No | **Si (API real)** |
| Tienda online PWA | Basico | No | No | **Completa** |
| WhatsApp API real | No | No | No | **Si** |
| OCR facturas | No | No | No | **Si** |
| Input por voz | No | No | No | **Si** |
| Link de pago compartible | No | No | No | **Si** |
| Import por foto | No | No | No | **Si** |
| Recetas (restaurantes) | Si | No | No | **Si** |
| Multi-usuario | Si | Si | Si | **Si** |
| Tasa BCV auto | N/A | Si | Si | **Si** |
| IGTF | N/A | No | Si | **Si** |
| Homologacion SENIAT | N/A | No | Si | No |
| Dark mode storefront | No | No | No | **Si** |
| Sugerencias inteligentes | No | No | No | **Si** |

---

## Fases de ejecucion (tentativo)

### Fase 1 -- Limpiar y robustecer (2 semanas)
- Eliminar features sobredimensionados (tablas, paginas, composables)
- Consolidar reportes en 1 pagina
- Simplificar formulario de producto (4 campos core + expandible)
- Agregar IGTF automatico + tasa BCV auto-fetch
- Validacion de precios server-side + paginacion catalogo

### Fase 2 -- WhatsApp real + Link de pago (3 semanas)
- WhatsApp Cloud API integration
- Templates: pedido nuevo, confirmacion, recordatorio fiado, resumen diario
- Link de pago compartible con upload de comprobante

### Fase 3 -- Multi-usuario + Roles (2 semanas)
- Owner, Manager, Cashier
- Invitacion por link

### Fase 4 -- Input moderno (3 semanas)
- Voz-to-data (Groq Whisper + GPT-4o-mini parsing)
- Import por foto de lista de precios
- Barcode scanner mejorado

### Fase 5 -- Restaurantes + Recetas (2 semanas)
- Composicion de productos (receta = ingredientes)
- Descuento automatico de ingredientes al vender

### Fase 6 -- Personalizacion storefront (2 semanas)
- Color de marca + logo
- Dominio custom

---

## Nota sobre costos

| Servicio externo | Costo estimado | Uso |
|-----------------|---------------|-----|
| WhatsApp Cloud API | ~$5-15/mes por negocio | Notificaciones transaccionales |
| Groq Whisper | ~$0.001/transcripcion | Input por voz |
| GPT-4o-mini (OCR + parsing) | ~$0.005-0.01/request | OCR facturas, parsing voz, import foto |
| Clerk auth | $0 (free tier 10K MAU) | Autenticacion |
| Hetzner hosting | $8.49/mes (CX32) | Soporta 50-100 negocios |

Costo total de infraestructura para 100 negocios: ~$60-80/mes.
Revenue a 100 negocios x $20/mes promedio: $2,000/mes.
Margen: ~96%.
