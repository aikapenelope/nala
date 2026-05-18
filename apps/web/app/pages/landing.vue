<script setup lang="ts">
/**
 * Landing page for Nala.
 *
 * Premium design with hero gradient, feature cards, testimonials,
 * pricing, and comparison table. No auth required.
 */

import {
  Globe,
  ChevronDown,
  Home,
  Mouse,
  MessageCircle,
  Zap,
  PackageCheck,
  BarChart3,
  Check,
  ShieldCheck,
  CheckCircle2,
  Store,
  Camera,
  ReceiptText,
  User,
  Coffee,
  Plus,
} from "lucide-vue-next";

definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen bg-[#eda58d] font-sans text-[#161616]">
    <main class="mx-auto w-full bg-white lg:w-[80vw] lg:max-w-[1280px]">

      <!-- ============================================================ -->
      <!-- HERO -->
      <!-- ============================================================ -->
      <section class="hero-gradient soft-noise relative flex min-h-screen items-center justify-center overflow-hidden">
        <header class="absolute left-7 right-7 top-9 z-20 flex items-center justify-between lg:left-11 lg:right-11 lg:top-12">
          <NuxtLink to="/" class="text-[24px] font-semibold tracking-tight text-white lg:text-[23px]">Nala</NuxtLink>
          <nav class="hidden items-center gap-7 text-[10px] font-medium text-white md:flex">
            <span class="inline-flex items-center gap-1 opacity-95">
              <Globe :size="13" /> ES <ChevronDown :size="10" />
            </span>
            <NuxtLink to="/auth/login" class="opacity-90">Entrar</NuxtLink>
            <NuxtLink to="/auth/signup" class="rounded-lg bg-white px-4 py-2 text-[10px] font-semibold text-[#ef3824] shadow-sm">Crear cuenta</NuxtLink>
          </nav>
        </header>

        <!-- Coin helix decoration -->
        <div class="coin-helix left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block lg:scale-[1.25]">
          <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        </div>

        <div class="relative z-20 mx-auto max-w-[760px] px-6 text-center">
          <p class="mb-5 text-[14px] font-medium text-white/90 md:text-[16px]">POS + Tienda Online para comerciantes</p>
          <h1 class="text-[58px] font-semibold leading-[0.9] tracking-[-0.07em] text-white sm:text-[76px] lg:text-[104px]">
            Vende facil.<br>Controla todo.
          </h1>
        </div>

        <!-- Bottom CTA -->
        <div class="absolute bottom-[96px] left-1/2 z-20 hidden -translate-x-1/2 text-center text-white md:block">
          <p class="mb-3 text-[13px] font-semibold leading-[1.05] tracking-[-0.03em]">POS + Tienda Online para comerciantes</p>
          <div class="flex justify-center gap-2">
            <span class="inline-flex h-[25px] items-center gap-1 rounded-md border border-white/60 bg-white/10 px-2 text-[8px] font-semibold text-white">App Store</span>
            <span class="inline-flex h-[25px] items-center gap-1 rounded-md border border-white/60 bg-white/10 px-2 text-[8px] font-semibold text-white">Google Play</span>
          </div>
        </div>

        <!-- Scroll hint -->
        <div class="absolute bottom-4 left-7 z-30 hidden items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[9px] font-medium text-white md:flex">
          <Mouse :size="11" /> Desliza
        </div>

        <!-- Bottom pill nav -->
        <div class="absolute bottom-3 left-1/2 z-30 hidden -translate-x-1/2 items-center rounded-full bg-[#f13b2a] p-1 text-[9px] font-medium text-white shadow-[0_14px_35px_rgba(189,42,31,.34)] md:flex">
          <span class="flex h-[27px] w-[34px] items-center justify-center rounded-full bg-white/12"><Home :size="13" /></span>
          <span class="rounded-full px-4 py-2">Ventas</span>
          <span class="rounded-full px-4 py-2">Tienda</span>
          <span class="rounded-full px-4 py-2">Control</span>
        </div>

        <button class="absolute bottom-4 right-4 z-30 hidden h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white md:flex" aria-label="Abrir chat">
          <MessageCircle :size="16" />
        </button>
      </section>

      <!-- ============================================================ -->
      <!-- TWO-COLUMN FEATURE CARDS -->
      <!-- ============================================================ -->
      <section class="grid grid-cols-1 bg-white md:grid-cols-2">
        <!-- Left: POS card -->
        <section class="relative h-[360px] overflow-hidden bg-[#ff321f] text-white lg:h-[420px]">
          <div class="absolute left-1/2 top-[32px] z-10 -translate-x-1/2">
            <div class="h-[166px] w-[82px] rounded-[15px] bg-[#202020] p-[4px] shadow-[0_22px_35px_rgba(153,29,21,.35)] ring-1 ring-white/35">
              <div class="relative h-full overflow-hidden rounded-[12px] bg-[#ffe7df] text-[#181818]">
                <div class="absolute left-1/2 top-[5px] h-[8px] w-[34px] -translate-x-1/2 rounded-full bg-[#1f1f1f]" />
                <div class="px-[8px] pt-[18px]">
                  <p class="text-[7px] font-semibold">Nueva venta</p>
                  <div class="mt-[7px] rounded-md bg-white p-[6px] shadow-sm">
                    <div class="mb-1 flex items-center gap-1 text-[6px] font-semibold text-[#ff321f]">
                      <span class="h-[5px] w-[5px] rounded-full bg-[#2bc767]" /> Bodega
                    </div>
                    <p class="text-[13px] font-semibold tracking-[-0.04em]">Bs 120</p>
                    <p class="text-[5px] font-medium text-black/45">2 productos · Inventario actualizado</p>
                  </div>
                  <div class="mt-[8px] h-[11px] rounded-sm bg-[#ff321f]" />
                  <div class="mt-[7px] grid grid-cols-3 gap-[3px] text-center text-[7px] font-medium">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span /><span>0</span><span />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="absolute right-[30px] top-[92px] hidden w-[155px] border-t border-white/45 pt-3 md:block">
            <h2 class="text-[19px] font-semibold leading-[.95] tracking-[-0.045em]">Venta en dos<br>toques</h2>
            <p class="mt-2 text-[8px] font-medium leading-tight text-white/80">Cada venta actualiza inventario, cliente y estadisticas al instante.</p>
          </div>
          <div class="absolute bottom-3 left-3 flex gap-1 text-[7px] text-white/60">
            <span class="font-semibold text-white/80">Nala</span><span>POS</span><span>·</span><span>Online</span><span>·</span><span>WhatsApp</span>
          </div>
        </section>

        <!-- Right: App card -->
        <section class="teal-stage relative h-[360px] overflow-hidden text-white lg:h-[420px]">
          <div class="absolute left-0 top-0 h-full w-full bg-black/10" />
          <div class="absolute -right-9 top-[-44px] h-[250px] w-[250px] rounded-full border-[26px] border-[#823545]/75" />
          <div class="absolute right-[86px] top-[98px] z-20">
            <div class="h-[185px] w-[92px] rounded-[17px] bg-[#191919] p-[4px] shadow-[0_28px_35px_rgba(0,0,0,.42)] ring-1 ring-white/30">
              <div class="relative h-full overflow-hidden rounded-[13px] bg-gradient-to-br from-[#ffa28e] via-[#ff887c] to-[#ffd2a9] px-[8px] pt-[26px] text-white">
                <div class="absolute left-1/2 top-[6px] h-[8px] w-[37px] -translate-x-1/2 rounded-full bg-[#1d1d1d]" />
                <h3 class="text-[10px] font-semibold leading-none tracking-[-0.04em]">Simple, rapido y sin enredos</h3>
                <p class="mt-2 text-[5px] font-medium leading-tight text-white/80">Vende, cobra fiado y recibe pedidos online desde el celular.</p>
                <div class="absolute bottom-[28px] left-[8px] right-[8px] h-[12px] rounded bg-white text-center text-[5px] font-semibold leading-[12px] text-[#ff321f]">Crear venta</div>
              </div>
            </div>
          </div>
          <div class="absolute bottom-[118px] left-0 z-20 w-[310px] -translate-x-[1px]">
            <h2 class="text-[28px] font-semibold leading-[.9] tracking-[-0.055em]">Todo tu negocio,<br>en una app.</h2>
            <p class="mt-4 text-[8px] font-semibold text-white/90">No es un ERP. Es la herramienta que reemplaza el cuaderno.</p>
            <NuxtLink to="/auth/signup" class="mt-3 inline-flex h-[21px] items-center rounded-md bg-white px-3 text-[8px] font-semibold text-[#ff321f]">Empezar</NuxtLink>
          </div>
        </section>
      </section>

      <!-- ============================================================ -->
      <!-- STOREFRONT SECTION -->
      <!-- ============================================================ -->
      <section class="relative min-h-[590px] bg-white px-8 pt-[54px] text-center text-[#ff321f]">
        <div class="mx-auto mb-3 inline-flex rounded-full border border-[#f0c7bd] px-2 py-1 text-[7px] font-semibold text-[#d68172]">Nala Shop</div>
        <h2 class="mx-auto max-w-[300px] text-[20px] font-semibold leading-[1.05] tracking-[-0.05em]">Pedidos online? Listo.<br>Fiados por WhatsApp? Tambien.</h2>
        <div class="pink-stage relative mx-auto mt-8 h-[175px] max-w-[310px] overflow-hidden rounded-md shadow-[0_22px_55px_rgba(229,80,69,.18)]">
          <div class="stage-cylinder left-[-18px] top-[22px] h-[120px] w-[120px]" />
          <div class="stage-cylinder bottom-[-44px] left-[21px] h-[115px] w-[244px]" />
          <div class="stage-cylinder right-[-22px] top-[86px] h-[82px] w-[112px]" />
          <div class="absolute left-[145px] top-[34px] h-[104px] w-[22px] origin-bottom rotate-[27deg] rounded-full bg-gradient-to-b from-white/65 to-[#df4552] shadow-[0_18px_30px_rgba(166,40,48,.25)]" />
        </div>
        <h3 class="mx-auto mt-8 max-w-[310px] text-[30px] font-semibold leading-[.92] tracking-[-0.06em]">Tu tienda online, conectada al inventario</h3>
        <p class="mx-auto mt-4 max-w-[280px] text-[11px] font-medium leading-snug text-[#ff321f]/70">Publica nombre, precio y foto. Cuando alguien compra, Nala descuenta stock y registra al cliente automaticamente.</p>
        <NuxtLink to="/auth/signup" class="mt-6 inline-flex h-[25px] items-center rounded-md bg-[#ff321f] px-4 text-[8px] font-semibold text-white">Conocer mas</NuxtLink>
      </section>

      <!-- ============================================================ -->
      <!-- "LA VENTA GENERA EL DATO" SECTION -->
      <!-- ============================================================ -->
      <section class="relative min-h-[686px] overflow-hidden bg-white px-5 pt-10 lg:px-0 lg:pt-0">
        <!-- Floating cards (desktop only) -->
        <div class="absolute left-[190px] top-[38px] hidden h-[72px] w-[90px] overflow-hidden rounded-lg bg-[#dcc1a5] shadow-[0_18px_35px_rgba(0,0,0,.10)] md:block">
          <div class="absolute inset-0 bg-gradient-to-br from-[#c9a67f] via-[#f0dcc4] to-[#8b5e43]" />
          <Store class="absolute left-[28px] top-[19px] text-[#4f3021]" :size="34" />
        </div>

        <div class="absolute right-[176px] top-[48px] hidden h-[101px] w-[100px] rounded-xl bg-[#3e9ed5] p-[7px] shadow-[0_18px_32px_rgba(62,158,213,.18)] md:block">
          <div class="h-full rounded-lg bg-white p-[10px] text-left">
            <div class="flex items-center justify-between text-[8px] font-semibold">
              <span class="inline-flex items-center gap-1"><span class="h-[9px] w-[9px] rounded-full bg-[#2c74c9]" />POS</span>
            </div>
            <p class="mt-4 text-[18px] font-semibold tracking-[-0.05em] text-[#210b0b]">Bs 120</p>
            <p class="text-[6px] font-medium text-black/45">Venta registrada</p>
            <div class="mt-3 h-[16px] rounded bg-[#f7f7f7] text-center text-[7px] font-semibold leading-[16px] text-[#1b1b1b]">Guardar</div>
          </div>
        </div>

        <div class="absolute left-[135px] top-[150px] hidden h-[100px] w-[100px] rounded-lg bg-[#31c863] p-3 text-white shadow-[0_22px_32px_rgba(49,200,99,.2)] md:block">
          <p class="flex items-center gap-1 text-[7px] font-medium text-white/70">
            <PackageCheck :size="8" /> Inventario
          </p>
          <p class="mt-1 text-[16px] font-semibold tracking-[-0.04em]">-1 Cafe</p>
          <p class="text-[13px] font-semibold tracking-[-0.03em]">24 en stock</p>
          <span class="absolute bottom-3 left-3 rounded-full bg-white/18 px-2 py-1 text-[7px] font-semibold">Automatico</span>
        </div>

        <div class="absolute left-[245px] top-[287px] hidden h-[92px] w-[98px] rounded-xl bg-[#ffd8f7] p-[9px] text-center shadow-[0_18px_34px_rgba(235,119,211,.16)] md:block">
          <div class="mx-auto h-[22px] w-[22px] rounded-full bg-gradient-to-br from-[#d16a72] to-[#7d3e3a]" />
          <p class="mt-2 text-[7px] font-semibold text-[#72344a]">Cliente creado</p>
          <div class="mt-3 rounded-md bg-white/65 py-1 text-[6px] font-medium text-[#9b6c8b]">Fiado por WhatsApp</div>
          <div class="mt-2 rounded-md bg-white py-1 text-[6px] font-semibold text-[#733f5f]">Enviar cobro</div>
        </div>

        <div class="absolute right-[126px] top-[232px] hidden h-[105px] w-[132px] overflow-hidden rounded-lg bg-[#704116] shadow-[0_18px_30px_rgba(112,65,22,.16)] md:block">
          <div class="absolute left-2 right-2 top-2 z-10 rounded bg-white px-2 py-1 text-left text-[7px] font-semibold text-[#4f2f18]">
            <Camera :size="8" class="mr-1 inline align-[-1px]" />Factura escaneada
          </div>
          <div class="absolute inset-0 bg-gradient-to-br from-[#5a2f12] via-[#c47735] to-[#f0bd73]" />
          <ReceiptText class="absolute bottom-5 left-10 text-white/70" :size="48" />
        </div>

        <div class="relative z-10 mx-auto pt-[145px] text-center md:w-[420px] lg:pt-[155px]">
          <h2 class="text-[50px] font-semibold leading-[.94] tracking-[-0.065em] text-[#ff321f] md:text-[62px]">La venta<br>genera el dato</h2>
          <p class="mx-auto mt-5 max-w-[330px] text-[13px] font-medium leading-snug text-[#ff321f]/65">El vendedor no llena un sistema. Vende, y Nala organiza inventario, clientes, estadisticas y contabilidad simple.</p>
        </div>

        <div class="absolute bottom-[-12px] left-1/2 hidden -translate-x-1/2 items-center gap-3 text-[54px] font-semibold tracking-[-0.065em] text-[#2ecb66] md:flex">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2ecb66] text-white"><Plus :size="28" /></span>
          Nala
        </div>
      </section>
    </main>

    <!-- ============================================================ -->
    <!-- FEATURES GRID -->
    <!-- ============================================================ -->
    <section class="mx-auto w-full bg-white px-5 py-20 lg:w-[80vw] lg:max-w-[1280px] lg:px-20 lg:py-24">
      <div class="mx-auto max-w-[880px] text-center">
        <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-3 py-1 text-[11px] font-semibold text-[#d68172]">Lo esencial para vender mejor</div>
        <h2 class="text-[44px] font-semibold leading-[.92] tracking-[-0.065em] text-[#ff321f] md:text-[68px]">Todo lo que antes estaba regado, ahora se organiza solo.</h2>
        <p class="mx-auto mt-6 max-w-[560px] text-[15px] font-medium leading-snug text-[#ff321f]/65">Nala convierte cada venta en inventario actualizado, cliente registrado, reporte listo y control del negocio desde el celular.</p>
      </div>

      <div class="mx-auto mt-14 grid max-w-[980px] grid-cols-1 gap-5 md:grid-cols-2">
        <article class="rounded-[28px] bg-[#fff4ef] p-8 shadow-[0_22px_60px_rgba(229,80,69,.10)]">
          <div class="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff321f] text-white shadow-[0_16px_30px_rgba(255,50,31,.25)]"><Zap :size="28" /></div>
          <h3 class="text-[30px] font-semibold leading-[.95] tracking-[-0.055em] text-[#ff321f]">Ventas rapidas</h3>
          <p class="mt-4 text-[14px] font-medium leading-snug text-[#8b4c43]">Registra una venta en dos toques, sin formularios largos ni pasos contables. Producto, monto y listo.</p>
        </article>
        <article class="rounded-[28px] bg-white p-8 shadow-[0_22px_60px_rgba(0,0,0,.07)] ring-1 ring-[#ffe3d7]">
          <div class="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#31c863] text-white shadow-[0_16px_30px_rgba(49,200,99,.22)]"><PackageCheck :size="28" /></div>
          <h3 class="text-[30px] font-semibold leading-[.95] tracking-[-0.055em] text-[#ff321f]">Inventario automatico</h3>
          <p class="mt-4 text-[14px] font-medium leading-snug text-[#8b4c43]">Cada venta descuenta stock, alerta cuando falta mercancia y evita que vendas productos que ya no tienes.</p>
        </article>
        <article class="rounded-[28px] bg-white p-8 shadow-[0_22px_60px_rgba(0,0,0,.07)] ring-1 ring-[#ffe3d7]">
          <div class="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff8a78] text-white shadow-[0_16px_30px_rgba(255,138,120,.24)]"><MessageCircle :size="28" /></div>
          <h3 class="text-[30px] font-semibold leading-[.95] tracking-[-0.055em] text-[#ff321f]">Clientes WhatsApp</h3>
          <p class="mt-4 text-[14px] font-medium leading-snug text-[#8b4c43]">Cobra fiados con mensajes listos para enviar, crea clientes al vender y lleva control de quien debe que.</p>
        </article>
        <article class="rounded-[28px] bg-[#fff4ef] p-8 shadow-[0_22px_60px_rgba(229,80,69,.10)]">
          <div class="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3e9ed5] text-white shadow-[0_16px_30px_rgba(62,158,213,.22)]"><BarChart3 :size="28" /></div>
          <h3 class="text-[30px] font-semibold leading-[.95] tracking-[-0.055em] text-[#ff321f]">Reportes simples</h3>
          <p class="mt-4 text-[14px] font-medium leading-snug text-[#8b4c43]">Una pagina, tres tabs y numeros claros: ventas del dia, productos que mas se mueven y dinero por cobrar.</p>
        </article>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- TESTIMONIALS -->
    <!-- ============================================================ -->
    <section class="mx-auto w-full bg-[#fff8f5] px-5 py-20 lg:w-[80vw] lg:max-w-[1280px] lg:px-20 lg:py-24">
      <div class="grid items-end gap-8 md:grid-cols-[1fr_1.25fr]">
        <div>
          <div class="mb-4 inline-flex rounded-full border border-[#f0c7bd] px-3 py-1 text-[11px] font-semibold text-[#d68172]">Historias reales</div>
          <h2 class="max-w-[430px] text-[44px] font-semibold leading-[.92] tracking-[-0.065em] text-[#ff321f] md:text-[60px]">Hecho para comerciantes que no tienen tiempo que perder.</h2>
        </div>
        <p class="max-w-[520px] text-[15px] font-medium leading-snug text-[#8b4c43] md:justify-self-end">Bodegas, mini-markets, cafeterias, tiendas de ropa y peluquerias pueden digitalizarse sin aprender un ERP ni contratar soporte tecnico.</p>
      </div>

      <div class="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        <article class="rounded-[30px] bg-white p-7 shadow-[0_22px_60px_rgba(0,0,0,.07)]">
          <div class="mb-8 flex items-center gap-4">
            <div class="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-[#c99a70] via-[#f5d6bb] to-[#69442d]"><User class="ml-3 mt-3 text-[#5b3425]" :size="32" /></div>
            <div>
              <h3 class="text-[17px] font-semibold tracking-[-0.04em] text-[#161616]">Carlos</h3>
              <p class="text-[11px] font-semibold text-[#ff321f]/70">Bodega · 80 productos</p>
            </div>
          </div>
          <p class="text-[20px] font-semibold leading-[1.05] tracking-[-0.045em] text-[#ff321f]">"Antes cerraba el dia contando el cuaderno. Ahora vendo y Nala me dice que salio y que queda."</p>
          <div class="mt-8 flex items-center gap-2 text-[12px] font-semibold text-[#31c863]"><CheckCircle2 :size="16" /> Inventario al dia</div>
        </article>
        <article class="rounded-[30px] bg-[#ff321f] p-7 text-white shadow-[0_30px_70px_rgba(255,50,31,.22)]">
          <div class="mb-8 flex items-center gap-4">
            <div class="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ffb0d8] via-[#ffd9f1] to-[#9c546f]"><User class="ml-3 mt-3 text-[#7b3858]" :size="32" /></div>
            <div>
              <h3 class="text-[17px] font-semibold tracking-[-0.04em]">Maria</h3>
              <p class="text-[11px] font-semibold text-white/70">Mini-market · 420 productos</p>
            </div>
          </div>
          <p class="text-[20px] font-semibold leading-[1.05] tracking-[-0.045em]">"Importe mis productos, activo la tienda online y veo reportes sin abrir diez pantallas."</p>
          <div class="mt-8 flex items-center gap-2 text-[12px] font-semibold text-white/85"><CheckCircle2 :size="16" /> Reportes simples</div>
        </article>
        <article class="rounded-[30px] bg-white p-7 shadow-[0_22px_60px_rgba(0,0,0,.07)]">
          <div class="mb-8 flex items-center gap-4">
            <div class="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-[#f6bf81] via-[#f7e2c7] to-[#8c4b19]"><Coffee class="ml-3 mt-3 text-[#6a3c18]" :size="32" /></div>
            <div>
              <h3 class="text-[17px] font-semibold tracking-[-0.04em] text-[#161616]">Cafeteria</h3>
              <p class="text-[11px] font-semibold text-[#ff321f]/70">2 ayudantes · pedidos diarios</p>
            </div>
          </div>
          <p class="text-[20px] font-semibold leading-[1.05] tracking-[-0.045em] text-[#ff321f]">"Los pedidos llegan online, el stock se mueve solo y los fiados ya no se pierden en WhatsApp."</p>
          <div class="mt-8 flex items-center gap-2 text-[12px] font-semibold text-[#31c863]"><CheckCircle2 :size="16" /> Pedidos conectados</div>
        </article>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- PRICING -->
    <!-- ============================================================ -->
    <section class="mx-auto w-full bg-white px-5 py-20 lg:w-[80vw] lg:max-w-[1280px] lg:px-20 lg:py-24">
      <div class="mx-auto max-w-[780px] text-center">
        <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-3 py-1 text-[11px] font-semibold text-[#d68172]">Planes simples</div>
        <h2 class="text-[44px] font-semibold leading-[.92] tracking-[-0.065em] text-[#ff321f] md:text-[64px]">Empieza gratis. Crece cuando tu negocio lo pida.</h2>
      </div>

      <div class="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <article class="rounded-[32px] bg-[#fff8f5] p-8 shadow-[0_22px_60px_rgba(229,80,69,.08)] ring-1 ring-[#ffe3d7]">
          <h3 class="text-[26px] font-semibold tracking-[-0.055em] text-[#ff321f]">Gratis</h3>
          <p class="mt-2 text-[13px] font-medium text-[#8b4c43]">Para probar Nala y dejar el cuaderno.</p>
          <div class="mt-8 flex items-end gap-1 text-[#161616]"><span class="text-[52px] font-semibold leading-none tracking-[-0.07em]">$0</span><span class="mb-2 text-[12px] font-semibold text-black/45">/mes</span></div>
          <ul class="mt-8 space-y-3 text-[14px] font-medium text-[#8b4c43]">
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Ventas rapidas</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Inventario basico</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Clientes basicos</li>
          </ul>
          <NuxtLink to="/auth/signup" class="mt-9 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white text-[13px] font-semibold text-[#ff321f] shadow-sm ring-1 ring-[#ffd8cc]">Empezar gratis</NuxtLink>
        </article>
        <article class="relative rounded-[32px] bg-[#ff321f] p-8 text-white shadow-[0_30px_80px_rgba(255,50,31,.25)]">
          <div class="absolute right-7 top-7 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-[#ff321f]">Mas popular</div>
          <h3 class="text-[26px] font-semibold tracking-[-0.055em]">Pro</h3>
          <p class="mt-2 max-w-[230px] text-[13px] font-medium text-white/75">Para negocios que venden por WhatsApp y online.</p>
          <div class="mt-8 flex items-end gap-1"><span class="text-[52px] font-semibold leading-none tracking-[-0.07em]">$9</span><span class="mb-2 text-[12px] font-semibold text-white/55">/mes</span></div>
          <ul class="mt-8 space-y-3 text-[14px] font-medium text-white/85">
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-white" />Tienda online</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-white" />Reportes simples</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-white" />Fiados por WhatsApp</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-white" />Importar productos</li>
          </ul>
          <NuxtLink to="/auth/signup" class="mt-9 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white text-[13px] font-semibold text-[#ff321f] shadow-sm">Probar Pro</NuxtLink>
        </article>
        <article class="rounded-[32px] bg-[#fff8f5] p-8 shadow-[0_22px_60px_rgba(229,80,69,.08)] ring-1 ring-[#ffe3d7]">
          <h3 class="text-[26px] font-semibold tracking-[-0.055em] text-[#ff321f]">Enterprise</h3>
          <p class="mt-2 text-[13px] font-medium text-[#8b4c43]">Para operaciones con equipos y necesidades especiales.</p>
          <div class="mt-8 flex items-end gap-1 text-[#161616]"><span class="text-[42px] font-semibold leading-none tracking-[-0.07em]">A medida</span></div>
          <ul class="mt-8 space-y-3 text-[14px] font-medium text-[#8b4c43]">
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Consultoria de implementacion</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Integraciones</li>
            <li class="flex gap-2"><Check :size="16" class="mt-1 text-[#31c863]" />Soporte prioritario</li>
          </ul>
          <NuxtLink to="/auth/signup" class="mt-9 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white text-[13px] font-semibold text-[#ff321f] shadow-sm ring-1 ring-[#ffd8cc]">Hablar con Nala</NuxtLink>
        </article>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- COMPARISON TABLE -->
    <!-- ============================================================ -->
    <section class="mx-auto w-full bg-[#fff8f5] px-5 py-20 lg:w-[80vw] lg:max-w-[1280px] lg:px-20 lg:py-24">
      <div class="mx-auto max-w-[780px] text-center">
        <div class="mx-auto mb-4 inline-flex rounded-full border border-[#f0c7bd] px-3 py-1 text-[11px] font-semibold text-[#d68172]">Comparacion</div>
        <h2 class="text-[44px] font-semibold leading-[.92] tracking-[-0.065em] text-[#ff321f] md:text-[64px]">Ni cuaderno, ni Excel, ni ERP complicado.</h2>
      </div>

      <div class="mt-14 overflow-hidden rounded-[32px] bg-white shadow-[0_25px_70px_rgba(0,0,0,.08)]">
        <div class="grid grid-cols-[1.15fr_.85fr_.85fr_.85fr_.85fr] bg-[#ff321f] text-white">
          <div class="p-5 text-[13px] font-semibold">Necesidad</div>
          <div class="p-5 text-[13px] font-semibold">Nala</div>
          <div class="p-5 text-[13px] font-semibold">Cuaderno</div>
          <div class="p-5 text-[13px] font-semibold">Excel</div>
          <div class="p-5 text-[13px] font-semibold">ERP</div>
        </div>
        <div
          v-for="row in [
            { need: 'Registrar ventas', nala: '2 toques', cuaderno: 'Manual', excel: 'Manual', erp: 'Lento' },
            { need: 'Actualizar inventario', nala: 'Automatico', cuaderno: 'No', excel: 'Formulas', erp: 'Si' },
            { need: 'Clientes y fiados', nala: 'WhatsApp', cuaderno: 'Se pierde', excel: 'Manual', erp: 'Complejo' },
            { need: 'Tienda online', nala: 'Incluida', cuaderno: 'No', excel: 'No', erp: 'Extra' },
            { need: 'Curva de aprendizaje', nala: 'Minutos', cuaderno: 'Ninguna', excel: 'Media', erp: 'Alta' },
          ]"
          :key="row.need"
          class="grid grid-cols-[1.15fr_.85fr_.85fr_.85fr_.85fr] border-b border-[#ffe3d7] text-[13px] font-medium text-[#8b4c43]"
        >
          <div class="p-5 font-semibold text-[#161616]">{{ row.need }}</div>
          <div class="p-5 text-[#31c863]">{{ row.nala }}</div>
          <div class="p-5">{{ row.cuaderno }}</div>
          <div class="p-5">{{ row.excel }}</div>
          <div class="p-5">{{ row.erp }}</div>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- FINAL CTA -->
    <!-- ============================================================ -->
    <section class="mx-auto w-full px-5 pb-16 lg:w-[80vw] lg:max-w-[1280px] lg:px-0">
      <div class="hero-gradient soft-noise relative overflow-hidden rounded-none px-6 py-20 text-center text-white lg:px-20 lg:py-28">
        <div class="relative z-10 mx-auto max-w-[760px]">
          <div class="mx-auto mb-5 inline-flex rounded-full border border-white/45 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white">Sin riesgo · Sin configuracion complicada</div>
          <h2 class="text-[48px] font-semibold leading-[.9] tracking-[-0.07em] md:text-[76px]">Digitaliza tu negocio sin dejar de vender.</h2>
          <p class="mx-auto mt-6 max-w-[560px] text-[16px] font-medium leading-snug text-white/80">Empieza con ventas e inventario basico. Si Nala no te ahorra tiempo desde la primera semana, no pagas Pro.</p>
          <div class="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <NuxtLink to="/auth/signup" class="inline-flex h-13 min-h-[52px] items-center justify-center rounded-2xl bg-white px-8 text-[14px] font-semibold text-[#ff321f] shadow-[0_18px_40px_rgba(120,28,18,.18)]">Empieza ahora</NuxtLink>
            <NuxtLink to="/auth/login" class="inline-flex h-13 min-h-[52px] items-center justify-center rounded-2xl border border-white/55 bg-white/10 px-8 text-[14px] font-semibold text-white">Ver demo</NuxtLink>
          </div>
          <div class="mt-7 flex items-center justify-center gap-2 text-[12px] font-semibold text-white/80"><ShieldCheck :size="17" /> Garantia sin riesgo: prueba Nala antes de pagar.</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-gradient {
  background:
    radial-gradient(circle at 34% 45%, rgba(239, 48, 35, 0.72) 0%, rgba(239, 48, 35, 0.48) 22%, rgba(239, 48, 35, 0) 45%),
    radial-gradient(circle at 26% 28%, rgba(229, 67, 143, 0.72) 0%, rgba(229, 67, 143, 0.34) 30%, rgba(229, 67, 143, 0) 58%),
    linear-gradient(115deg, #e34c8f 0%, #ef3824 44%, #ffc99a 100%);
}

.coin-helix {
  position: absolute;
  width: 330px;
  height: 330px;
  transform: rotate(-32deg);
  filter: drop-shadow(0 38px 38px rgba(170, 43, 35, 0.26));
}

.coin-helix span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 166px;
  height: 166px;
  margin-left: -83px;
  margin-top: -83px;
  border-radius: 9999px;
  border: 2px solid rgba(255, 237, 226, 0.72);
  background: linear-gradient(135deg, rgba(242, 77, 124, 0.62), rgba(255, 192, 145, 0.86));
  box-shadow: inset -14px -16px 24px rgba(195, 61, 62, 0.18), inset 14px 14px 20px rgba(255, 255, 255, 0.24);
}

.coin-helix span:nth-child(1) { transform: translate(-118px, 96px) scale(1.02); opacity: .96; }
.coin-helix span:nth-child(2) { transform: translate(-96px, 78px) scale(.98); opacity: .9; }
.coin-helix span:nth-child(3) { transform: translate(-75px, 60px) scale(.94); opacity: .86; }
.coin-helix span:nth-child(4) { transform: translate(-54px, 42px) scale(.9); opacity: .82; }
.coin-helix span:nth-child(5) { transform: translate(-33px, 24px) scale(.86); opacity: .78; }
.coin-helix span:nth-child(6) { transform: translate(-12px, 6px) scale(.82); opacity: .74; }
.coin-helix span:nth-child(7) { transform: translate(9px, -12px) scale(.78); opacity: .7; }
.coin-helix span:nth-child(8) { transform: translate(30px, -30px) scale(.74); opacity: .68; }
.coin-helix span:nth-child(9) { transform: translate(51px, -48px) scale(.7); opacity: .66; }
.coin-helix span:nth-child(10) { transform: translate(72px, -66px) scale(.66); opacity: .64; }
.coin-helix span:nth-child(11) { transform: translate(94px, -84px) scale(.9); opacity: .9; background: linear-gradient(135deg, #f17aa4, #ffc48f); }

.soft-noise:before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .12;
  background-image: radial-gradient(rgba(255,255,255,.7) .7px, transparent .7px);
  background-size: 8px 8px;
  mix-blend-mode: overlay;
}

.teal-stage {
  background:
    radial-gradient(circle at 78% 34%, rgba(255, 203, 194, .88) 0 18%, transparent 19%),
    radial-gradient(circle at 67% 33%, transparent 0 27%, #6f2834 28% 35%, transparent 36%),
    radial-gradient(circle at 65% 41%, #0f6464 0 29%, #10292c 30% 36%, #d68a67 37% 58%, #f3b293 59% 100%);
}

.pink-stage {
  background:
    radial-gradient(circle at 15% 28%, #f7a18e 0 20%, transparent 21%),
    radial-gradient(circle at 78% 82%, #ea8376 0 16%, transparent 17%),
    radial-gradient(circle at 82% 28%, transparent 0 22%, #ff7767 23% 36%, transparent 37%),
    linear-gradient(135deg, #f8a18f 0%, #ff5a5d 55%, #ff9b7a 100%);
}

.stage-cylinder {
  position: absolute;
  border-radius: 9999px 9999px 18px 18px;
  background: linear-gradient(135deg, rgba(255,205,190,.94), rgba(233,86,91,.82));
  box-shadow: inset 18px 20px 30px rgba(255,255,255,.24), inset -18px -26px 28px rgba(185,56,62,.14);
}
</style>
