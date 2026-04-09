# Decisión: Pipeline OCR en Detalle + Sin Restaurantes

> Cómo funciona la lectura de facturas multi-producto en producción, qué puede fallar, cómo se guarda en la DB, cómo reducir costos de LLM, y por qué Nala no atiende restaurantes.

---

## 1. Sin Restaurantes

Nala no atiende restaurantes. La complejidad del rubro de comida (gestión de mesas, recetas con ingredientes, kitchen display, propinas, pedidos online, delivery) requiere un producto vertical dedicado (como Toast en EEUU). Intentar cubrir restaurantes diluye el producto y agrega complejidad que el resto de comerciantes no necesita.

**Nala atiende:** Ferreterías, tiendas de ropa, autopartes, peluquerías, bodegas, farmacias, tiendas de electrónica, librerías, tiendas de cosméticos, distribuidoras de alimentos, y cualquier comercio que venda productos (no platos preparados).

**Lo que se elimina del producto:**
- Gestión de mesas
- Recetas con descuento automático de ingredientes
- Seguimiento de repartidores
- Roles de mesonero

**Lo que se mantiene (aplica a todos los comercios):**
- Registro de ventas rápido
- Inventario con variantes
- Cuentas por cobrar/pagar
- Reportes
- WhatsApp bidireccional
- OCR de facturas
- Todo lo demás

---

## 2. Cómo Lee una Factura con Múltiples Productos

### El API call

GPT-4o-mini vision recibe la imagen completa de la factura. No la procesa línea por línea. Ve toda la factura como un humano: detecta la tabla, entiende columnas (descripción, cantidad, precio, total), y extrae cada fila.

Se usa **structured output** (constrained decoding de OpenAI): el modelo está obligado a devolver JSON válido que cumpla un schema definido. No es "por favor devuelve JSON". Es una restricción a nivel de generación de tokens.

```typescript
// Schema Zod que define la estructura esperada
const InvoiceSchema = z.object({
  supplier: z.string(),
  invoice_number: z.string().optional(),
  date: z.string(),
  items: z.array(z.object({
    description: z.string(),
    sku: z.string().optional(),
    quantity: z.number(),
    unit_price: z.number(),
    line_total: z.number()
  })),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  total: z.number()
});

// El API call
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{
    role: "system",
    content: "Extrae datos de facturas de proveedores. Devuelve JSON con proveedor, fecha, items (descripción, SKU si visible, cantidad, precio unitario, total línea) y total."
  }, {
    role: "user",
    content: [
      { type: "image_url", image_url: { url: imageBase64 } },
      { type: "text", text: `Productos del negocio para matching:\n${productList}` }
    ]
  }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "invoice_extraction",
      schema: zodToJsonSchema(InvoiceSchema),
      strict: true  // constrained decoding: 100% schema-valid
    }
  }
});
```

Con `strict: true`, el modelo **no puede** devolver JSON inválido, campos faltantes, o tipos incorrectos. Esto elimina el problema de parseo.

### Qué devuelve para una factura de 20 productos

```json
{
  "supplier": "Distribuidora Harina VE C.A.",
  "invoice_number": "00234",
  "date": "2026-04-15",
  "items": [
    { "description": "HARINA PAN 1KG", "quantity": 10, "unit_price": 15.00, "line_total": 150.00 },
    { "description": "ACEITE DIANA 1L", "quantity": 5, "unit_price": 8.00, "line_total": 40.00 },
    { "description": "AZUCAR 1KG", "quantity": 20, "unit_price": 3.50, "line_total": 70.00 },
    ... // hasta 20 items
  ],
  "subtotal": 250.00,
  "tax": 10.00,
  "total": 260.00
}
```

---

## 3. Qué Pasa Después del LLM (El Backend, No el LLM, Guarda en la DB)

**El LLM nunca toca la base de datos.** El LLM devuelve JSON. El backend lo valida, matchea, presenta al usuario, y solo después de confirmación lo guarda.

```
Imagen → GPT-4o-mini → JSON crudo
  → Backend VALIDA schema (Zod)
  → Backend VALIDA matemáticas (qty × price = line_total, sum = total)
  → Backend MATCHEA con inventario del tenant
  → PWA MUESTRA al usuario
  → Usuario CONFIRMA o CORRIGE
  → Backend GUARDA en PostgreSQL (transacción atómica)
```

### Paso 3a: Validación del JSON

```typescript
// 1. Validar schema
const parsed = InvoiceSchema.safeParse(llmResponse);
if (!parsed.success) {
  // Schema inválido (no debería pasar con strict:true, pero por seguridad)
  return { error: "extraction_failed", retry: true };
}

// 2. Validar matemáticas
for (const item of parsed.data.items) {
  const expectedTotal = item.quantity * item.unit_price;
  if (Math.abs(expectedTotal - item.line_total) > 0.01) {
    item._warning = "math_mismatch"; // marcar para revisión del usuario
  }
}

const sumOfLines = parsed.data.items.reduce((s, i) => s + i.line_total, 0);
if (parsed.data.total && Math.abs(sumOfLines - parsed.data.total) > 0.50) {
  parsed.data._warning = "total_mismatch"; // algo no cuadra
}
```

### Paso 3b: Matching con inventario del tenant

```typescript
for (const item of parsed.data.items) {
  // 1. Buscar alias exacto (match aprendido de facturas anteriores)
  const alias = await db.query(
    `SELECT product_id FROM product_aliases 
     WHERE business_id = $1 AND supplier_id = $2 AND alias_text = $3`,
    [businessId, supplierId, item.description]
  );
  
  if (alias) {
    item.match = { type: "alias", productId: alias.product_id, confidence: 1.0 };
    continue;
  }

  // 2. Buscar por SKU exacto (si la factura tiene SKU)
  if (item.sku) {
    const skuMatch = await db.query(
      `SELECT id, name FROM product_variants 
       WHERE business_id = $1 AND sku = $2`,
      [businessId, item.sku]
    );
    if (skuMatch) {
      item.match = { type: "sku", productId: skuMatch.id, confidence: 1.0 };
      continue;
    }
  }

  // 3. Fuzzy match por nombre (pg_trgm)
  const fuzzy = await db.query(
    `SELECT id, name, similarity(name, $2) as sim 
     FROM products WHERE business_id = $1 AND similarity(name, $2) > 0.3
     ORDER BY sim DESC LIMIT 1`,
    [businessId, item.description]
  );
  
  if (fuzzy && fuzzy.sim > 0.6) {
    item.match = { type: "fuzzy", productId: fuzzy.id, name: fuzzy.name, confidence: fuzzy.sim };
  } else {
    item.match = { type: "new", confidence: 0 }; // producto nuevo
  }
}
```

### Paso 3c: Lo que ve el usuario en la PWA

```
┌─────────────────────────────────────────────────────────┐
│ Factura #00234 - Distribuidora Harina VE                │
│ 15/04/2026                                              │
│                                                         │
│ ✅ Harina PAN x10 → $150.00        [+10 al inventario] │
│    Match: alias aprendido (100%)                        │
│                                                         │
│ ✅ Aceite Diana x5 → $40.00        [+5 al inventario]  │
│    Match: nombre similar (95%)                          │
│                                                         │
│ 🆕 AZUCAR 1KG x20 → $70.00        [crear producto]    │
│    No encontrado en inventario                          │
│    → Nombre: Azúcar 1KG                                │
│    → Costo: $3.50                                       │
│    → Precio venta: [______] ← usuario completa          │
│    → Categoría: [Abarrotes ▼]                           │
│                                                         │
│ ⚠️ MANTEQUILLA x3 → $24.00        [revisar]           │
│    3 × $8.00 = $24.00 pero factura dice $25.00          │
│                                                         │
│ Total factura: $260.00                                  │
│ Total calculado: $259.00 ⚠️ diferencia: $1.00          │
│                                                         │
│ [Confirmar y registrar]  [Corregir]                     │
└─────────────────────────────────────────────────────────┘
```

- **✅ Match alias/SKU (100%):** Se registra automáticamente al confirmar
- **✅ Match fuzzy (>60%):** Se muestra el match sugerido. Si el usuario confirma, se crea alias para la próxima vez
- **🆕 Producto nuevo:** Formulario pre-llenado inline. Usuario solo completa precio de venta y categoría
- **⚠️ Error matemático:** Línea marcada en amarillo. Usuario decide cuál es el valor correcto

### Paso 3d: Guardar en PostgreSQL (transacción atómica)

```typescript
await db.transaction(async (tx) => {
  // 1. Crear el gasto
  const expense = await tx.insert(expenses, {
    business_id: businessId,
    supplier_id: supplierId,
    invoice_number: data.invoice_number,
    date: data.date,
    total: data.total,
    image_url: imageUrl, // foto original guardada en MinIO
    status: "confirmed"
  });

  for (const item of data.items) {
    // 2. Crear línea del gasto
    await tx.insert(expense_items, {
      expense_id: expense.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      product_id: item.match?.productId || null
    });

    // 3. Actualizar inventario (si hay match)
    if (item.match && item.match.type !== "new") {
      await tx.query(
        `UPDATE product_variants SET stock = stock + $1, cost = $2 
         WHERE id = $3`,
        [item.quantity, item.unit_price, item.match.productId]
      );
    }

    // 4. Crear alias (si es match nuevo confirmado)
    if (item.match?.type === "fuzzy") {
      await tx.insert(product_aliases, {
        business_id: businessId,
        supplier_id: supplierId,
        alias_text: item.description,
        product_id: item.match.productId
      });
    }

    // 5. Crear producto nuevo (si aplica)
    if (item.match?.type === "new" && item.newProduct) {
      const product = await tx.insert(products, {
        business_id: businessId,
        name: item.newProduct.name,
        category_id: item.newProduct.categoryId,
        cost: item.unit_price,
        price: item.newProduct.price
      });
      // También crear alias para este proveedor
      await tx.insert(product_aliases, {
        business_id: businessId,
        supplier_id: supplierId,
        alias_text: item.description,
        product_id: product.id
      });
    }
  }

  // 6. Crear asientos contables
  await tx.insert(accounting_entries, {
    business_id: businessId,
    date: data.date,
    debit_account: "5101", // Costo de mercancía
    credit_account: "2101", // Cuentas por pagar
    amount: data.total,
    reference: `Factura ${data.invoice_number} - ${data.supplier}`
  });
});
```

Todo en una transacción. Si algo falla, nada se guarda. Consistencia garantizada.

---

## 4. Qué Puede Fallar y Cómo se Resuelve

| Fallo | Probabilidad | Solución |
|---|---|---|
| Imagen borrosa | Media | Validar que total de líneas = total factura. Si no cuadra, pedir nueva foto |
| LLM inventa producto (hallucination) | Baja | Structured output elimina formato inválido. Validación matemática detecta datos inventados |
| LLM confunde cantidad con precio | Baja | Validar qty × price = line_total para cada línea |
| Factura con formato raro | Media | Mostrar imagen + datos extraídos lado a lado. Usuario corrige |
| Factura de 2+ páginas | Baja | Permitir múltiples fotos. Procesar cada una y concatenar |
| Abreviaciones no reconocidas | Alta | Tabla de aliases + fuzzy matching + usuario confirma primera vez |
| SKU nuevo | Media | Abre formulario de producto nuevo pre-llenado. Sin pregunta intermedia |
| API de OpenAI caída | Muy baja | Cola en Redis. Reintenta 3 veces con backoff. Si falla, notifica usuario |
| Costo de API alto a escala | Baja | Prompt caching + prompt compacto + migración a PaddleOCR en v2 |

---

## 5. Reducción de Costos de LLM

| Técnica | Ahorro | Implementación |
|---|---|---|
| **Prompt caching** (OpenAI) | 50% en system prompt | El system prompt es idéntico para todas las facturas. Se cachea automáticamente |
| **Prompt compacto** | 20-40% | System prompt mínimo (~100 tokens). Solo schema + instrucción corta |
| **Structured output** | Reduce output | El modelo no genera explicaciones. Solo JSON |
| **Lista de productos filtrada** | Reduce input | No enviar 500 productos. Enviar solo los 50 más comprados a ese proveedor |
| **Cache de resultados** | 100% en duplicados | Hash SHA-256 de la imagen. Si ya se procesó, devolver resultado cacheado |
| **Batch API** (OpenAI) | 50% descuento | Para facturas que no son urgentes, procesarlas en batch nocturno |

**Costo optimizado por factura:** ~$0.002-0.005
**30 facturas/mes por negocio:** ~$0.06-0.15/mes
**1,000 negocios × 30 facturas:** ~$60-150/mes total en API

---

## 6. Resumen de la Arquitectura OCR

```
USUARIO                    NALA BACKEND                    SERVICIOS
                                                          
Toma foto ──────────────► Recibe imagen                   
(PWA cámara)               │                              
                           ├─ Valida formato/tamaño       
                           ├─ Guarda en MinIO              
                           ├─ Carga productos del tenant   
                           ├─ Filtra por proveedor (si se conoce)
                           │                              
                           ├─ Llama GPT-4o-mini ─────────► OpenAI API
                           │  (structured output)          (constrained decoding)
                           │                              
                           ◄─ Recibe JSON ◄───────────────
                           │                              
                           ├─ Valida schema (Zod)         
                           ├─ Valida matemáticas          
                           ├─ Busca aliases (PostgreSQL)  
                           ├─ Busca SKU (PostgreSQL)      
                           ├─ Fuzzy match (pg_trgm)       
                           │                              
Muestra datos ◄────────── Devuelve datos + matches        
con indicadores            │                              
                           │                              
Confirma/corrige ────────► Recibe confirmación            
                           │                              
                           ├─ Transacción atómica:        
                           │  INSERT expense              
                           │  INSERT expense_items        
                           │  UPDATE stock                
                           │  INSERT aliases (nuevos)     
                           │  INSERT products (nuevos)    
                           │  INSERT accounting_entries   
                           │                              
Notificación ◄──────────── "Factura registrada. Stock     
"Factura registrada"        actualizado."                 
```
