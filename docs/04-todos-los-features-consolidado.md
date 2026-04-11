# Fina - Todos los Features (Consolidado)

> Lista unificada de TODOS los features: los que Fina ya tiene (marcados con ACTUAL) y los que se proponen agregar (marcados con NUEVO). Este documento sirve como base para decidir cuáles quedan en la versión definitiva.

---

## Leyenda

- **[ACTUAL]** = Ya existe en Fina hoy
- **[NUEVO]** = Propuesto para agregar
- **[MEJORAR]** = Existe pero necesita mejoras significativas

---

## A. Dashboard y Vista General

| # | Feature | Estado | Detalle |
|---|---|---|---|
| A1 | Dashboard en tiempo real | [ACTUAL] | Estadísticas de facturación, ganancia mensual, alertas de inventario bajo, cuentas por cobrar/pagar |
| A2 | Dashboards personalizables (drag-and-drop) | [NUEVO] | El usuario elige qué widgets ver: ventas del día, top productos, inventario bajo, cuentas vencidas, ganancia neta, comparativa mensual, ventas por hora, ventas por día de la semana |
| A3 | KPIs configurables | [NUEVO] | Ticket promedio, rotación de inventario, margen bruto, días de inventario, tasa de conversión, clientes activos |
| A4 | Comparativas periodo vs periodo | [NUEVO] | Mes vs mes anterior, mes vs mismo mes año pasado, semana vs semana anterior, rango personalizado |

---

## B. Inventario

| # | Feature | Estado | Detalle |
|---|---|---|---|
| B1 | Seguimiento por talla, color, referencia | [ACTUAL] | Productos organizados por variantes |
| B2 | Control de fechas de vencimiento | [ACTUAL] | Para productos alimenticios y perecederos |
| B3 | Inventario por modelo/referencia | [ACTUAL] | Para autopartes, ferreterías, hardware |
| B4 | Descuento automático de ingredientes por receta | [ACTUAL] | Al vender un plato, los ingredientes se descuentan del inventario automáticamente |
| B5 | Importación/exportación Excel y PDF | [ACTUAL] | Carga y descarga masiva de datos de inventario |
| B6 | Alertas automáticas de inventario bajo | [ACTUAL] | Notificación cuando un producto baja del mínimo configurado |
| B7 | Predicción de demanda con IA | [NUEVO] | Algoritmo de series temporales que predice agotamiento y sugiere cuándo/cuánto reordenar. Considera estacionalidad y tendencias. Requiere mínimo 3 meses de historial |
| B8 | Análisis de rentabilidad por producto | [NUEVO] | Margen bruto, rotación, contribución al ingreso, días en inventario, score de rentabilidad. Alertas: productos muertos, productos estrella, margen negativo |
| B9 | Escáner de código de barras | [NUEVO] | Usar cámara del celular para escanear y buscar/agregar productos. Entrada rápida al inventario, búsqueda al vender, conteo físico |
| B10 | Detección de anomalías en inventario | [NUEVO] | Alertas: inventario que baja sin venta registrada, ajustes manuales sospechosos, movimientos inusuales |

---

## C. Ventas

| # | Feature | Estado | Detalle |
|---|---|---|---|
| C1 | Registro de ventas | [ACTUAL] | Registro básico de transacciones de venta |
| C2 | Gestión de mesas | [ACTUAL] | Para restaurantes: asignar pedidos a mesas |
| C3 | Seguimiento de repartidores | [ACTUAL] | Control de entregas a domicilio |
| C4 | Control de mesoneros y vendedores | [ACTUAL] | Seguimiento de quién atiende cada venta |
| C5 | Detección de anomalías en ventas | [NUEVO] | Alertas: ventas con montos inusuales, anulaciones excesivas, descuentos fuera de rango, patrones sospechosos por cajero |
| C6 | QR para pagos | [NUEVO] | Generar código QR por transacción. Cliente escanea con app bancaria o Binance. Confirmación automática |
| C7 | Modo offline para ventas | [NUEVO] | Registrar ventas sin internet. Cola de sincronización automática cuando vuelve la conexión. Indicador visual de estado |
| C8 | Comprobante digital por WhatsApp | [NUEVO] | Enviar recibo de venta al cliente vía link wa.me con mensaje prellenado |

---

## D. Cuentas y Finanzas

| # | Feature | Estado | Detalle |
|---|---|---|---|
| D1 | Gestión de cuentas bancarias y caja | [ACTUAL] | Control de saldos en bancos y efectivo |
| D2 | Cuentas por cobrar y por pagar | [ACTUAL] | Seguimiento de deudas de clientes y proveedores |
| D3 | Soporte Bs. y USD | [ACTUAL] | Manejo de bolívares y dólares |
| D4 | Múltiples métodos de pago venezolanos | [ACTUAL] | Registro de pagos por diferentes vías |
| D5 | Multi-moneda real con tasa BCV automática | [NUEVO] | Tasa BCV actualizada automáticamente (API/scraping). Tasa paralela configurable. Conversión automática al vender. Reportes en ambas monedas. Historial de tasas por transacción |
| D6 | Integración con pasarelas de pago | [NUEVO] | Pago Móvil C2P (Mercantil/BVC/BNC), Binance Pay, Zinli, InstaPago, BDV Botón de Pago. Flujo: orden → pago → confirmación automática → registro en cuenta |
| D7 | Conciliación automática de pagos | [NUEVO] | Cruzar pagos recibidos en bancos con cuentas por cobrar. Marcar automáticamente como pagado cuando coincide referencia/monto |

---

## E. Resumen Financiero y Reportería

| # | Feature | Estado | Detalle |
|---|---|---|---|
| E1 | Seguimiento de ingresos | [ACTUAL] | Total de ingresos por periodo |
| E2 | Costo de ventas | [ACTUAL] | Cálculo del costo de lo vendido |
| E3 | Gastos fijos y variables | [ACTUAL] | Registro y categorización de gastos |
| E4 | Ganancia bruta y neta | [ACTUAL] | Cálculo automático de márgenes |
| E5 | Gráficos visuales con línea temporal | [ACTUAL] | Visualización de tendencias (ej. Enero a Junio) |
| E6 | Estadísticas del negocio | [ACTUAL] | Métricas generales de rendimiento |
| E7 | Estadísticas detalladas por cliente | [ACTUAL] | Datos de compra por cliente individual |
| E8 | Exportación Excel y PDF | [ACTUAL] | Descarga de reportes en estos formatos |
| E9 | Reportes narrativos con IA | [NUEVO] | Resumen en texto natural: "Este mes vendiste $4,250, 12% más que el anterior. Tu producto estrella fue X. Recomendación: promocionar Y que tiene buen margen pero pocas ventas" |
| E10 | Reportes programados por email | [NUEVO] | Envío automático: diario (cierre), semanal (lunes), mensual (día 1). PDF adjunto + resumen en cuerpo del email. Destinatario configurable |
| E11 | Comparativas periodo vs periodo | [NUEVO] | Mes vs anterior, año vs año, semana vs semana, rango personalizado. Gráficos lado a lado + variación porcentual |
| E12 | Exportación a Google Sheets | [NUEVO] | Conexión directa con Google Sheets API. Actualización automática cada hora o bajo demanda |

---

## F. Marketing y Comunicación

| # | Feature | Estado | Detalle |
|---|---|---|---|
| F1 | Campañas masivas de SMS | [ACTUAL] | Envío de SMS a base de clientes |
| F2 | Analíticas de rendimiento de campañas | [ACTUAL] | Métricas de efectividad de campañas SMS |
| F3 | Estadísticas detalladas por cliente | [ACTUAL] | Datos de interacción por cliente |
| F4 | Generador de campañas para WhatsApp | [NUEVO] | Fina genera la campaña, el usuario la lanza desde su propio WhatsApp. Links wa.me con mensaje prellenado por cliente. Plantillas con variables ({nombre}, {producto}, {monto}). Dos modos: click-to-chat individual o texto para lista de difusión (hasta 256 contactos) |
| F5 | Campañas por email | [NUEVO] | Plantillas prediseñadas para: promociones, cumpleaños, recordatorio de cobro, resumen mensual, nuevos productos. Integración con Resend/SES/Mailgun (tier gratuito: 3,000/mes) |
| F6 | Integración con Telegram Bot | [NUEVO] | Bot del negocio para notificaciones automáticas: pedidos, pagos, inventario. Canal para promociones. API gratuita sin restricciones |
| F7 | Segmentación de clientes para campañas | [NUEVO] | Segmentos automáticos: VIP (top 10% gasto), frecuentes (1+/semana), en riesgo (30+ días sin compra), nuevos (últimos 30 días), con deuda, inactivos (90+ días). Seleccionar segmento y lanzar campaña dirigida |
| F8 | Recordatorios automáticos | [NUEVO] | "Tienes 15 clientes que no compran hace 30 días". "5 clientes tienen saldo vencido hace más de 15 días". Programables por el usuario |

---

## G. CRM y Clientes

| # | Feature | Estado | Detalle |
|---|---|---|---|
| G1 | Registro básico de clientes | [ACTUAL] | Nombre y datos de contacto (implícito en el módulo de cuentas/marketing) |
| G2 | Perfil de cliente enriquecido | [NUEVO] | Ficha completa: nombre, teléfono, email, dirección, historial de compras, frecuencia de visita, ticket promedio, productos favoritos, método de pago preferido, saldo pendiente, notas del vendedor |
| G3 | Programa de lealtad / fidelización | [NUEVO] | Modelos: puntos por compra, tarjeta de sellos digital, descuento por frecuencia, niveles (Bronce/Plata/Oro). Todo digital, identificación por teléfono o cédula |
| G4 | Encuestas de satisfacción (NPS) | [NUEVO] | "Del 1 al 10, ¿nos recomendarías?" + comentario. Envío por WhatsApp (wa.me) o email post-compra |

---

## H. Integración Contable

| # | Feature | Estado | Detalle |
|---|---|---|---|
| H1 | Exportación contable estructurada (CSV/Excel) | [NUEVO] | Columnas estándar: fecha, descripción, cuenta contable, debe, haber, referencia. Excel con formato de libro diario/mayor/auxiliares |
| H2 | Catálogo de cuentas configurable | [NUEVO] | El contador asigna cuentas contables a cada tipo de transacción (ventas efectivo → 4101, costo mercancía → 5101, etc.). Una vez configurado, cada exportación sale con asientos armados |
| H3 | Plantillas para sistemas contables venezolanos | [NUEVO] | Formatos específicos para: Galac (TXT), Profit Plus (CSV/TXT), Saint (propietario), Valery (Excel), A2 Softway (TXT/CSV), Excel del contador (plantilla personalizable) |
| H4 | Libros de compras/ventas para SENIAT | [NUEVO] | Generación automática de libros fiscales en PDF, listos para declaraciones de IVA/ISLR |
| H5 | Portal del contador | [NUEVO] | URL dedicada donde el contador descarga reportes directamente sin que el dueño tenga que enviar nada. Acceso con rol de solo lectura |

---

## I. Seguridad

| # | Feature | Estado | Detalle |
|---|---|---|---|
| I1 | Seguridad básica (login/password) | [ACTUAL] | Acceso con credenciales. "Herramientas tecnológicas avanzadas" (sin especificar) |
| I2 | Datos seguros al cancelar suscripción | [ACTUAL] | Los datos se mantienen seguros si el usuario cancela |
| I3 | Autenticación de dos factores (2FA/MFA) | [NUEVO] | Código por email (gratis, fase 1), app autenticadora Google Authenticator/Authy (fase 2) |
| I4 | Roles y permisos granulares | [NUEVO] | Roles: Dueño/Admin, Gerente, Cajero, Inventarista, Mesonero/Vendedor, Contador, Solo lectura. Permisos configurables por módulo: Inventario, Ventas, Cuentas, Reportes, Marketing, Configuración |
| I5 | Auditoría de acciones (log de actividad) | [NUEVO] | Registro de: login/logout, CRUD productos, ventas/anulaciones, cambios de precio, ajustes inventario, descuentos, cambios de config. Formato: fecha/hora, usuario, acción, detalle, IP |
| I6 | Cifrado y estándares de seguridad | [MEJORAR] | TLS 1.3 en tránsito, AES-256 en reposo, hashing bcrypt/argon2 para contraseñas, JWT con expiración, cierre por inactividad |
| I7 | Backups con restauración | [NUEVO] | Backups automáticos diarios, retención 30 días, botón "Restaurar al día X", confirmación por email/2FA |

---

## J. Plataforma y Experiencia Técnica

| # | Feature | Estado | Detalle |
|---|---|---|---|
| J1 | 100% en la nube | [ACTUAL] | Sin instalación, funciona desde navegador |
| J2 | Multi-dispositivo | [ACTUAL] | PC, tablet, celular |
| J3 | Usuarios ilimitados | [ACTUAL] | Todos los planes, acceso simultáneo |
| J4 | Sincronización en tiempo real | [ACTUAL] | Datos actualizados instantáneamente en todos los dispositivos |
| J5 | Progressive Web App (PWA) | [NUEVO] | Se instala como app desde el navegador. Ícono en pantalla de inicio. Notificaciones push (inventario bajo, ventas, pagos, resumen del día). Funciona offline. Interfaz optimizada para móvil |
| J6 | Modo offline con sincronización | [NUEVO] | Registrar ventas, consultar inventario/precios sin internet. Cola de sincronización automática. Indicador visual de estado. Implementación: Service Workers + IndexedDB |
| J7 | API REST pública | [NUEVO] | Endpoints: /productos, /ventas, /inventario, /clientes, /cuentas, /reportes, /webhooks. Autenticación por API Keys con permisos configurables |
| J8 | Webhooks | [NUEVO] | Eventos: venta.creada, inventario.bajo, pago.recibido, cliente.nuevo, gasto.registrado, cierre.diario. Notificación automática a URL externa |

---

## K. Onboarding y Soporte

| # | Feature | Estado | Detalle |
|---|---|---|---|
| K1 | Registro en 3 pasos | [ACTUAL] | Registro → configuración asistida → personalización autónoma |
| K2 | Configuración inicial asistida (gratis) | [ACTUAL] | Experto de Fina ayuda sin costo adicional |
| K3 | Soporte técnico gratuito | [ACTUAL] | Incluido en todos los planes |
| K4 | Centro de tutoriales en video | [ACTUAL] | Videos en YouTube, accesibles desde la plataforma |
| K5 | Chatbot IA para soporte | [NUEVO] | Asistente virtual 24/7 dentro de Fina. Responde preguntas de uso ("¿Cómo agrego un producto?"), consulta datos ("¿Cuánto vendí esta semana?"), genera rankings en tiempo real. LLM con acceso de solo lectura a la base de datos |

---

## L. E-commerce y Omnicanalidad

| # | Feature | Estado | Detalle |
|---|---|---|---|
| L1 | Tienda online integrada | [NUEVO] | Catálogo web público con fotos, precios, disponibilidad en tiempo real. Carrito de compras. Checkout con Pago Móvil C2P, Binance Pay, Zinli. Sincronización automática con inventario. URL personalizable (tunegocio.fina.com.ve o dominio propio). Diseño responsive |
| L2 | Sincronización con marketplaces | [NUEVO] | Instagram Shopping (alta viabilidad en Venezuela), MercadoLibre Venezuela, Facebook Marketplace |

---

## M. Gestión de Empleados

| # | Feature | Estado | Detalle |
|---|---|---|---|
| M1 | Distinción de roles operativos | [ACTUAL] | El módulo de ventas distingue entre repartidores, mesoneros y vendedores (sin permisos granulares) |
| M2 | Comisiones por vendedor | [NUEVO] | Porcentaje configurable por vendedor. Comisión diferenciada por producto/categoría. Meta mensual con bonificación. Reporte de comisiones por periodo |
| M3 | Metas y objetivos por vendedor | [NUEVO] | Meta mensual (monto o unidades). Barra de progreso visual. Ranking de vendedores del mes. Historial de cumplimiento |
| M4 | Control de asistencia | [NUEVO] | Check-in/check-out desde celular/tablet. Registro por PIN. Reporte de horas trabajadas. Alertas de llegadas tarde |
| M5 | Nómina básica | [NUEVO] | Salario base + comisiones - deducciones = total a pagar. Recibo en PDF. No incluye prestaciones sociales/SSO/FAOV |

---

## N. Multi-sucursal

| # | Feature | Estado | Detalle |
|---|---|---|---|
| N1 | Gestión multi-sucursal | [NUEVO] | Dashboard consolidado y por sucursal. Inventario independiente por ubicación. Usuarios asignados a sucursales. Precios por sucursal |
| N2 | Transferencias entre sucursales | [NUEVO] | Solicitud de transferencia → guía de despacho → confirmación de recepción → ajuste automático de inventario en ambas |
| N3 | Reportes consolidados | [NUEVO] | Ventas totales empresa, comparativa entre sucursales, inventario consolidado, P&L por sucursal y total |

---

## O. Precios y Modelo de Negocio

| # | Feature | Estado | Detalle |
|---|---|---|---|
| O1 | Plan Económico ($30/mes) | [ACTUAL] | Todas las funcionalidades principales, usuarios ilimitados |
| O2 | Plan Estándar ($35/mes) | [ACTUAL] | Mismo set de features, posicionado como "La Mejor Opción" |
| O3 | Descuento semestral (20%) | [ACTUAL] | Pago cada 6 meses con descuento |
| O4 | Descuento anual (30%) | [ACTUAL] | Pago anual con mayor descuento |
| O5 | Promo "Triple Play" | [ACTUAL] | Tier promocional especial |
| O6 | Pago único (acceso de por vida) | [ACTUAL] | Una sola compra, acceso permanente |
| O7 | Asistente de precios | [NUEVO] | Calculadora de precio sugerido (costo + margen + impuestos). Alerta cuando costo sube y precio no se ajustó. Simulador de impacto: "Si subes 10%, venderás 5% menos pero ganarás 4% más" |

---

## P. Programa de Partners

| # | Feature | Estado | Detalle |
|---|---|---|---|
| P1 | Programa de partners | [ACTUAL] | Existe la sección "Conviértete en nuestro partner". Sin detalles públicos de estructura, comisiones, requisitos ni beneficios |

---

## Q. Presencia y Canales

| # | Feature | Estado | Detalle |
|---|---|---|---|
| Q1 | Instagram | [ACTUAL] | Presencia activa |
| Q2 | YouTube | [ACTUAL] | Tutoriales y contenido |
| Q3 | X (Twitter) | [ACTUAL] | Presencia activa |
| Q4 | LinkedIn | [ACTUAL] | Presencia activa |
| Q5 | WhatsApp (contacto de ventas) | [ACTUAL] | Canal de comunicación con prospectos |
| Q6 | Portal de registro (registro.finapartner.com) | [ACTUAL] | Registro de nuevos negocios |

---

## Resumen Cuantitativo

| Categoría | Actuales | Nuevos | Mejorar | Total |
|---|---|---|---|---|
| A. Dashboard | 1 | 3 | 0 | 4 |
| B. Inventario | 6 | 4 | 0 | 10 |
| C. Ventas | 4 | 4 | 0 | 8 |
| D. Cuentas y Finanzas | 4 | 3 | 0 | 7 |
| E. Reportería | 8 | 4 | 0 | 12 |
| F. Marketing | 3 | 5 | 0 | 8 |
| G. CRM y Clientes | 1 | 3 | 0 | 4 |
| H. Integración Contable | 0 | 5 | 0 | 5 |
| I. Seguridad | 2 | 4 | 1 | 7 |
| J. Plataforma | 4 | 4 | 0 | 8 |
| K. Onboarding y Soporte | 4 | 1 | 0 | 5 |
| L. E-commerce | 0 | 2 | 0 | 2 |
| M. Empleados | 1 | 4 | 0 | 5 |
| N. Multi-sucursal | 0 | 3 | 0 | 3 |
| O. Precios | 6 | 1 | 0 | 7 |
| P. Partners | 1 | 0 | 0 | 1 |
| Q. Presencia | 6 | 0 | 0 | 6 |
| **TOTAL** | **51** | **50** | **1** | **102** |

---

## Tabla Maestra para Decisión

> Usa esta tabla para marcar cuáles quedan (SI), cuáles se descartan (NO), o cuáles se posponen (DESPUÉS). Los [ACTUAL] se asumen como SI por defecto.

| ID | Feature | Estado | Prioridad | Decisión |
|---|---|---|---|---|
| A1 | Dashboard en tiempo real | ACTUAL | - | SI |
| A2 | Dashboards personalizables | NUEVO | Media | ___ |
| A3 | KPIs configurables | NUEVO | Media | ___ |
| A4 | Comparativas periodo vs periodo | NUEVO | Media | ___ |
| B1 | Seguimiento por talla/color/referencia | ACTUAL | - | SI |
| B2 | Control fechas de vencimiento | ACTUAL | - | SI |
| B3 | Inventario por modelo/referencia | ACTUAL | - | SI |
| B4 | Descuento automático ingredientes/receta | ACTUAL | - | SI |
| B5 | Import/export Excel y PDF | ACTUAL | - | SI |
| B6 | Alertas inventario bajo | ACTUAL | - | SI |
| B7 | Predicción de demanda IA | NUEVO | Media | ___ |
| B8 | Análisis rentabilidad por producto | NUEVO | Alta | ___ |
| B9 | Escáner código de barras | NUEVO | Media | ___ |
| B10 | Detección anomalías inventario | NUEVO | Alta | ___ |
| C1 | Registro de ventas | ACTUAL | - | SI |
| C2 | Gestión de mesas | ACTUAL | - | SI |
| C3 | Seguimiento de repartidores | ACTUAL | - | SI |
| C4 | Control mesoneros/vendedores | ACTUAL | - | SI |
| C5 | Detección anomalías ventas | NUEVO | Alta | ___ |
| C6 | QR para pagos | NUEVO | Media | ___ |
| C7 | Modo offline para ventas | NUEVO | Alta | ___ |
| C8 | Comprobante digital por WhatsApp | NUEVO | Media | ___ |
| D1 | Gestión cuentas bancarias/caja | ACTUAL | - | SI |
| D2 | Cuentas por cobrar/pagar | ACTUAL | - | SI |
| D3 | Soporte Bs. y USD | ACTUAL | - | SI |
| D4 | Múltiples métodos de pago | ACTUAL | - | SI |
| D5 | Multi-moneda tasa BCV automática | NUEVO | Alta | ___ |
| D6 | Integración pasarelas de pago | NUEVO | Alta | ___ |
| D7 | Conciliación automática de pagos | NUEVO | Media | ___ |
| E1 | Seguimiento de ingresos | ACTUAL | - | SI |
| E2 | Costo de ventas | ACTUAL | - | SI |
| E3 | Gastos fijos y variables | ACTUAL | - | SI |
| E4 | Ganancia bruta y neta | ACTUAL | - | SI |
| E5 | Gráficos con línea temporal | ACTUAL | - | SI |
| E6 | Estadísticas del negocio | ACTUAL | - | SI |
| E7 | Estadísticas por cliente | ACTUAL | - | SI |
| E8 | Exportación Excel/PDF | ACTUAL | - | SI |
| E9 | Reportes narrativos IA | NUEVO | Media | ___ |
| E10 | Reportes programados por email | NUEVO | Media | ___ |
| E11 | Comparativas periodo vs periodo | NUEVO | Media | ___ |
| E12 | Exportación a Google Sheets | NUEVO | Baja | ___ |
| F1 | Campañas masivas SMS | ACTUAL | - | SI |
| F2 | Analíticas de campañas | ACTUAL | - | SI |
| F3 | Estadísticas por cliente | ACTUAL | - | SI |
| F4 | Generador campañas WhatsApp | NUEVO | Alta | ___ |
| F5 | Campañas por email | NUEVO | Media | ___ |
| F6 | Integración Telegram Bot | NUEVO | Media | ___ |
| F7 | Segmentación de clientes | NUEVO | Alta | ___ |
| F8 | Recordatorios automáticos | NUEVO | Alta | ___ |
| G1 | Registro básico de clientes | ACTUAL | - | SI |
| G2 | Perfil cliente enriquecido | NUEVO | Alta | ___ |
| G3 | Programa de lealtad | NUEVO | Media | ___ |
| G4 | Encuestas NPS | NUEVO | Baja | ___ |
| H1 | Exportación contable CSV/Excel | NUEVO | Alta | ___ |
| H2 | Catálogo de cuentas configurable | NUEVO | Alta | ___ |
| H3 | Plantillas sistemas contables VE | NUEVO | Alta | ___ |
| H4 | Libros compras/ventas SENIAT | NUEVO | Alta | ___ |
| H5 | Portal del contador | NUEVO | Media | ___ |
| I1 | Seguridad básica login/password | ACTUAL | - | SI |
| I2 | Datos seguros al cancelar | ACTUAL | - | SI |
| I3 | 2FA/MFA | NUEVO | Alta | ___ |
| I4 | Roles y permisos granulares | NUEVO | Alta | ___ |
| I5 | Auditoría de acciones | NUEVO | Alta | ___ |
| I6 | Cifrado y estándares seguridad | MEJORAR | Alta | ___ |
| I7 | Backups con restauración | NUEVO | Media | ___ |
| J1 | 100% en la nube | ACTUAL | - | SI |
| J2 | Multi-dispositivo | ACTUAL | - | SI |
| J3 | Usuarios ilimitados | ACTUAL | - | SI |
| J4 | Sincronización tiempo real | ACTUAL | - | SI |
| J5 | PWA con notificaciones push | NUEVO | Alta | ___ |
| J6 | Modo offline con sincronización | NUEVO | Alta | ___ |
| J7 | API REST pública | NUEVO | Media | ___ |
| J8 | Webhooks | NUEVO | Media | ___ |
| K1 | Registro en 3 pasos | ACTUAL | - | SI |
| K2 | Configuración asistida gratis | ACTUAL | - | SI |
| K3 | Soporte técnico gratuito | ACTUAL | - | SI |
| K4 | Centro tutoriales video | ACTUAL | - | SI |
| K5 | Chatbot IA soporte | NUEVO | Baja | ___ |
| L1 | Tienda online integrada | NUEVO | Media | ___ |
| L2 | Sincronización marketplaces | NUEVO | Baja | ___ |
| M1 | Distinción roles operativos | ACTUAL | - | SI |
| M2 | Comisiones por vendedor | NUEVO | Media | ___ |
| M3 | Metas y objetivos vendedor | NUEVO | Baja | ___ |
| M4 | Control de asistencia | NUEVO | Baja | ___ |
| M5 | Nómina básica | NUEVO | Baja | ___ |
| N1 | Gestión multi-sucursal | NUEVO | Media | ___ |
| N2 | Transferencias entre sucursales | NUEVO | Media | ___ |
| N3 | Reportes consolidados | NUEVO | Media | ___ |
| O1 | Plan Económico $30/mes | ACTUAL | - | SI |
| O2 | Plan Estándar $35/mes | ACTUAL | - | SI |
| O3 | Descuento semestral 20% | ACTUAL | - | SI |
| O4 | Descuento anual 30% | ACTUAL | - | SI |
| O5 | Promo Triple Play | ACTUAL | - | SI |
| O6 | Pago único (de por vida) | ACTUAL | - | SI |
| O7 | Asistente de precios | NUEVO | Baja | ___ |
| P1 | Programa de partners | ACTUAL | - | SI |
| Q1 | Instagram | ACTUAL | - | SI |
| Q2 | YouTube | ACTUAL | - | SI |
| Q3 | X (Twitter) | ACTUAL | - | SI |
| Q4 | LinkedIn | ACTUAL | - | SI |
| Q5 | WhatsApp ventas | ACTUAL | - | SI |
| Q6 | Portal registro | ACTUAL | - | SI |
