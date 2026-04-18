# Nova: Gap Analysis para Homologacion SENIAT

> Referencia: PA SNAT/2024/000102 (facturacion digital) y PA SNAT/2024/000121 (homologacion de proveedores)
> Vigencia obligatoria: 1 de marzo de 2025
> Fecha de analisis: Abril 2026

---

## Resumen

La homologacion SENIAT tiene dos componentes: lo que el **software** debe hacer (PA 000102) y lo que el **proveedor** debe cumplir (PA 000121). Este documento analiza ambos y mapea que tiene Nova, que falta, y que se necesita para cerrar los gaps.

---

## 1. Requisitos del Software (PA 000102)

### 1.1 Campos obligatorios de la factura digital

| Campo requerido | Nova tiene? | Notas |
|---|---|---|
| Denominacion "Factura" (o tipo de documento) | SI | `documentType`: invoice, credit_note |
| Numero de factura consecutivo | SI | `controlNumber` auto-incremental por negocio (PR #114) |
| Numero de control fiscal (asignado por imprenta digital) | NO | Este numero lo asigna la **imprenta digital autorizada**, no el software. Nova necesita un campo para almacenarlo |
| RIF del emisor | PARCIAL | `businesses` no tiene campo RIF. Solo tiene `name`, `type`, `phone`, `address` |
| Nombre/razon social del emisor | SI | `businesses.name` |
| Direccion fiscal del emisor | SI | `businesses.address` |
| RIF del receptor (cliente) | NO | `customers` no tiene campo RIF |
| Nombre del receptor | SI | `customers.name` |
| Direccion del receptor | SI | `customers.address` |
| Fecha y hora de emision | SI | `sales.createdAt` con timezone |
| Descripcion del producto/servicio | SI | `products.name` + `description` |
| Cantidad | SI | `saleItems.quantity` |
| Precio unitario | SI | `saleItems.unitPrice` |
| Base imponible (subtotal antes de IVA) | SI | `sales.subtotalUsd` (PR #112) |
| Alicuota de IVA aplicada | SI | `saleItems.taxRate` (0%, 8%, 16%) (PR #112) |
| Monto del IVA | SI | `sales.taxAmount` + `saleItems.taxAmount` (PR #112) |
| Descuentos | SI | `discountPercent` + `discountAmount` (PR #112) |
| Total | SI | `sales.totalUsd` |
| IGTF (si aplica) | SI | `sales.igtfAmount` (PR #114) |
| Datos de la imprenta digital autorizada | NO | No hay campo para esto |
| Mencion de cumplimiento con PA 000102 | NO | Texto legal en el pie de la factura |

### 1.2 Tipos de documentos fiscales

| Documento | Nova tiene? | Notas |
|---|---|---|
| Factura | SI | `documentType: 'invoice'` |
| Nota de credito | SI | `documentType: 'credit_note'` (PR #112) |
| Nota de debito | NO | Falta agregar `debit_note` como tipo |
| Orden de entrega / guia de despacho | NO | No aplica para POS retail |
| Comprobante de retencion | NO | Falta modulo de retenciones |

### 1.3 Libros fiscales

| Libro | Nova tiene? | Notas |
|---|---|---|
| Libro de ventas | SI | Export Excel con formato libro de ventas |
| Libro de compras | SI | `GET /reports/purchase-book` (PR #114) |
| Separacion maquina fiscal vs digital | NO | No aplica (Nova no usa maquinas fiscales) |

---

## 2. Requisitos del Proveedor (PA 000121)

### 2.1 Requisitos tecnicos del sistema (Art. 3)

| Requisito | Nova cumple? | Gap |
|---|---|---|
| Integridad de registros | SI | RLS + transacciones atomicas |
| Continuidad del servicio | PARCIAL | Offline queue existe, pero no hay SLA formal |
| Confiabilidad | SI | PostgreSQL + Redis + backups Hetzner |
| Conservacion de datos | PARCIAL | No hay politica de retencion de 10 anos |
| Accesibilidad | SI | API REST + web app |
| Legibilidad | SI | Reportes en PDF/Excel |
| Trazabilidad | SI | `activityLog` + `stockMovements` (PR #114) |
| Inalterabilidad | PARCIAL | Las ventas completadas no se editan (solo void/NC), pero no hay hash criptografico |
| Inviolabilidad | PARCIAL | RLS previene acceso entre tenants, pero no hay cifrado de datos en reposo |
| Transmision automatica al SENIAT | NO | No hay integracion con SENIAT. Es el gap mas grande |
| Logging de eventos en tiempo real | SI | `structuredLogger` + `activityLog` |
| Correcciones solo via NC/ND | SI | Void requiere PIN del dueno, NC restaura stock |
| Timestamps correctos en todos los registros | SI | `createdAt` con timezone en todas las tablas |
| Cumplimiento de Ley IVA | SI | IVA 0/8/16% implementado (PR #112) |
| Cumplimiento de normativa de facturacion | PARCIAL | Faltan campos RIF y datos de imprenta digital |
| Clave de consulta para SENIAT | NO | No hay acceso de auditoria para SENIAT |

### 2.2 Requisitos del proveedor (Art. 4)

| Requisito | Estado | Notas |
|---|---|---|
| Domiciliado en Venezuela | PENDIENTE | Requiere entidad legal en Venezuela |
| Solicitud ante Intendencia Nacional de Tributos Internos | PENDIENTE | Proceso administrativo |
| Expediente tecnico (lenguaje, BD, herramientas) | LISTO | TypeScript, PostgreSQL, Hono, Nuxt |
| Manuales de usuario y tecnico digitalizados | NO | No hay manuales formales |
| Declaracion jurada de no impedimentos (Art. 7) | PENDIENTE | Proceso legal |

### 2.3 Evaluacion tecnica (Art. 5)

El SENIAT realiza una evaluacion tecnica presencial del sistema. Esto requiere:
- Demo funcional del sistema completo
- Acceso a la base de datos para verificacion
- Documentacion de arquitectura y seguridad

---

## 3. Gaps criticos para homologacion

### Nivel 1: Campos faltantes en el software (implementables)

| # | Gap | Complejidad | Descripcion |
|---|-----|-------------|-------------|
| 1 | **RIF del negocio** | Baja | Agregar campo `rif` a tabla `businesses` |
| 2 | **RIF del cliente** | Baja | Agregar campo `rif` a tabla `customers` |
| 3 | **Numero de control de imprenta digital** | Baja | Campo `fiscalControlNumber` en `sales` (asignado por imprenta externa) |
| 4 | **Datos de imprenta digital** | Baja | Campos en `businesses`: `digitalPrinterId`, `digitalPrinterName` |
| 5 | **Nota de debito** | Baja | Agregar `debit_note` como `documentType` |
| 6 | **Texto legal PA 000102** | Baja | Incluir en el PDF de factura |

### Nivel 2: Funcionalidades faltantes (requieren desarrollo)

| # | Gap | Complejidad | Descripcion |
|---|-----|-------------|-------------|
| 7 | **Transmision automatica al SENIAT** | Alta | API/protocolo no publicado por SENIAT aun. Requiere integracion cuando se defina |
| 8 | **Integracion con imprenta digital** | Alta | La imprenta digital asigna el numero de control fiscal. Requiere API con el proveedor de imprenta |
| 9 | **Acceso de auditoria SENIAT** | Media | Endpoint o portal de consulta para fiscalizadores del SENIAT |
| 10 | **Retencion de datos 10 anos** | Media | Politica de backup y archivado a largo plazo |
| 11 | **Hash de integridad** | Media | Hash SHA-256 de cada factura para garantizar inalterabilidad |
| 12 | **Manuales de usuario** | Media | Documentacion formal del sistema |

### Nivel 3: Requisitos del proveedor (no son de software)

| # | Gap | Tipo | Descripcion |
|---|-----|------|-------------|
| 13 | Entidad legal en Venezuela | Legal | Registro mercantil, RIF de la empresa proveedora |
| 14 | Solicitud formal ante SENIAT | Administrativo | Expediente con documentos legales |
| 15 | Evaluacion tecnica presencial | Operativo | Demo ante funcionarios de Fiscalizacion + TI del SENIAT |
| 16 | Declaracion jurada | Legal | Cumplimiento de Art. 7 (no impedimentos) |

---

## 4. Lo que Nova YA tiene alineado

Nova cubre aproximadamente el **70% de los requisitos tecnicos** del software:

- IVA con alicuotas 0/8/16% (PR #112)
- IGTF 3% en pagos en divisas (PR #114)
- Numeros de control secuenciales por negocio (PR #114)
- Notas de credito con restauracion de stock (PR #112)
- Libro de ventas y libro de compras (PR #114)
- Trazabilidad completa (activity log + stock movements)
- Moneda dual VES/USD con tasa BCV
- Timestamps con timezone en todos los registros
- Correcciones solo via void (con PIN) o nota de credito

---

## 5. Ruta hacia la homologacion

### Fase 1: Campos faltantes (1-2 dias de desarrollo)
Agregar RIF a businesses y customers, campo de control fiscal de imprenta, nota de debito. Esto cierra los gaps de Nivel 1.

### Fase 2: Integracion con imprenta digital (cuando haya proveedor)
La imprenta digital es un servicio externo autorizado por el SENIAT que asigna el numero de control fiscal. Nova necesita integrarse via API con al menos una imprenta digital. Los proveedores conocidos incluyen:
- Galac (galac.com)
- The Factory HKA
- Otros listados en el portal del SENIAT

### Fase 3: Transmision al SENIAT (cuando se publique el protocolo)
El SENIAT aun no ha publicado el protocolo tecnico para la transmision automatica de datos. Cuando lo haga, Nova necesitara implementar el endpoint de envio.

### Fase 4: Proceso administrativo de homologacion
- Constituir entidad legal en Venezuela (si no existe)
- Preparar expediente tecnico
- Solicitar evaluacion ante la Intendencia Nacional de Tributos Internos
- Pasar evaluacion tecnica presencial
- Obtener autorizacion

---

## 6. Nota importante

La homologacion SENIAT es un **proceso administrativo**, no solo tecnico. Muchos de los requisitos son legales y operativos (entidad en Venezuela, declaracion jurada, evaluacion presencial). El software puede estar 100% listo tecnicamente y aun asi no estar homologado hasta completar el proceso administrativo.

Los gaps de Nivel 1 (campos faltantes) son triviales de implementar. Los gaps de Nivel 2 dependen de terceros (imprenta digital, protocolo SENIAT). Los gaps de Nivel 3 son puramente administrativos/legales.

**Recomendacion:** Implementar los gaps de Nivel 1 ahora, iniciar conversaciones con proveedores de imprenta digital para Nivel 2, y preparar la documentacion legal para Nivel 3 en paralelo.
