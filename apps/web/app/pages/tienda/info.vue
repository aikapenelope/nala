<script setup lang="ts">
/**
 * Store info page — location, hours, payment methods, contact.
 *
 * Accessible from the bottom nav "Info" tab. Shows all the
 * practical details a customer needs before ordering.
 */

import {
  MapPin,
  Clock,
  CreditCard,
  Phone,
  MessageCircle,
  Truck,
  ArrowLeft,
} from "lucide-vue-next";
import { currentDayOfWeekVET } from "@nova/shared";

definePageMeta({ layout: "storefront" });

const { business, storeInfo } = useStorefront();

useStorefrontSeo({ title: "Info" });

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const dayLabels: Record<string, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miercoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sabado",
  sun: "Domingo",
};

const todayIdx = currentDayOfWeekVET();
const todayKey = dayKeys[todayIdx];

/** WhatsApp link. */
const whatsappLink = computed(() => {
  const phone = business.value?.whatsappNumber;
  if (!phone) return null;
  return `https://wa.me/${phone.replace(/[^0-9]/g, "")}`;
});

/** Phone link. */
const phoneLink = computed(() => {
  const phone = business.value?.phone;
  if (!phone) return null;
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
});
</script>

<template>
  <div class="px-5 pt-2">
    <NuxtLink
      to="/tienda"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft :size="16" />
      Catalogo
    </NuxtLink>

    <h1 class="mb-6 text-xl font-bold tracking-tight text-gray-900">
      {{ business?.name ?? "Tienda" }}
    </h1>

    <div class="space-y-4">
      <!-- Address -->
      <div
        v-if="business?.address"
        class="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <MapPin :size="20" />
        </div>
        <div>
          <p class="text-sm font-bold text-gray-900">Ubicacion</p>
          <p class="mt-0.5 text-sm text-gray-600">{{ business.address }}</p>
        </div>
      </div>

      <!-- Business hours -->
      <div
        v-if="storeInfo?.businessHours"
        class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <Clock :size="20" />
          </div>
          <p class="text-sm font-bold text-gray-900">Horario</p>
        </div>
        <div class="space-y-1.5 pl-[52px]">
          <div
            v-for="day in (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)"
            :key="day"
            class="flex items-center justify-between text-sm"
            :class="day === todayKey ? 'font-bold text-gray-900' : 'text-gray-500'"
          >
            <span class="flex items-center gap-2">
              {{ dayLabels[day] }}
              <span
                v-if="day === todayKey"
                class="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700"
              >
                Hoy
              </span>
            </span>
            <span v-if="storeInfo.businessHours?.[day]">
              {{ storeInfo.businessHours[day]?.open }} - {{ storeInfo.businessHours[day]?.close }}
            </span>
            <span v-else class="text-gray-400">Cerrado</span>
          </div>
        </div>
      </div>

      <!-- Payment methods -->
      <div
        v-if="storeInfo?.paymentMethods && storeInfo.paymentMethods.length > 0"
        class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <CreditCard :size="20" />
          </div>
          <p class="text-sm font-bold text-gray-900">Metodos de pago</p>
        </div>
        <div class="space-y-2 pl-[52px]">
          <div
            v-for="pm in storeInfo.paymentMethods"
            :key="pm.method"
            class="rounded-xl bg-gray-50 p-3"
          >
            <p class="text-sm font-semibold text-gray-900">{{ pm.label }}</p>
            <div v-if="Object.keys(pm.details).length > 0" class="mt-1 space-y-0.5">
              <p
                v-for="(value, key) in pm.details"
                :key="key"
                class="text-xs text-gray-500"
              >
                <span class="font-medium capitalize text-gray-600">{{ key }}:</span> {{ value }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Delivery -->
      <div
        v-if="storeInfo?.deliveryEnabled"
        class="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <Truck :size="20" />
        </div>
        <div>
          <p class="text-sm font-bold text-gray-900">Delivery</p>
          <p class="mt-0.5 text-sm text-gray-600">
            {{ storeInfo.deliveryFee > 0 ? `$${storeInfo.deliveryFee.toFixed(2)}` : "Gratis" }}
            <span v-if="storeInfo.deliveryZones" class="text-gray-400"> · {{ storeInfo.deliveryZones }}</span>
          </p>
        </div>
      </div>

      <!-- Contact -->
      <div class="flex gap-3">
        <a
          v-if="whatsappLink"
          :href="whatsappLink"
          target="_blank"
          rel="noopener noreferrer"
          class="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-600/20 transition-all active:scale-[0.97]"
        >
          <MessageCircle :size="18" />
          WhatsApp
        </a>
        <a
          v-if="phoneLink"
          :href="phoneLink"
          class="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white py-3.5 text-sm font-bold text-gray-900 transition-all active:scale-[0.97]"
        >
          <Phone :size="18" />
          Llamar
        </a>
      </div>

      <!-- Min order -->
      <p
        v-if="storeInfo && storeInfo.minOrderAmount > 0"
        class="text-center text-xs font-medium text-gray-400"
      >
        Pedido minimo: ${{ storeInfo.minOrderAmount.toFixed(2) }}
      </p>
    </div>
  </div>
</template>
