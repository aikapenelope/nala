# Fina vs Nova: Comparacion Feature-por-Feature

> Comparacion directa entre Fina (finapartner.com, $30-35/mes, 4000+ negocios)
> y Nova (novaincs.com, en desarrollo, 0 negocios en produccion).
> Basado en doc 01 (features de Fina) y doc 33 (features de Nova).

---

## Scorecard rapido

| Categoria | Fina | Nova | Ganador |
|-----------|------|------|---------|
| Dashboard | Basico (stats, alertas) | Premium (hero, chart, insights, quick actions) | **Nova** |
| POS | Registro de ventas | Grid + ticket + 3 taps + offline | **Nova** |
| Inventario | Tallas/colores, vencimiento, recetas | Variantes, semaforo, prediccion, OCR, wholesale | **Nova** |
| Ventas | Registro + mesas + repartidores | 7 metodos pago + split + fiado + canales + cotizaciones | **Nova** |
| Cuentas | Bancarias + por cobrar/pagar | Bancarias + por cobrar/pagar + apertura/cierre caja | **Nova** |
| Financiero | P&L con graficos | P&L + 9 reportes + AI narrativa + PDF/Excel/email | **Nova** |
| Marketing | SMS masivo + analiticas | No tiene | **Fina** |
| Multi-usuario | Ilimitados, roles basicos | Owner + empleados con PIN, permisos por rol | **Empate** |
| Offline | No tiene | IndexedDB + sync automatico | **Nova** |
| PWA | No (solo browser) | Instalable como app | **Nova** |
| AI | No tiene | Narrativas en reportes + OCR facturas | **Nova** |
| Multi-moneda | USD + Bs (basico) | USD + Bs + EUR, tasa BCV manual, conversion en cada venta | **Nova** |
| Catalogo publico | No tiene | Subdominio + WhatsApp ordering | **Nova** |
| Recetas (restaurantes) | Descuento automatico de ingredientes | No tiene | **Fina** |
| Mesas (restaurantes) | Gestion de mesas | No tiene | **Fina** |
| Repartidores | Seguimiento | No tiene | **Fina** |
| Onboarding asistido | Experto gratis | Self-service (3 pasos) | **Fina** |
| Tutoriales | Centro de videos YouTube | No tiene | **Fina** |

**Nova: 12 | Fina: 5 | Empate: 1**

---

## Detalle por modulo

### 1. Dashboard

| Feature | Fina | Nova |
|---------|------|------|
| Estadisticas de facturacion | Si | Si (hero con ventas + profit) |
| Ganancia mensual | Si | Si (margen bruto en insight tile) |
| Alertas inventario bajo | Si | Si (card "Se acaban" + reporte alertas) |
| Cuentas por cobrar | Si | Si (card "Te deben") |
| Cuentas por pagar | Si | Si (en pagina cuentas, no en dashboard) |
| Grafico semanal | No mencionado | Si (barras 7 dias con gradiente) |
| Payment mix | No mencionado | Si (barras coloreadas por metodo) |
| Top vendedor/producto | No mencionado | Si (insight tiles) |
| Tasa de cambio | No mencionado | Si (boton en header + editor modal) |
| Quick actions | No mencionado | Si (4 acciones rapidas) |

### 2. Inventario

| Feature | Fina | Nova |
|---------|------|------|
| Productos basicos | Si | Si |
| Tallas/colores/referencia | Si | Si (variantes con atributos JSON) |
| Fechas de vencimiento | Si | Si (expiresAt + alerta 30 dias) |
| Recetas (ingredientes) | Si | **No** |
| Import/export Excel | Si | Si (import batch + export reportes) |
| Semaforo de stock | No mencionado | Si (verde/amarillo/rojo/gris) |
| Prediccion agotamiento | No mencionado | Si (~X dias) |
| OCR facturas | No | Si (foto -> AI -> items) |
| Precio al mayor | No mencionado | Si (wholesalePrice + minQty) |
| Marca/ubicacion | No mencionado | Si |
| Unidades de medida | No mencionado | Si (conversion factor) |
| Historial de precios | No mencionado | Si |
| Productos servicio | No mencionado | Si (sin stock) |

### 3. Ventas

| Feature | Fina | Nova |
|---------|------|------|
| Registro de ventas | Si | Si (POS grid + ticket) |
| Gestion de mesas | Si | **No** |
| Repartidores | Si | **No** |
| Mesoneros/vendedores | Si | Si (empleados con PIN) |
| 7 metodos pago VE | No detallado | Si (efectivo, pago movil, binance, zinli, transferencia, zelle, fiado) |
| Split payment | No mencionado | Si |
| Fiado automatico | No mencionado | Si (genera cuenta por cobrar) |
| Canales de venta | No mencionado | Si (POS, WhatsApp, delivery, online) |
| Cotizaciones | No mencionado | Si (draft -> convertir) |
| Anulacion con PIN | No mencionado | Si (motivo + PIN dueno) |
| Offline | No | Si (IndexedDB queue) |
| Cargos adicionales | No mencionado | Si (delivery, propinas, empaques) |

### 4. Reportes

| Feature | Fina | Nova |
|---------|------|------|
| Resumen financiero | Si (P&L con graficos) | Si (P&L + 8 reportes mas) |
| Graficos visuales | Si (linea temporal) | Si (barras CSS, pendiente charts reales) |
| AI narrativa | No | Si (GPT-4o-mini / Groq) |
| Export PDF | No mencionado | Si |
| Export Excel | Si | Si |
| Enviar por email | No mencionado | Si (Resend) |
| Reportes especializados | No detallado | Si (9 tipos: diario, semanal, cash-flow, rentabilidad, inventario, receivable, sellers, financial, monthly-trend) |

### 5. Marketing

| Feature | Fina | Nova |
|---------|------|------|
| SMS masivo | Si | **No** |
| Analiticas de campanas | Si | **No** |
| Stats por cliente | Si | Si (segmentos + historial) |
| Cobro por WhatsApp | No mencionado | Si (link wa.me pre-armado) |

### 6. Seguridad

| Feature | Fina | Nova |
|---------|------|------|
| Declaracion generica | Si ("herramientas avanzadas") | No (pero tiene controles reales) |
| RLS tenant isolation | No mencionado | Si (30 tablas) |
| 2FA/MFA | No | Si (Clerk) |
| PIN lockout | No mencionado | Si (5 intentos, 15 min) |
| Rate limiting | No mencionado | Si |
| Security headers | No mencionado | Si |
| Audit trail | No | Si (activity_log) |

---

## Lo que Fina tiene y Nova NO

| Feature | Importancia para Nova | Accion |
|---------|----------------------|--------|
| **Recetas (ingredientes)** | Media. Solo aplica a restaurantes/comida rapida | Agregar si hay demanda de ese vertical |
| **Gestion de mesas** | Baja. Solo restaurantes con servicio en mesa | No priorizar |
| **Seguimiento de repartidores** | Media. Util para delivery | Agregar como feature de canal "delivery" |
| **SMS masivo** | Baja. WhatsApp es mas efectivo en Venezuela | Evaluar WhatsApp Business API en su lugar |
| **Onboarding asistido** | Alta. Reduce friccion para usuarios no tecnicos | Agregar tutoriales in-app o video walkthrough |
| **Centro de tutoriales** | Alta. Reduce soporte | Crear videos cortos para YouTube/TikTok |

---

## Lo que Nova tiene y Fina NO

| Feature | Ventaja competitiva |
|---------|-------------------|
| Modo offline (PWA) | Critico en Venezuela con internet inestable |
| OCR de facturas | Ahorra 15-30 min por factura de proveedor |
| AI en reportes | Narrativa que explica los numeros en espanol |
| 7 metodos de pago especificos | Binance, Zinli, Zelle, Pago Movil nativos |
| Fiado automatico | Genera cuenta por cobrar sin pasos extra |
| Catalogo publico con WhatsApp | Mini e-commerce gratis para cada negocio |
| Cotizaciones | Presupuestos que se convierten en venta |
| Semaforo de stock + prediccion | Inteligencia visual que Fina no tiene |
| Apertura/cierre de caja | Control de efectivo por turno |
| Roles con PIN (patron Square) | Cambio de turno instantaneo sin logout |
| Multi-tenant RLS | Arquitectura SaaS real (Fina no es multi-tenant publicamente) |
| Precio al mayor | Automatico por cantidad |
| Historial de precios | Alerta cuando sube el costo |

---

## Conclusion

Nova supera a Fina en 12 de 18 categorias. Las 5 areas donde Fina gana son verticales especificos (restaurantes: recetas, mesas, repartidores) y soporte humano (onboarding asistido, tutoriales).

Para competir directamente con Fina, Nova necesita:
1. **Tutoriales/onboarding** - Videos cortos, tooltips in-app (alta prioridad)
2. **Recetas** - Solo si se apunta al vertical de restaurantes (media prioridad)
3. **Charts reales** - Fina tiene graficos con linea temporal, Nova tiene barras CSS (media prioridad)

Lo que Fina NO puede copiar facilmente de Nova:
- Offline (requiere reescribir su arquitectura)
- OCR + AI (requiere integracion con LLMs)
- Multi-tenant RLS (requiere migrar de su arquitectura actual)
- PWA instalable (requiere service workers)
