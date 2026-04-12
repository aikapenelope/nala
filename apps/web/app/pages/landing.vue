<script setup lang="ts">
/**
 * Landing page for Nova.
 *
 * Shown to unauthenticated visitors. Communicates the value proposition
 * for Venezuelan small business owners in simple, direct language.
 *
 * Structure (based on Square/Shopify landing patterns):
 * 1. Hero: one-line value prop + CTA
 * 2. Problem/solution: what Nova replaces
 * 3. Features grid: 6 key capabilities with icons
 * 4. Social proof: business types supported
 * 5. CTA: sign up
 */

definePageMeta({ layout: false });
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Nav -->
    <nav class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
      <span class="text-xl font-bold text-nova-primary">Nova</span>
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/auth/login"
          class="text-sm text-gray-600 hover:text-gray-900"
        >
          Iniciar sesion
        </NuxtLink>
        <NuxtLink
          to="/auth/signup"
          class="rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
        >
          Crear cuenta gratis
        </NuxtLink>
      </div>
    </nav>

    <!-- Hero -->
    <section class="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center md:pt-20">
      <h1
        class="text-4xl font-bold leading-tight text-gray-900 md:text-5xl lg:text-6xl"
      >
        Tu negocio completo
        <br />
        <span class="text-nova-primary">en un solo lugar</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
        Ventas, inventario, clientes, cuentas y reportes para ferreterias,
        bodegas, tiendas de ropa, farmacias y cualquier comercio en Venezuela.
        Funciona sin internet. Inteligencia en cada pantalla.
      </p>
      <div
        class="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
      >
        <NuxtLink
          to="/auth/signup"
          class="rounded-xl bg-nova-primary px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-nova-primary/25 transition-transform hover:scale-105"
        >
          Empezar gratis
        </NuxtLink>
        <span class="text-sm text-gray-400">
          Listo en 2 minutos. Sin tarjeta de credito.
        </span>
      </div>
    </section>

    <!-- Problem / Solution -->
    <section class="bg-gray-50 py-16">
      <div class="mx-auto max-w-5xl px-6">
        <h2 class="text-center text-2xl font-bold text-gray-900">
          Deja el cuaderno. Deja el Excel.
        </h2>
        <p class="mx-auto mt-3 max-w-2xl text-center text-gray-600">
          Nova reemplaza las libretas, las hojas de calculo y los sistemas
          complicados con una app que cualquier persona puede usar desde el
          primer dia.
        </p>

        <div class="mt-12 grid gap-8 md:grid-cols-3">
          <div class="rounded-xl bg-white p-6 shadow-sm">
            <div class="mb-3 text-3xl">⚡</div>
            <h3 class="font-semibold text-gray-900">Venta en 3 toques</h3>
            <p class="mt-2 text-sm text-gray-600">
              Toca el producto, selecciona el metodo de pago, listo. Mas rapido
              que una caja registradora.
            </p>
          </div>
          <div class="rounded-xl bg-white p-6 shadow-sm">
            <div class="mb-3 text-3xl">📡</div>
            <h3 class="font-semibold text-gray-900">Funciona sin internet</h3>
            <p class="mt-2 text-sm text-gray-600">
              Las ventas se guardan en el telefono y se sincronizan cuando
              vuelve la conexion. Cero ventas perdidas.
            </p>
          </div>
          <div class="rounded-xl bg-white p-6 shadow-sm">
            <div class="mb-3 text-3xl">🧠</div>
            <h3 class="font-semibold text-gray-900">Inteligencia integrada</h3>
            <p class="mt-2 text-sm text-gray-600">
              Nova te dice cuando se acaba un producto, quien te debe y como te
              fue esta semana. Sin que preguntes.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features grid -->
    <section class="py-16">
      <div class="mx-auto max-w-5xl px-6">
        <h2 class="text-center text-2xl font-bold text-gray-900">
          Todo lo que necesitas
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-center text-gray-600">
          Facil como un cuaderno, potente como un ERP, inteligente como un socio
          que sabe de numeros.
        </p>

        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">💲</span>
            <div>
              <h3 class="font-semibold text-gray-900">Punto de venta</h3>
              <p class="mt-1 text-sm text-gray-500">
                7 metodos de pago: efectivo, Pago Movil, Binance, Zinli,
                transferencia, Zelle, fiado.
              </p>
            </div>
          </div>
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">📦</span>
            <div>
              <h3 class="font-semibold text-gray-900">
                Inventario inteligente
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                Semaforo de stock, variantes (talla, color), alertas de
                agotamiento, escaner de codigo de barras.
              </p>
            </div>
          </div>
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">👥</span>
            <div>
              <h3 class="font-semibold text-gray-900">Clientes y CRM</h3>
              <p class="mt-1 text-sm text-gray-500">
                Perfil automatico, segmentos (VIP, en riesgo), cobro por
                WhatsApp en un toque.
              </p>
            </div>
          </div>
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">📊</span>
            <div>
              <h3 class="font-semibold text-gray-900">Reportes con IA</h3>
              <p class="mt-1 text-sm text-gray-500">
                7 reportes pre-construidos con graficos y narrativa generada por
                inteligencia artificial.
              </p>
            </div>
          </div>
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">📱</span>
            <div>
              <h3 class="font-semibold text-gray-900">WhatsApp integrado</h3>
              <p class="mt-1 text-sm text-gray-500">
                Consulta ventas, cobra deudas y recibe alertas directamente
                desde WhatsApp.
              </p>
            </div>
          </div>
          <div class="flex gap-4 rounded-xl border border-gray-100 p-5">
            <span class="text-2xl">🔐</span>
            <div>
              <h3 class="font-semibold text-gray-900">
                Multi-empleado con PIN
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                Cada empleado tiene su PIN. Sabes quien vendio que. El dueno
                autoriza acciones sensibles.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Business types -->
    <section class="bg-gray-50 py-16">
      <div class="mx-auto max-w-5xl px-6 text-center">
        <h2 class="text-2xl font-bold text-gray-900">
          Pre-configurado para tu tipo de negocio
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-gray-600">
          Nova se adapta automaticamente con categorias, cuentas contables y
          configuracion especifica para tu rubro.
        </p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <span
            v-for="biz in [
              'Ferreteria',
              'Bodega',
              'Tienda de ropa',
              'Autopartes',
              'Peluqueria',
              'Farmacia',
              'Electronica',
              'Libreria',
              'Cosmeticos',
              'Distribuidora',
            ]"
            :key="biz"
            class="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700"
          >
            {{ biz }}
          </span>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="py-16">
      <div class="mx-auto max-w-5xl px-6 text-center">
        <h2 class="text-2xl font-bold text-gray-900">Simple y transparente</h2>
        <div
          class="mx-auto mt-8 max-w-sm rounded-2xl border-2 border-nova-primary bg-white p-8 shadow-lg"
        >
          <p class="text-sm font-medium text-nova-primary">Plan unico</p>
          <p class="mt-2 text-4xl font-bold text-gray-900">Gratis</p>
          <p class="mt-1 text-sm text-gray-500">durante el beta</p>
          <ul class="mt-6 space-y-3 text-left text-sm text-gray-600">
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> Ventas ilimitadas
            </li>
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> Productos ilimitados
            </li>
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> Empleados ilimitados
            </li>
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> Reportes con IA
            </li>
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> WhatsApp integrado
            </li>
            <li class="flex items-center gap-2">
              <span class="text-green-500">✓</span> Funciona offline
            </li>
          </ul>
          <NuxtLink
            to="/auth/signup"
            class="mt-8 block rounded-xl bg-nova-primary py-3 text-center font-semibold text-white"
          >
            Crear cuenta gratis
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-gray-100 py-8">
      <div class="mx-auto max-w-5xl px-6 text-center text-sm text-gray-400">
        <p>Nova - Backoffice operativo para comerciantes y PyMEs</p>
        <p class="mt-1">Hecho en Venezuela para Venezuela</p>
      </div>
    </footer>
  </div>
</template>
