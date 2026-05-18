<script setup lang="ts">
/**
 * Landing page for Nala.
 *
 * Clean, professional design. No miniature mockups or decorative
 * artifacts. Every section is readable and interactive.
 */

import {
  ArrowRight,
  MessageCircle,
  Zap,
  PackageCheck,
  BarChart3,
  Check,
  ShieldCheck,
  CheckCircle2,
  User,
  Coffee,
  Store,
  Smartphone,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  ChevronRight,
} from "lucide-vue-next";

definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-[#161616]">

    <!-- ============================================================ -->
    <!-- NAV -->
    <!-- ============================================================ -->
    <header class="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <NuxtLink to="/" class="text-xl font-bold tracking-tight text-[#ff321f]">Nala</NuxtLink>
        <nav class="flex items-center gap-6">
          <NuxtLink to="/auth/login" class="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block">Entrar</NuxtLink>
          <NuxtLink to="/auth/signup" class="rounded-xl bg-[#ff321f] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#ff321f]/20 transition-all hover:shadow-xl hover:shadow-[#ff321f]/30">
            Crear cuenta gratis
          </NuxtLink>
        </nav>
      </div>
    </header>

    <!-- ============================================================ -->
    <!-- HERO -->
    <!-- ============================================================ -->
    <section class="hero-gradient relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-16">
      <!-- Subtle animated circles (not coin helix) -->
      <div class="absolute inset-0 overflow-hidden">
        <div class="hero-circle absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full border border-white/10" />
        <div class="hero-circle-delay absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full border border-white/8" />
        <div class="hero-circle absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-white/5" />
      </div>

      <div class="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
          <Smartphone :size="16" />
          POS + Tienda Online para comerciantes
        </div>

        <h1 class="text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
          Vende facil.<br>Controla todo.
        </h1>

        <p class="mx-auto mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/80 md:text-xl">
          Registra ventas en 2 toques, lleva inventario sin esfuerzo y recibe pedidos online con tu propia tienda.
        </p>

        <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink
            to="/auth/signup"
            class="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-[#ff321f] shadow-[0_20px_50px_rgba(0,0,0,.15)] transition-all hover:scale-105 hover:shadow-[0_25px_60px_rgba(0,0,0,.2)]"
          >
            Empezar gratis <ArrowRight :size="18" />
          </NuxtLink>
          <span class="text-sm font-medium text-white/60">Sin tarjeta. Listo en 2 minutos.</span>
        </div>
      </div>

      <!-- Scroll indicator -->
      <div class="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div class="scroll-indicator h-10 w-6 rounded-full border-2 border-white/30">
          <div class="scroll-dot mx-auto mt-2 h-2 w-1 rounded-full bg-white/60" />
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- VALUE PROPS (3 columns) -->
    <!-- ============================================================ -->
    <section class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div class="rounded-3xl bg-[#ff321f] p-8 text-white shadow-xl shadow-[#ff321f]/15 md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
              <CreditCard :size="28" />
            </div>
            <h3 class="text-2xl font-bold tracking-tight">Venta en 2 toques</h3>
            <p class="mt-3 text-base leading-relaxed text-white/80">Toca el producto, selecciona como te pagan, listo. Inventario, cliente y estadisticas se actualizan solos.</p>
          </div>

          <div class="rounded-3xl bg-[#f8f8f8] p-8 md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#31c863] text-white shadow-lg shadow-[#31c863]/20">
              <PackageCheck :size="28" />
            </div>
            <h3 class="text-2xl font-bold tracking-tight text-gray-900">Inventario automatico</h3>
            <p class="mt-3 text-base leading-relaxed text-gray-600">Cada venta descuenta stock. Alertas cuando falta mercancia. Prediccion de cuando se agota.</p>
          </div>

          <div class="rounded-3xl bg-[#f8f8f8] p-8 md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3e9ed5] text-white shadow-lg shadow-[#3e9ed5]/20">
              <ShoppingBag :size="28" />
            </div>
            <h3 class="text-2xl font-bold tracking-tight text-gray-900">Tienda online incluida</h3>
            <p class="mt-3 text-base leading-relaxed text-gray-600">Tu catalogo en tunegocio.novaincs.com. Pedidos por WhatsApp o carrito. Stock conectado.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- "LA VENTA GENERA EL DATO" -->
    <!-- ============================================================ -->
    <section class="bg-[#fff8f5] py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div class="mb-4 inline-flex rounded-full border border-[#f0c7bd] px-4 py-1.5 text-xs font-semibold text-[#d68172]">Filosofia Nala</div>
            <h2 class="text-4xl font-bold leading-[0.95] tracking-tight text-[#ff321f] md:text-5xl lg:text-6xl">
              La venta genera el dato.
            </h2>
            <p class="mt-6 max-w-md text-lg leading-relaxed text-[#8b4c43]">
              El vendedor no llena un sistema. Vende, y Nala organiza inventario, clientes, estadisticas y contabilidad automaticamente.
            </p>
            <NuxtLink to="/auth/signup" class="mt-8 inline-flex items-center gap-2 text-base font-bold text-[#ff321f] hover:gap-3 transition-all">
              Empezar ahora <ChevronRight :size="18" />
            </NuxtLink>
          </div>

          <!-- What happens when you sell -->
          <div class="space-y-4">
            <div
              v-for="(item, i) in [
                { icon: Zap, color: 'bg-[#ff321f]', title: 'Venta registrada', desc: 'Producto, monto, metodo de pago. 2 toques.' },
                { icon: PackageCheck, color: 'bg-[#31c863]', title: 'Stock actualizado', desc: 'Se descuenta automaticamente. Alerta si queda poco.' },
                { icon: User, color: 'bg-[#3e9ed5]', title: 'Cliente creado', desc: 'Se registra con nombre y telefono. Historial de compras.' },
                { icon: BarChart3, color: 'bg-[#ff8a78]', title: 'Reporte listo', desc: 'Ventas del dia, margen, top productos. Sin hacer nada.' },
              ]"
              :key="i"
              class="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" :class="item.color">
                <component :is="item.icon" :size="22" />
              </div>
              <div>
                <h4 class="text-base font-bold text-gray-900">{{ item.title }}</h4>
                <p class="mt-1 text-sm text-gray-500">{{ item.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- FEATURES GRID -->
    <!-- ============================================================ -->
    <section class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-4 py-1.5 text-xs font-semibold text-[#d68172]">Lo esencial para vender mejor</div>
          <h2 class="text-4xl font-bold leading-[0.95] tracking-tight text-[#ff321f] md:text-5xl">
            Todo lo que antes estaba regado, ahora se organiza solo.
          </h2>
          <p class="mt-6 text-lg leading-relaxed text-gray-500">
            Nala convierte cada venta en inventario actualizado, cliente registrado y reporte listo.
          </p>
        </div>

        <div class="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          <article class="rounded-3xl bg-[#fff4ef] p-8 transition-all hover:shadow-lg md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff321f] text-white shadow-lg shadow-[#ff321f]/20"><Zap :size="28" /></div>
            <h3 class="text-2xl font-bold tracking-tight text-[#ff321f]">Ventas rapidas</h3>
            <p class="mt-3 text-base leading-relaxed text-[#8b4c43]">Registra una venta en dos toques. Producto, monto y listo. Sin formularios.</p>
          </article>
          <article class="rounded-3xl bg-white p-8 ring-1 ring-gray-100 transition-all hover:shadow-lg md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#31c863] text-white shadow-lg shadow-[#31c863]/20"><PackageCheck :size="28" /></div>
            <h3 class="text-2xl font-bold tracking-tight text-gray-900">Inventario automatico</h3>
            <p class="mt-3 text-base leading-relaxed text-gray-600">Cada venta descuenta stock y alerta cuando falta mercancia.</p>
          </article>
          <article class="rounded-3xl bg-white p-8 ring-1 ring-gray-100 transition-all hover:shadow-lg md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff8a78] text-white shadow-lg shadow-[#ff8a78]/20"><MessageCircle :size="28" /></div>
            <h3 class="text-2xl font-bold tracking-tight text-gray-900">Clientes y WhatsApp</h3>
            <p class="mt-3 text-base leading-relaxed text-gray-600">Cobra fiados con mensajes listos. Clientes se crean al vender.</p>
          </article>
          <article class="rounded-3xl bg-[#fff4ef] p-8 transition-all hover:shadow-lg md:p-10">
            <div class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3e9ed5] text-white shadow-lg shadow-[#3e9ed5]/20"><BarChart3 :size="28" /></div>
            <h3 class="text-2xl font-bold tracking-tight text-[#ff321f]">Reportes simples</h3>
            <p class="mt-3 text-base leading-relaxed text-[#8b4c43]">Una pagina, tres tabs. Ventas, productos top, dinero por cobrar.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- TESTIMONIALS -->
    <!-- ============================================================ -->
    <section class="bg-[#fff8f5] py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-4 py-1.5 text-xs font-semibold text-[#d68172]">Historias reales</div>
          <h2 class="text-4xl font-bold leading-[0.95] tracking-tight text-[#ff321f] md:text-5xl">
            Hecho para comerciantes que no tienen tiempo que perder.
          </h2>
        </div>

        <div class="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <article class="rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-md">
            <div class="mb-6 flex items-center gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c99a70] to-[#69442d]"><Store :size="24" class="text-white" /></div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Carlos</h3>
                <p class="text-sm font-medium text-[#ff321f]/70">Bodega · 80 productos</p>
              </div>
            </div>
            <p class="text-xl font-semibold leading-snug tracking-tight text-gray-900">"Antes cerraba el dia contando el cuaderno. Ahora vendo y Nala me dice que salio y que queda."</p>
            <div class="mt-6 flex items-center gap-2 text-sm font-semibold text-[#31c863]"><CheckCircle2 :size="18" /> Inventario al dia</div>
          </article>

          <article class="rounded-3xl bg-[#ff321f] p-8 text-white shadow-xl shadow-[#ff321f]/20">
            <div class="mb-6 flex items-center gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20"><TrendingUp :size="24" /></div>
              <div>
                <h3 class="text-lg font-bold">Maria</h3>
                <p class="text-sm font-medium text-white/70">Mini-market · 420 productos</p>
              </div>
            </div>
            <p class="text-xl font-semibold leading-snug tracking-tight">"Importe mis productos, active la tienda online y veo reportes sin abrir diez pantallas."</p>
            <div class="mt-6 flex items-center gap-2 text-sm font-semibold text-white/80"><CheckCircle2 :size="18" /> Reportes simples</div>
          </article>

          <article class="rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-md">
            <div class="mb-6 flex items-center gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f6bf81] to-[#8c4b19]"><Coffee :size="24" class="text-white" /></div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Cafeteria</h3>
                <p class="text-sm font-medium text-[#ff321f]/70">2 ayudantes · pedidos diarios</p>
              </div>
            </div>
            <p class="text-xl font-semibold leading-snug tracking-tight text-gray-900">"Los pedidos llegan online, el stock se mueve solo y los fiados ya no se pierden."</p>
            <div class="mt-6 flex items-center gap-2 text-sm font-semibold text-[#31c863]"><CheckCircle2 :size="18" /> Pedidos conectados</div>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- PRICING -->
    <!-- ============================================================ -->
    <section class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-4 py-1.5 text-xs font-semibold text-[#d68172]">Planes simples</div>
          <h2 class="text-4xl font-bold leading-[0.95] tracking-tight text-[#ff321f] md:text-5xl">
            Empieza gratis. Crece cuando tu negocio lo pida.
          </h2>
        </div>

        <div class="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-3">
          <article class="rounded-3xl bg-[#fafafa] p-8 ring-1 ring-gray-100">
            <h3 class="text-2xl font-bold text-gray-900">Gratis</h3>
            <p class="mt-2 text-sm text-gray-500">Para probar Nala y dejar el cuaderno.</p>
            <div class="mt-8 flex items-end gap-1"><span class="text-5xl font-bold tracking-tight text-gray-900">$0</span><span class="mb-1.5 text-sm text-gray-400">/mes</span></div>
            <ul class="mt-8 space-y-3 text-sm text-gray-600">
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Ventas rapidas</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Inventario basico</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Clientes basicos</li>
            </ul>
            <NuxtLink to="/auth/signup" class="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-[#ff321f] ring-1 ring-gray-200 transition-all hover:ring-[#ff321f]/30">Empezar gratis</NuxtLink>
          </article>

          <article class="relative rounded-3xl bg-[#ff321f] p-8 text-white shadow-2xl shadow-[#ff321f]/25">
            <div class="absolute right-6 top-6 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#ff321f]">Popular</div>
            <h3 class="text-2xl font-bold">Pro</h3>
            <p class="mt-2 text-sm text-white/70">Para negocios que venden por WhatsApp y online.</p>
            <div class="mt-8 flex items-end gap-1"><span class="text-5xl font-bold tracking-tight">$9</span><span class="mb-1.5 text-sm text-white/50">/mes</span></div>
            <ul class="mt-8 space-y-3 text-sm text-white/85">
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0" />Tienda online</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0" />Reportes con IA</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0" />Fiados por WhatsApp</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0" />Importar productos</li>
            </ul>
            <NuxtLink to="/auth/signup" class="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-[#ff321f] shadow-lg transition-all hover:shadow-xl">Probar Pro</NuxtLink>
          </article>

          <article class="rounded-3xl bg-[#fafafa] p-8 ring-1 ring-gray-100">
            <h3 class="text-2xl font-bold text-gray-900">Enterprise</h3>
            <p class="mt-2 text-sm text-gray-500">Para equipos con necesidades especiales.</p>
            <div class="mt-8"><span class="text-3xl font-bold tracking-tight text-gray-900">A medida</span></div>
            <ul class="mt-8 space-y-3 text-sm text-gray-600">
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Consultoria</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Integraciones</li>
              <li class="flex gap-2.5"><Check :size="18" class="mt-0.5 shrink-0 text-[#31c863]" />Soporte prioritario</li>
            </ul>
            <NuxtLink to="/auth/signup" class="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-white text-sm font-bold text-[#ff321f] ring-1 ring-gray-200 transition-all hover:ring-[#ff321f]/30">Contactar</NuxtLink>
          </article>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- COMPARISON TABLE -->
    <!-- ============================================================ -->
    <section class="bg-[#fff8f5] py-20 lg:py-28">
      <div class="mx-auto max-w-6xl px-6">
        <div class="mx-auto max-w-2xl text-center">
          <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-4 py-1.5 text-xs font-semibold text-[#d68172]">Comparacion</div>
          <h2 class="text-4xl font-bold leading-[0.95] tracking-tight text-[#ff321f] md:text-5xl">
            Ni cuaderno, ni Excel, ni ERP complicado.
          </h2>
        </div>

        <div class="mx-auto mt-16 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-lg">
          <div class="grid grid-cols-5 bg-[#ff321f] text-white">
            <div class="p-4 text-sm font-bold lg:p-5">Necesidad</div>
            <div class="p-4 text-sm font-bold lg:p-5">Nala</div>
            <div class="p-4 text-sm font-bold lg:p-5">Cuaderno</div>
            <div class="p-4 text-sm font-bold lg:p-5">Excel</div>
            <div class="p-4 text-sm font-bold lg:p-5">ERP</div>
          </div>
          <div
            v-for="row in [
              { need: 'Registrar ventas', nala: '2 toques', cuaderno: 'Manual', excel: 'Manual', erp: 'Lento' },
              { need: 'Inventario', nala: 'Automatico', cuaderno: 'No', excel: 'Formulas', erp: 'Si' },
              { need: 'Clientes y fiados', nala: 'WhatsApp', cuaderno: 'Se pierde', excel: 'Manual', erp: 'Complejo' },
              { need: 'Tienda online', nala: 'Incluida', cuaderno: 'No', excel: 'No', erp: 'Extra' },
              { need: 'Aprendizaje', nala: 'Minutos', cuaderno: 'Ninguno', excel: 'Medio', erp: 'Alto' },
            ]"
            :key="row.need"
            class="grid grid-cols-5 border-b border-gray-100 text-sm"
          >
            <div class="p-4 font-semibold text-gray-900 lg:p-5">{{ row.need }}</div>
            <div class="p-4 font-semibold text-[#31c863] lg:p-5">{{ row.nala }}</div>
            <div class="p-4 text-gray-400 lg:p-5">{{ row.cuaderno }}</div>
            <div class="p-4 text-gray-400 lg:p-5">{{ row.excel }}</div>
            <div class="p-4 text-gray-400 lg:p-5">{{ row.erp }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- FINAL CTA -->
    <!-- ============================================================ -->
    <section class="hero-gradient relative overflow-hidden py-24 text-center text-white lg:py-32">
      <div class="absolute inset-0 overflow-hidden">
        <div class="hero-circle absolute -right-32 top-0 h-[400px] w-[400px] rounded-full border border-white/10" />
        <div class="hero-circle-delay absolute -left-24 bottom-0 h-[300px] w-[300px] rounded-full border border-white/8" />
      </div>

      <div class="relative z-10 mx-auto max-w-3xl px-6">
        <div class="mx-auto mb-6 inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
          Sin riesgo · Sin configuracion complicada
        </div>
        <h2 class="text-4xl font-bold leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
          Digitaliza tu negocio sin dejar de vender.
        </h2>
        <p class="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/80">
          Empieza con ventas e inventario basico. Si Nala no te ahorra tiempo desde la primera semana, no pagas Pro.
        </p>
        <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink to="/auth/signup" class="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-8 text-base font-bold text-[#ff321f] shadow-[0_20px_50px_rgba(0,0,0,.15)] transition-all hover:scale-105">
            Empieza ahora <ArrowRight :size="18" />
          </NuxtLink>
          <NuxtLink to="/auth/login" class="inline-flex h-14 items-center rounded-2xl border border-white/40 bg-white/10 px-8 text-base font-semibold backdrop-blur-sm transition-all hover:bg-white/20">
            Ver demo
          </NuxtLink>
        </div>
        <div class="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-white/70">
          <ShieldCheck :size="18" /> Garantia sin riesgo: prueba Nala antes de pagar.
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- FOOTER -->
    <!-- ============================================================ -->
    <footer class="border-t border-gray-100 bg-white py-10">
      <div class="mx-auto max-w-6xl px-6 text-center">
        <p class="text-sm font-medium text-gray-400">Nala — POS + Tienda Online para comerciantes</p>
        <p class="mt-1 text-sm text-gray-300">Hecho en Venezuela para Venezuela</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.hero-gradient {
  background:
    radial-gradient(circle at 30% 40%, rgba(239, 48, 35, 0.8) 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, rgba(229, 67, 143, 0.6) 0%, transparent 50%),
    linear-gradient(135deg, #e34c8f 0%, #ef3824 50%, #ffc99a 100%);
}

/* Subtle floating circles */
.hero-circle {
  animation: float 20s ease-in-out infinite;
}
.hero-circle-delay {
  animation: float 25s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(20px, -30px); }
  50% { transform: translate(-15px, 20px); }
  75% { transform: translate(25px, 15px); }
}

/* Scroll indicator bounce */
.scroll-indicator {
  animation: none;
}
.scroll-dot {
  animation: scrollBounce 2s ease-in-out infinite;
}

@keyframes scrollBounce {
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(12px); opacity: 0.3; }
}
</style>
