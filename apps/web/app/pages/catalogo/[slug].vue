<script setup lang="ts">
/**
 * Public catalog page for a business.
 *
 * Accessible without authentication. Shows the business's products
 * with prices and a "Pedir por WhatsApp" button that opens wa.me/
 * with a pre-filled message.
 *
 * No layout (standalone page with its own header/footer).
 * SEO-optimized with Open Graph meta tags so the link previews
 * nicely when shared on WhatsApp, Instagram, etc.
 *
 * Connected to: GET /catalog/:slug (public, no auth)
 */

definePageMeta({ layout: false });

const route = useRoute();
const config = useRuntimeConfig();
const slug = route.params.slug as string;

/** Catalog data from the API. */
interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string | null;
  available: boolean;
}

interface CatalogBusiness {
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  slug: string;
  whatsappNumber: string | null;
}

interface CatalogCategory {
  id: string;
  name: string;
}

const isLoading = ref(true);
const loadError = ref("");
const business = ref<CatalogBusiness | null>(null);
const allProducts = ref<CatalogProduct[]>([]);
const categories = ref<CatalogCategory[]>([]);
const selectedCategory = ref<string | null>(null);

/** Filtered products by selected category. */
const filteredProducts = computed(() => {
  if (!selectedCategory.value) return allProducts.value;
  return allProducts.value.filter(
    (p) => p.categoryName === selectedCategory.value,
  );
});

/** Build a wa.me/ link with a pre-filled order message. */
function orderLink(product: CatalogProduct): string {
  if (!business.value?.whatsappNumber) return "#";
  const phone = business.value.whatsappNumber.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(
    `Hola, me interesa: ${product.name} ($${product.price.toFixed(2)})`,
  );
  return `https://wa.me/${phone}?text=${text}`;
}

/** Load catalog data from the public API. */
async function loadCatalog() {
  isLoading.value = true;
  loadError.value = "";

  try {
    const apiBase = config.public.apiBase as string;
    const data = await $fetch<{
      business: CatalogBusiness;
      categories: CatalogCategory[];
      products: CatalogProduct[];
    }>(`${apiBase}/catalog/${slug}`);

    business.value = data.business;
    categories.value = data.categories;
    allProducts.value = data.products;
  } catch {
    loadError.value = "No se encontro el catalogo.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadCatalog();
});

/** SEO: set page title and meta tags after data loads. */
const catalogUrl = computed(() => {
  const domain = config.public.tenantDomain as string;
  return business.value
    ? `https://${business.value.slug}.${domain}`
    : `https://${domain}/catalogo/${slug}`;
});

useHead(
  computed(() => ({
    title: business.value
      ? `${business.value.name} - Catalogo`
      : "Catalogo - Nova",
    meta: [
      {
        name: "description",
        content: business.value
          ? `Productos de ${business.value.name}. Precios actualizados. Pide por WhatsApp.`
          : "Catalogo de productos",
      },
      {
        property: "og:title",
        content: business.value
          ? `${business.value.name} - Catalogo`
          : "Catalogo",
      },
      {
        property: "og:description",
        content: business.value
          ? `Ve los productos y precios de ${business.value.name}. Pide directo por WhatsApp.`
          : "Catalogo de productos",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: catalogUrl.value },
      {
        property: "og:image",
        content: "https://novaincs.com/og-catalog.png",
      },
      { property: "og:locale", content: "es_VE" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: business.value
          ? `${business.value.name} - Catalogo`
          : "Catalogo",
      },
      {
        name: "twitter:description",
        content: business.value
          ? `Productos de ${business.value.name}. Pide por WhatsApp.`
          : "Catalogo de productos",
      },
    ],
  })),
);
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Loading -->
    <div v-if="isLoading" class="py-20 text-center text-gray-400">
      Cargando catalogo...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="mx-auto max-w-md px-6 py-20 text-center"
    >
      <p class="text-lg text-gray-600">{{ loadError }}</p>
      <p class="mt-2 text-sm text-gray-400">
        Verifica que el link sea correcto.
      </p>
    </div>

    <!-- Catalog -->
    <template v-else-if="business">
      <!-- Header -->
      <header class="bg-white shadow-sm">
        <div class="mx-auto max-w-5xl px-4 py-5">
          <h1 class="text-2xl font-bold text-gray-900">
            {{ business.name }}
          </h1>
          <p v-if="business.address" class="mt-1 text-sm text-gray-500">
            {{ business.address }}
          </p>
          <p v-if="business.phone" class="mt-0.5 text-sm text-gray-400">
            {{ business.phone }}
          </p>
        </div>
      </header>

      <!-- Category filter -->
      <div
        v-if="categories.length > 0"
        class="mx-auto max-w-5xl overflow-x-auto px-4 pt-4"
      >
        <div class="flex gap-2">
          <button
            class="flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            "
            @click="selectedCategory = null"
          >
            Todos
          </button>
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              selectedCategory === cat.name
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            "
            @click="selectedCategory = cat.name"
          >
            {{ cat.name }}
          </button>
        </div>
      </div>

      <!-- Products grid -->
      <div class="mx-auto max-w-5xl px-4 py-6">
        <div
          v-if="filteredProducts.length === 0"
          class="py-12 text-center text-gray-400"
        >
          No hay productos disponibles.
        </div>

        <div
          v-else
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div
            v-for="product in filteredProducts"
            :key="product.id"
            class="overflow-hidden rounded-xl bg-white shadow-sm"
          >
            <!-- Product image placeholder -->
            <div
              v-if="product.imageUrl"
              class="aspect-square bg-gray-100"
            >
              <img
                :src="product.imageUrl"
                :alt="product.name"
                class="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div
              v-else
              class="flex aspect-square items-center justify-center bg-gray-100 text-4xl text-gray-300"
            >
              📦
            </div>

            <!-- Product info -->
            <div class="p-4">
              <p
                v-if="product.categoryName"
                class="text-xs font-medium uppercase tracking-wide text-gray-400"
              >
                {{ product.categoryName }}
              </p>
              <h3 class="mt-1 font-semibold text-gray-900">
                {{ product.name }}
              </h3>
              <p
                v-if="product.description"
                class="mt-1 line-clamp-2 text-sm text-gray-500"
              >
                {{ product.description }}
              </p>

              <div class="mt-3 flex items-center justify-between">
                <span class="text-lg font-bold text-gray-900">
                  ${{ product.price.toFixed(2) }}
                </span>
                <span
                  v-if="!product.available"
                  class="text-xs font-medium text-red-500"
                >
                  Agotado
                </span>
              </div>

              <!-- Order via WhatsApp button -->
              <a
                v-if="business.whatsappNumber && product.available"
                :href="orderLink(product)"
                target="_blank"
                rel="noopener noreferrer"
                class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600"
              >
                Pedir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="border-t border-gray-200 bg-white py-6">
        <div class="mx-auto max-w-5xl px-4 text-center text-sm text-gray-400">
          <p>Catalogo de {{ business.name }}</p>
          <p class="mt-1">Precios en USD. Sujetos a disponibilidad.</p>
        </div>
      </footer>
    </template>
  </div>
</template>
