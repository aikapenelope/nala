# Nala: Visión de Producto 2026

> Cómo construir un sistema administrativo para PyMEs venezolanas que se sienta 2026, manteniendo la simplicidad que hace exitoso a Fina.

---

## La Tesis

Fina demostró que el mercado existe y que la simplicidad gana. Pero Fina es un producto de 2020 que funciona en 2026. Nala es un producto **nacido en 2026** que absorbe las lecciones de Fina y las combina con lo que la tecnología permite hoy.

La diferencia no es "más features". Es **mejor experiencia con la misma simplicidad**.

---

## Los 3 Pilares de Nala

### Pilar 1: WhatsApp es la interfaz

El usuario venezolano vive en WhatsApp. No en un navegador, no en una app, no en un dashboard. En WhatsApp. Nala no pelea contra eso. Nala **vive dentro de WhatsApp** tanto como sea posible.

### Pilar 2: Funciona sin internet

En Venezuela, internet no es confiable. Electricidad tampoco. Nala funciona offline primero, online después. No es un feature. Es la arquitectura.

### Pilar 3: Inteligencia invisible

Nala tiene IA, predicciones, automatización. Pero el usuario nunca ve nada de eso. Solo ve resultados: "Pide más harina", "Juan te debe $50", "Hoy vendiste más que ayer". La complejidad está debajo. La superficie es simple.

---

## Cómo Se Siente Usar Nala

### El primer día

1. El dueño de una panadería descarga Nala (PWA, se instala desde el navegador en 3 segundos, pesa menos de 500KB)
2. Abre la app. Una sola pregunta: "¿Qué tipo de negocio tienes?" → Panadería
3. Nala pre-configura todo: categorías de productos (panes, dulces, bebidas), cuentas contables, roles, plantillas. Cero configuración manual
4. "¿Tienes una lista de productos en Excel o los quieres agregar uno por uno?" → Sube Excel o agrega manualmente
5. Listo. Puede vender

**Tiempo total: 5 minutos.** Sin llamar a soporte. Sin tutorial de 30 minutos. Sin configurar nada.

### Un día normal

**6:00 AM** - El dueño abre el negocio. Abre Nala en su celular. Ve un solo número grande: "$0 vendido hoy". Debajo: "3 productos con stock bajo". Nada más.

**7:30 AM** - Llega un cliente. El cajero toca "Nueva venta", selecciona "Pan campesino x3, Café con leche x1". Toca "Cobrar". Aparecen las opciones: Efectivo, Pago Móvil, Binance. El cliente paga con Pago Móvil. El cajero toca "Pago Móvil" y listo. La venta se registra, el inventario se descuenta, la caja se actualiza. Todo en 4 toques.

**8:00 AM** - Se va la luz. Nala sigue funcionando. El cajero sigue registrando ventas. Cuando vuelve la luz (y el internet), todo se sincroniza automáticamente. El cajero ni se entera.

**12:00 PM** - El dueño recibe una notificación en WhatsApp: "Llevas $180 vendidos esta mañana. 12% más que el martes pasado. La Harina PAN baja rápido, te queda para ~2 días."

**3:00 PM** - Un cliente habitual llega. El vendedor ve en la pantalla: "María García - viene cada semana, siempre compra pan campesino y cachitos. Última visita: hace 8 días. Le debe $15 de la vez pasada."

**6:00 PM** - El dueño quiere cobrarle a los clientes que le deben. Abre Nala, toca "Cobros pendientes". Ve la lista. Toca "Recordar a todos". Nala genera un mensaje personalizado para cada uno y abre WhatsApp con el mensaje listo. El dueño solo presiona enviar. 5 clientes cobrados en 2 minutos.

**9:00 PM** - El dueño recibe el resumen del día por WhatsApp:

> "Hoy vendiste $420. Tu mejor producto fue Pan Campesino (85 unidades). Ganancia estimada: $180. Tienes $95 pendientes por cobrar. La Harina PAN se acaba mañana, te recomiendo pedir 2 sacos. Mañana es miércoles, históricamente tu mejor día."

No abrió Nala ni una vez para ver esto. Le llegó solo.

---

## Arquitectura de Producto

### La app: PWA offline-first

| Aspecto | Decisión | Por qué |
|---|---|---|
| Tipo | Progressive Web App (PWA) | Se instala desde el navegador. Sin App Store. Pesa <500KB. Funciona en Android de $100 |
| Offline | Service Workers + IndexedDB | Todas las operaciones críticas funcionan sin internet. Cola de sincronización automática |
| Carga | <2 segundos en 3G | Optimizada para conexiones lentas venezolanas |
| Notificaciones | Push vía PWA + WhatsApp | Push para alertas rápidas. WhatsApp para reportes y cobros |
| Actualizaciones | Automáticas, sin descarga | El usuario siempre tiene la última versión sin hacer nada |

**Referencia:** Starbucks PWA pesa 233KB (vs 148MB la app nativa) y duplicó usuarios activos. Uber PWA funciona en 2G. Alibaba PWA aumentó conversiones 76%.

### WhatsApp como canal principal

Nala no necesita la WhatsApp Business API (verificación de Meta complicada). Usa el modelo de **generación de mensajes**:

| Acción | Cómo funciona |
|---|---|
| Cobrar a un cliente | Nala genera link `wa.me/58412XXXX?text=Hola María, te recordamos que tienes un saldo de $15...` El dueño toca y envía |
| Enviar recibo | Nala genera PDF del recibo + link wa.me. Un toque para enviar |
| Reporte diario | Nala envía resumen por WhatsApp al dueño (esto sí puede usar Twilio o un bot simple) |
| Campaña de marketing | Nala genera lista de mensajes personalizados. El dueño los envía desde su WhatsApp con listas de difusión |
| Soporte | El usuario escribe a Nala por WhatsApp. Un humano responde (no chatbot) |

**Futuro:** Cuando la verificación de Meta se complete, Nala puede enviar mensajes automáticamente sin cambiar la experiencia del usuario.

### IA invisible

| Lo que el usuario ve | Lo que pasa debajo |
|---|---|
| "La Harina PAN se acaba mañana" | Algoritmo de series temporales analiza velocidad de venta, stock actual, y día de la semana |
| "María viene cada semana y compra cachitos" | Análisis de frecuencia y patrones de compra por cliente |
| "Hoy vendiste 12% más que el martes pasado" | Comparativa automática con mismo día de semanas anteriores |
| "Tu producto más rentable es Pan Campesino" | Cálculo de margen × volumen × frecuencia |
| "Se registraron 3 anulaciones hoy, el promedio es 0.2" | Detección de anomalías estadísticas |
| Categorías de productos pre-configuradas al registrarse | Clasificación por tipo de negocio con datos de miles de negocios similares |

El usuario nunca ve "Módulo de IA", "Dashboard de Analytics", "Configurar Algoritmo". Solo ve frases en español simple que le dicen qué hacer.

---

## Features de Nala (versión 1.0)

### Lo que tiene desde el día 1

Organizado por lo que el usuario **hace**, no por módulos técnicos.

#### Vender

- Registro de venta en 3-4 toques (producto → cantidad → método de pago → listo)
- Funciona offline. Sincroniza cuando hay internet
- Métodos de pago: efectivo, Pago Móvil, Binance, Zinli, transferencia, Zelle, fiado
- Gestión de mesas (restaurantes)
- Seguimiento de repartidores
- Control de quién vendió qué (mesonero/vendedor)
- Descuento automático de ingredientes por receta (restaurantes)
- Escaneo de código de barras con la cámara del celular

#### Saber cuánto tengo

- Inventario con variantes (talla, color, referencia, modelo)
- Fechas de vencimiento
- Alertas inteligentes: "Te quedan 5 unidades de X, se acaba en ~3 días"
- Importación desde Excel
- Conteo físico con escáner

#### Saber cuánto me deben / debo

- Cuentas por cobrar con un toque para cobrar por WhatsApp
- Cuentas por pagar
- Registro de pagos recibidos
- Conciliación básica: "¿Este pago de $50 por Pago Móvil es de Juan?" → Sí/No

#### Saber cómo me fue

- Pantalla principal: un número grande (ventas del día). Debajo: 3 alertas máximo
- Resumen diario automático por WhatsApp a las 9pm
- Resumen semanal los lunes
- Comparativa automática: "Esta semana vs la anterior"
- Top productos (más vendidos, más rentables, muertos)
- Todo en español simple, sin gráficos complejos

#### Cobrar y comunicar

- Generador de mensajes WhatsApp para cobros
- Generador de campañas WhatsApp (segmentos: no compran hace 30 días, VIP, con deuda)
- Envío de recibos digitales por WhatsApp
- Recordatorios automáticos: "Tienes 8 clientes que no compran hace 30 días"

#### Conocer a mis clientes

- Perfil automático: historial de compras, frecuencia, ticket promedio, productos favoritos, saldo
- Segmentos automáticos: VIP, frecuentes, en riesgo, nuevos, con deuda, inactivos
- Al tocar un cliente en cualquier pantalla, se ve su ficha completa

#### Seguridad

- 2FA por email (gratis, simple)
- Dos modos: Dueño (ve todo) y Empleado (solo vende)
- Log de actividad: quién hizo qué y cuándo
- Backups automáticos visibles: "Último respaldo: hace 2 horas"
- Tasa BCV actualizada automáticamente (sin configuración)

#### Contabilidad (puente, no módulo)

- Botón "Enviar al contador": genera PDF/Excel con formato contable y abre WhatsApp
- Catálogo de cuentas pre-configurado por tipo de negocio (el contador puede ajustar)
- Libro de ventas/compras en formato SENIAT

---

## Lo que Nala NO tiene en v1.0 (a propósito)

| Feature | Por qué no |
|---|---|
| API REST pública | Ningún usuario de $25/mes la usaría |
| Webhooks | Mismo motivo |
| Tienda online / e-commerce | Requiere fotos de productos, precios online, logística. El usuario no está listo |
| Multi-sucursal | Solo relevante para <5% del mercado. Se agrega después |
| Dashboards personalizables | El usuario no quiere personalizar. Quiere que funcione |
| Chatbot IA | El usuario prefiere hablar con una persona. El soporte humano es el diferenciador |
| Nómina | Complejidad legal alta, valor percibido bajo |
| Programa de lealtad complejo | Demasiada configuración. En v2 se puede agregar como "Compra 10, el 11 gratis" |
| Integración con marketplaces | Mercado venezolano en marketplaces es mínimo |
| Modo conversacional / chat UI | Suena futurista pero confunde al usuario promedio hoy |
| Embedded finance / préstamos | Requiere licencia financiera. No es viable en v1 |

Estos features se agregan en v2, v3, etc., cuando el usuario base ya esté cómodo y los pida.

---

## Modelo de Negocio

### Pricing

| Plan | Precio | Qué incluye |
|---|---|---|
| **Gratis** | $0/mes | 1 usuario, 50 productos, ventas ilimitadas, offline, reportes básicos. Sin límite de tiempo |
| **Pro** | $19/mes | Usuarios ilimitados, productos ilimitados, IA (alertas inteligentes, predicciones), cobros por WhatsApp, exportación contable, 2FA, roles |
| **Negocio** | $35/mes | Todo Pro + soporte prioritario por WhatsApp, onboarding asistido, reportes avanzados, segmentación de clientes, campañas WhatsApp |

### Por qué un plan gratis

- Fina no tiene plan gratis. Loyverse sí. Wave sí. Square sí
- El plan gratis es el mejor marketing en un mercado donde la gente desconfía de pagar por software
- El usuario prueba gratis, se acostumbra, y cuando necesita más (segundo empleado, más productos, alertas inteligentes), paga
- El plan gratis también genera boca a boca: "Usa Nala, es gratis"
- Costo de servir un usuario gratis: mínimo (PWA, sin servidor pesado, sin soporte humano incluido)

### Monetización futura (v2+)

| Fuente | Detalle |
|---|---|
| Comisión por cobros | Si Nala procesa pagos (Pago Móvil C2P integrado), cobra 1-2% por transacción |
| Exportación contable premium | Plantillas específicas para Galac, Profit Plus, Saint |
| Multi-sucursal | Add-on de $10/mes por sucursal adicional |
| Tienda online | Add-on de $15/mes cuando se lance |

---

## Diferenciadores vs Fina

| Aspecto | Fina | Nala |
|---|---|---|
| Instalación | Navegador web | PWA instalable (ícono en pantalla, se siente como app) |
| Offline | No funciona sin internet | Funciona completamente offline |
| Velocidad | Depende de conexión | <2 segundos en 3G, instantáneo offline |
| Onboarding | 3 pasos + asistencia humana | 1 pregunta + auto-configuración por IA. Humano disponible si quiere |
| Reportes | Dashboard que el usuario debe abrir | Llegan solos por WhatsApp |
| Cobros | Manual (el usuario busca quién debe y escribe) | Un toque: "Cobrar a todos" → WhatsApp listo |
| Tasa de cambio | Manual | BCV automática |
| Roles | No tiene | Dueño vs Empleado (simple, sin configuración) |
| Seguridad | Básica | 2FA + log de actividad + backups visibles |
| Inteligencia | No tiene | Alertas inteligentes, predicciones, anomalías (todo invisible) |
| Clientes | Registro básico | Perfil automático con historial, frecuencia, segmentos |
| Contabilidad | No tiene | Exportación con formato contable + envío por WhatsApp al contador |
| Precio | $30-35/mes | Gratis + $19/mes + $35/mes |
| Marketing | SMS (nadie usa SMS) | WhatsApp (donde está la gente) |

---

## Stack Técnico Sugerido

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | PWA con Nuxt 3 (Vue) o Next.js (React) | SSR + PWA nativo. Offline-first con Service Workers. Ligero |
| Base de datos local | IndexedDB (vía Dexie.js) | Almacenamiento offline en el navegador. Sincronización cuando hay internet |
| Backend | Node.js / Bun + Hono o Fastify | Ligero, rápido, TypeScript nativo |
| Base de datos | PostgreSQL + pgvector | Relacional sólido. pgvector para búsqueda semántica futura |
| Cache | Redis | Sesiones, cache de tasa BCV, colas de sincronización |
| Storage | MinIO (S3-compatible) | Fotos de productos, PDFs de reportes, backups |
| IA | GPT-4o-mini / Claude Haiku vía API | Reportes narrativos, clasificación de negocios, detección de anomalías. Costo: ~$0.001 por consulta |
| Tasa BCV | Scraper o API pública | Actualización diaria automática |
| Notificaciones | Web Push API + Twilio (SMS fallback) | Push gratis vía PWA. SMS como respaldo |
| WhatsApp | Links wa.me (v1) → Twilio/BSP (v2) | Sin dependencia de Meta API en v1. Migración transparente en v2 |
| Hosting | Hetzner (hel1) | Económico, confiable, ya lo usamos en la infra actual |
| CI/CD | GitHub Actions + Coolify | Deploy automático. Ya tenemos Coolify en el control plane |

---

## Roadmap

### v1.0 - MVP (3-4 meses)

**Objetivo:** Reemplazar el cuaderno y Excel. Que el dueño pueda vender, saber cuánto tiene, y cobrar.

- PWA offline-first
- Registro de ventas (3-4 toques)
- Inventario básico con alertas
- Cuentas por cobrar/pagar
- Cobro por WhatsApp (generador de mensajes)
- Resumen diario por notificación push
- Tasa BCV automática
- 2 roles: Dueño / Empleado
- Plan gratis funcional

### v1.5 - Inteligencia (2 meses después)

**Objetivo:** Que Nala le diga al dueño qué hacer, sin que pregunte.

- Alertas inteligentes con contexto ("Harina PAN se acaba en 2 días")
- Perfil de cliente automático
- Segmentación de clientes
- Resumen diario/semanal por WhatsApp
- Detección de anomalías básica
- Comparativas automáticas (semana vs semana)
- Exportación contable (PDF/Excel con formato)

### v2.0 - Crecimiento (3 meses después)

**Objetivo:** Features que generan ingresos adicionales y retienen usuarios Pro.

- Integración Pago Móvil C2P (cobro directo desde Nala)
- Campañas WhatsApp con segmentación
- Plantillas contables para Galac/Profit Plus
- Escáner de código de barras
- Reportes narrativos con IA
- Programa de lealtad simple ("Compra 10, el 11 gratis")
- Log de actividad completo

### v3.0 - Escala (6 meses después)

**Objetivo:** Expandir a negocios más grandes y preparar para otros países.

- Multi-sucursal
- API REST (para integraciones de terceros)
- Tienda online básica
- Órdenes de compra a proveedores
- Portal del contador
- Onboarding para otros países LATAM (Colombia, Ecuador, Perú)

---

## Resumen en Una Frase

> **Nala es el sistema administrativo que le llega al dueño por WhatsApp, funciona sin luz, y le dice qué hacer sin que pregunte.**

No es "Fina con más features". Es una experiencia completamente diferente construida sobre la misma verdad: la gente quiere menos problemas, no más software.
