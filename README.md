# Nala

Backoffice operativo para comerciantes y PyMEs. Fácil como un cuaderno, potente como un ERP, inteligente como un socio que sabe de números.

## Qué es Nala

Nala es el sistema nervioso central de un negocio pequeño. Ventas, inventario, clientes, cuentas, reportes y contabilidad en un solo lugar. Funciona en escritorio, en el celular y por WhatsApp. Funciona sin internet. Tiene inteligencia integrada en cada pantalla que le dice al dueño qué hacer sin que pregunte.

No es un POS. No es un software contable. No es un CRM. Es el backoffice completo que conecta todo lo que un comerciante necesita para operar su negocio día a día.

## Para quién es

El dueño-operador: la persona que abre el negocio a las 6am, atiende clientes, cuenta inventario, cobra deudas, paga al proveedor y cierra caja a las 8pm. Ferreterías, tiendas de ropa, autopartes, peluquerías, bodegas, farmacias, tiendas de electrónica, librerías, cosméticos, distribuidoras de alimentos. PyMEs de 1 a 30 empleados en mercados emergentes, empezando por Venezuela. No restaurantes (la complejidad de mesas, recetas y cocina requiere un producto vertical dedicado).

## Por qué existe

Los sistemas administrativos actuales en este mercado son de dos tipos: demasiado simples (un cuaderno digital sin inteligencia) o demasiado complejos (ERPs que nadie entiende). Nala es potente porque es fácil de usar, no a pesar de serlo.

## Principios de diseño

- **Producto completo, experiencia simple.** Todas las capacidades de un sistema profesional. Cada feature presentado de la forma más simple posible. La potencia está disponible, no impuesta.
- **Offline-first.** Los datos viven en el dispositivo. Se sincronizan cuando hay conexión. El usuario nunca ve un spinner de carga ni un error de red.
- **Inteligencia en cada pantalla.** La IA no es un módulo. Está integrada en inventario, ventas, clientes, reportes y cuentas. El usuario ve resultados, no algoritmos.
- **Tres formas de acceso.** Escritorio (experiencia completa), móvil (misma funcionalidad, layout adaptado), WhatsApp (consultas rápidas, ventas simples, cobros). Ninguna es secundaria.

## Qué hace

### Vender
Registro de venta en 3-4 toques. Funciona offline. 7 métodos de pago (efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado). Seguimiento de vendedores. Descuentos por línea y por ticket. Escaneo de código de barras con la cámara. Cotizaciones con envío por WhatsApp.

### Saber cuánto tengo
Inventario con variantes (talla, color, referencia, modelo). Fechas de vencimiento. Semáforo de stock (verde, amarillo, rojo, gris). Predicción de agotamiento por producto. Análisis de rentabilidad (margen, rotación, score). Detección de productos muertos. Importación desde Excel. Conteo físico con escáner.

### Saber cuánto me deben y debo
Cuentas por cobrar y por pagar con código de color por antigüedad. Cobro por WhatsApp en un toque. Conciliación básica de pagos. Alertas predictivas de flujo de caja.

### Saber cómo me fue
Dashboard con ventas del día y comparativa automática. 7 reportes pre-construidos con gráficos, tablas y narrativa generada por IA. Resumen diario y semanal automático. Exportación PDF y Excel. Todos los montos en USD y Bs. con tasa BCV automática.

### Cobrar y comunicar
Cobros por WhatsApp con mensaje personalizado. Campañas por segmento de clientes. Envío de recibos digitales. Recordatorios automáticos. Catálogo de productos compartible por WhatsApp.

### Conocer a mis clientes
Perfil automático con historial de compras, frecuencia, ticket promedio, productos favoritos y saldo. Segmentos automáticos (VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos). Badges visuales en toda la app.

### Controlar el negocio
2 roles: Dueño (ve todo, configura todo) y Empleado (solo vende y consulta, no ve costos ni reportes financieros). Cada usuario con PIN propio para accountability. Log de actividad completo. Gamificación para vendedores (ranking, metas, rachas). Cierre de día automático con cuadre de caja. 2FA por email. Backups automáticos.

### Contabilidad (puente al contador)
Nala no es un sistema contable. Es un puente: genera la información que el contador necesita en el formato que su sistema entiende. Exportación automática en Excel con formato de libro diario (fecha, cuenta, debe, haber). Catálogo de cuentas pre-configurado por tipo de negocio que el contador ajusta una vez. Botón "Enviar al contador" que genera el paquete (ventas, gastos, P&L) y abre WhatsApp con el archivo. Libros de compras y ventas en formato SENIAT.

### WhatsApp bidireccional
**Salida:** Resúmenes diarios, alertas, cobros a clientes, reportes al contador, campañas, recibos.
**Entrada:** Consultar ventas, inventario, clientes. Registrar ventas simples. Actualizar precios. Lanzar cobros. Todo por chat, con confirmación antes de modificar datos. El OCR de facturas y recibos se hace desde la PWA (cámara nativa, resolución completa) porque WhatsApp comprime las imágenes y pierde calidad.

## Diferenciadores

| # | Feature | Detalle |
|---|---|---|
| 1 | WhatsApp bidireccional | Consultar, vender, cobrar y registrar gastos por chat. Sin necesidad de abrir la app |
| 2 | Foto = Dato | OCR de facturas, recibos y listas desde la cámara de la PWA (resolución completa). La foto se convierte en dato registrado |
| 3 | Cierre de día automático | Cuadre de caja, detección de discrepancias, resumen al dueño, asientos contables. Sin tocar nada |
| 4 | Benchmark anónimo | Comparar rendimiento vs negocios similares en la plataforma (datos anonimizados) |
| 5 | Asistente de compras | Genera la orden al proveedor basada en predicciones y la envía por WhatsApp |
| 6 | Historial de precios | Alerta cuando el costo sube y el margen baja. Sugiere ajuste de precio |
| 7 | Multi-moneda inteligente | Precios en USD, cobro en Bs. con tasa BCV automática. Historial de tasa por transacción |
| 8 | Gamificación | Ranking de vendedores, metas diarias, rachas, logros. Motiva sin supervisión |
| 9 | Onboarding interactivo | Aprende dentro de la app con datos reales. Sin tutoriales en video |
| 10 | Catálogo compartible | Link a página web ligera con productos y precios. El cliente pide por WhatsApp |
| 11 | Alertas predictivas de flujo de caja | Proyecta ingresos y gastos. Alerta si viene un déficit. Sugiere cobros |
| 12 | Inteligencia en cada pantalla | Predicciones, comparativas, narrativas y alertas integradas donde se necesitan |
| 13 | Offline-first | Funciona sin internet como estado normal. Sincroniza cuando hay conexión |

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Nuxt 3 (Vue), PWA offline-first |
| DB local | IndexedDB (Dexie.js) |
| Backend | Node.js, Hono/Fastify, TypeScript |
| Base de datos | PostgreSQL, pgvector |
| Cache | Redis |
| Storage | MinIO (S3-compatible) |
| IA | GPT-4o-mini / Claude Haiku |
| WhatsApp | Cloud API vía 360dialog/WhatsAble (v1), BSP propio (v2) |
| Notificaciones | Web Push API, Twilio (SMS fallback) |
| OCR | GPT-4o-mini vision (v1), PaddleOCR self-hosted (v2+ a escala) |
| Hosting | Hetzner |
| CI/CD | GitHub Actions, Coolify |

## Modelo de negocio

| Plan | Precio | Incluye |
|---|---|---|
| Gratis | $0/mes | 1 negocio, 1 usuario, 50 productos, ventas ilimitadas, offline, dashboard, inventario |
| Pro | $19/mes | 1 negocio, usuarios ilimitados (Dueño + Empleados con PIN), productos ilimitados, inteligencia, cobros WhatsApp, exportación contable, reportes completos |
| Negocio | $35/mes | Todo Pro + soporte prioritario, onboarding asistido, campañas WhatsApp, segmentación, cotizaciones. Negocios adicionales: +$15/mes cada uno |

## Roadmap

**v1.0** -- Producto completo. PWA offline-first. Ventas, inventario, clientes, cuentas, reportes, contabilidad, roles, inteligencia integrada, WhatsApp bidireccional.

**v2.0** -- Crecimiento. Integración Pago Móvil C2P. Campañas WhatsApp con segmentación. Cotizaciones con aprobación online. Programa de lealtad. Órdenes de compra a proveedores. OCR de recibos.

**v3.0** -- Escala. Multi-sucursal. API REST pública. Tienda online básica. Expansión LATAM.

## Documentación

| Documento | Contenido |
|---|---|
| [01 - Features actuales de Fina](docs/01-fina-features-actuales.md) | Inventario completo de lo que ofrece Fina hoy |
| [02 - Contexto Venezuela](docs/02-respuestas-contexto-venezuela.md) | APIs locales, WhatsApp sin Meta API, integración contable, POS descartado |
| [03 - Extras propuestos B-J](docs/03-extras-propuestos-B-a-J.md) | 38 features detallados con complejidad y prioridad |
| [04 - Consolidado de features](docs/04-todos-los-features-consolidado.md) | 102 features (51 actuales + 50 nuevos + 1 mejora) con tabla de decisión |
| [05 - Competidores y features modernos](docs/05-competidores-y-features-modernos.md) | Análisis de Square, Toast, Shopify, QuickBooks, Alegra y 12 features adicionales |
| [06 - Por qué Fina gana con menos](docs/06-por-que-fina-gana-con-menos.md) | Análisis de simplicidad, contexto Venezuela, framework de decisión |
| [07 - Visión de producto](docs/07-nala-vision-producto-2026.md) | Visión completa: experiencia escritorio/móvil, features v1.0, stack, roadmap |
| [08 - WhatsApp entrada + diferenciadores](docs/08-whatsapp-entrada-y-diferenciadores.md) | WhatsApp bidireccional, OCR, cierre automático, benchmark, 13 diferenciadores |
| [09 - Decisiones técnicas](docs/09-decisiones-tecnicas.md) | Roles (2 no 5), flujo contable, arquitectura WhatsApp en producción, OCR con GPT-4o-mini vision |
| [10 - Build vs OSS base](docs/10-build-vs-oss-base.md) | Por qué construir desde cero. Patrones de UX adoptados de ERPNext, Loyverse, Square y Fina |
| **[11 - Especificación final](docs/11-especificacion-final.md)** | **Documento definitivo: capacidades, arquitectura, modelo de datos, UX, stack, decisiones, roadmap** |
| [12 - Pipeline OCR en detalle](docs/12-ocr-pipeline-detalle.md) | Flujo completo de lectura de facturas, matching, validación, código, fallos y costos LLM |

## Licencia

Apache License 2.0. Ver [LICENSE](LICENSE).
