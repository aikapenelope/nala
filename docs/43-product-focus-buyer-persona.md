# Analisis de Producto: Enfoque y Buyer Persona

> Mayo 2026. Analisis post-auditoria para definir el enfoque correcto del producto.

---

## Que es Nala

**POS + Tienda online para comerciantes venezolanos.**

No es un ERP. No es un sistema contable. No es un CRM enterprise. Es la herramienta que reemplaza el cuaderno, las notas del celular, y el Excel del comerciante que quiere digitalizarse sin complicarse.

---

## Buyer Persona

### Carlos -- Comerciante pequeno (80% del mercado target)

- **Edad:** 28-45 anos
- **Negocio:** Bodega, panaderia, tienda de ropa, peluqueria, cafeteria, licoreria
- **Productos:** 20-200 items
- **Empleados:** Solo el (dueno-operador), maximo 1-2 ayudantes
- **Dispositivo:** Celular Android gama media (Samsung A series, Xiaomi Redmi)
- **Internet:** Movil 4G, no siempre estable pero funciona
- **Conocimiento tecnico:** Sabe usar WhatsApp, Instagram, apps basicas. No sabe que es un ERP
- **Hoy:** Lleva cuentas en cuaderno o notas del celular. Fia a clientes del barrio y a veces se le olvida. Quiere vender por internet pero no sabe como
- **Dolor principal:** "No se cuanto vendi hoy", "Se me olvido que me deben", "Quiero que me pidan por internet"
- **No necesita:** Contabilidad formal, facturacion fiscal, reportes de rentabilidad, cotizaciones, gestion de proveedores

### Maria -- Comerciante mediano (15% del mercado target)

- **Negocio:** Mini-market, tienda de repuestos, distribuidora pequena
- **Productos:** 200-500 items
- **Empleados:** 2-5 personas
- **Diferencia con Carlos:** Necesita reportes basicos, import de Excel, y control de fiado mas formal
- **Podria usar:** Modo avanzado con reportes y OCR

### Fuera de scope: Farmacia / Ferreteria grande (5%)

- 1000-5000+ SKUs
- Necesita lotes, vencimientos, regulaciones SENIAT, multi-almacen
- **Nala no compite aqui.** Estos clientes necesitan Profit Plus, Valery, Saint, o lo que Fina va a ofrecer

---

## Que tiene Nala hoy vs que necesita el cliente

### Core (lo que Carlos usa todos los dias)

| Feature | Estado | Valor para Carlos |
|---------|--------|-------------------|
| POS (vender rapido) | Solido | Critico -- reemplaza el cuaderno |
| Inventario (productos + semaforo stock) | Solido | Alto -- "que se me esta acabando" |
| Storefront PWA (tienda online) | Solido | Alto -- "que me pidan por internet" |
| Pedidos (gestionar pedidos del storefront) | Solido | Alto -- complemento del storefront |
| Clientes + fiado | Solido | Alto -- "quien me debe" |
| Dashboard (ventas hoy) | Solido | Alto -- "cuanto vendi" |
| Tasa BCV | Solido | Critico -- Venezuela |
| Configuracion basica | Solido | Necesario |

### Automatico (funciona sin que Carlos lo vea)

| Feature | Estado | Nota |
|---------|--------|------|
| Asientos contables | Funcional | Se generan solos en cada venta. Nadie los consulta |
| Historial de precios | Funcional | Se registra solo al cambiar precio |
| Stock movements | Funcional | Se registra solo en ventas y ajustes |
| Auto-cancel pedidos stale | Funcional | Piggyback en polling de 30s |
| Cache Redis catalogo | Funcional | Transparente para el usuario |

### Avanzado (util para Maria, no para Carlos)

| Feature | Estado | Accion |
|---------|--------|--------|
| Reportes detallados (10 tipos) | Funcional | Esconder. Mostrar solo con toggle avanzado |
| OCR facturas | Funcional | Esconder. Feature "beta" para usuarios avanzados |
| Import Excel | Funcional | Esconder. Util para migracion inicial |
| Cotizaciones | Funcional | Esconder. Feature de ERP |
| Proveedores | Funcional | Esconder. Solo se usa en OCR |
| Cuentas por pagar | Funcional | Esconder. Feature contable |
| Contabilidad (UI) | Funcional | Esconder. Los asientos se generan solos |
| Cierre de caja | Funcional | Esconder. No todos manejan caja formal |
| Historial de ventas | Funcional | Mantener visible (es util) |

### Eliminable (nadie lo usa)

| Feature | Razon |
|---------|-------|
| Segmentos de clientes | Feature de CRM enterprise. 0% de uso |
| Offline sales queue | Edge case. Internet es estable en zonas urbanas |

---

## Navegacion simplificada

### Sidebar desktop (7 items core)

1. Inicio (dashboard)
2. Vender (POS)
3. Pedidos (storefront orders)
4. Tienda Online (storefront config)
5. Inventario (productos + stock)
6. Clientes (CRM basico + fiado)
7. Configuracion

**Seccion "Herramientas" (colapsada por defecto):**
- Historial de ventas
- Cuentas (por cobrar)
- Cierre de caja
- Reportes
- Gastos / OCR
- Proveedores
- Cotizaciones

### Mobile bottom tabs (5 items)

1. Inicio
2. Vender
3. Pedidos
4. Inventario
5. Mas (acceso a todo lo demas)

### Pagina "Mas" simplificada

**Seccion principal:**
- Tienda Online
- Clientes
- Historial de ventas
- Configuracion

**Seccion "Herramientas" (separada visualmente):**
- Cuentas
- Cierre de caja
- Reportes
- Gastos / OCR
- Proveedores
- Cotizaciones

---

## Limites del producto

| Recurso | Limite recomendado | Razon |
|---------|-------------------|-------|
| Productos por negocio | 500 (soft warning a 400) | Rendimiento del catalogo publico sin paginacion |
| Items por pedido storefront | 50 | Razonable para bodega/tienda |
| Items en carrito PWA | 50 | Memoria del browser |
| Categorias | 50 | UX de filtros |
| Clientes | 2000 | Query performance |
| Ventas/mes | Sin limite | Paginadas, no hay problema |
| Batch import | 500 por archivo | Timeout de transaccion |

---

## Posicionamiento vs competencia

| Producto | Target | Precio | Nala compite? |
|----------|--------|--------|---------------|
| Cuaderno / Excel | Todos | $0 | Si -- Nala es el upgrade |
| WhatsApp Business | Todos | $0 | Si -- Nala agrega POS + inventario |
| Fina | Mediano-grande | $50-100/mes | No -- Fina va a facturacion fiscal |
| Profit Plus | Grande | $100-300/mes | No -- ERP completo |
| Shopify | E-commerce puro | $29-79/mes | Parcial -- Nala es POS + tienda, no solo tienda |
| Square (EEUU) | Pequeno | $0-60/mes | Referencia -- modelo similar pero para Venezuela |

**Nala es para el que NO quiere un ERP.** El primer paso digital del comerciante. Cuando crece y necesita facturacion fiscal, se va a Fina. Pero los primeros 2-3 anos, Nala es perfecto.

---

## Costo computacional por tipo de cliente

### Bodega (100 productos, 20 ventas/dia) -- IDEAL
- CPU: Minimo. Queries simples, cache efectivo
- RAM: ~50MB por conexion activa
- Storage: ~10MB/mes (ventas + logs)
- Redis: ~1MB cache
- Costo Hetzner: Soporta 50+ negocios de este tipo en un cx33

### Mini-market (400 productos, 80 ventas/dia) -- VIABLE
- CPU: Bajo. Queries un poco mas pesadas, reportes tardan ~200ms
- RAM: ~80MB por conexion activa
- Storage: ~40MB/mes
- Redis: ~5MB cache
- Costo Hetzner: Soporta 20+ negocios de este tipo en un cx33

### Farmacia (2000 productos, 200 ventas/dia) -- NO VIABLE SIN CAMBIOS
- CPU: Alto. Catalogo sin paginacion = query de 500ms+. Reportes = 1-2s
- RAM: ~200MB por conexion activa (JSON grande en memoria)
- Storage: ~150MB/mes
- Redis: ~20MB cache
- Costo Hetzner: Maximo 5 negocios de este tipo en un cx33
- **Requiere:** Paginacion, virtual scrolling, sync incremental, queries optimizadas
