<script setup lang="ts">
/**
 * Global search modal (Cmd+K / Ctrl+K).
 *
 * Searches products, clients, and pages. Results are grouped by type.
 * Opens with keyboard shortcut or by clicking the search icon in the header.
 */

import { Search, Package, Users, FileText, X } from "lucide-vue-next";

const { $api } = useApi();
const router = useRouter();

const isOpen = ref(false);
const query = ref("");
const isSearching = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

interface SearchResult {
  id: string;
  type: "product" | "client" | "page";
  title: string;
  subtitle: string;
  to: string;
}

const results = ref<SearchResult[]>([]);

/** Static pages for quick navigation. */
const PAGES: SearchResult[] = [
  { id: "p-sales", type: "page", title: "Nueva venta", subtitle: "POS", to: "/sales" },
  { id: "p-inventory", type: "page", title: "Inventario", subtitle: "Productos", to: "/inventory" },
  { id: "p-clients", type: "page", title: "Clientes", subtitle: "CRM", to: "/clients" },
  { id: "p-reports", type: "page", title: "Reportes", subtitle: "Analisis", to: "/reports" },
  { id: "p-accounting", type: "page", title: "Contabilidad", subtitle: "Gastos y cuentas", to: "/accounting" },
  { id: "p-settings", type: "page", title: "Configuracion", subtitle: "Equipo y negocio", to: "/settings" },
  { id: "p-suppliers", type: "page", title: "Proveedores", subtitle: "Directorio", to: "/suppliers" },
];

/** Open the modal. */
function open() {
  isOpen.value = true;
  query.value = "";
  results.value = [];
  nextTick(() => inputRef.value?.focus());
}

/** Close the modal. */
function close() {
  isOpen.value = false;
  query.value = "";
  results.value = [];
}

/** Navigate to a result and close. */
function goTo(result: SearchResult) {
  close();
  router.push(result.to);
}

/** Keyboard shortcut: Cmd+K or Ctrl+K. */
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  }
  if (e.key === "Escape" && isOpen.value) {
    close();
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener("keydown", handleKeydown);
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    document.removeEventListener("keydown", handleKeydown);
  }
});

/** Debounced search. */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

watch(query, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout);

  const trimmed = q.trim().toLowerCase();
  if (!trimmed) {
    results.value = [];
    return;
  }

  // Instant: filter pages
  const pageResults = PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(trimmed) ||
      p.subtitle.toLowerCase().includes(trimmed),
  );

  results.value = pageResults;

  // Debounced: search API for products and clients
  searchTimeout = setTimeout(async () => {
    if (!query.value.trim()) return;
    isSearching.value = true;

    try {
      const [prodResult, clientResult] = await Promise.allSettled([
        $api<{ products: Array<{ id: string; name: string; price: string; stock: number }> }>(
          `/api/products?search=${encodeURIComponent(trimmed)}&limit=5`,
        ),
        $api<{ customers: Array<{ id: string; name: string; phone: string | null }> }>(
          `/api/customers?search=${encodeURIComponent(trimmed)}&limit=5`,
        ),
      ]);

      const apiResults: SearchResult[] = [];

      if (prodResult.status === "fulfilled") {
        for (const p of prodResult.value.products) {
          apiResults.push({
            id: `prod-${p.id}`,
            type: "product",
            title: p.name,
            subtitle: `$${Number(p.price).toFixed(2)} · ${p.stock} en stock`,
            to: `/inventory`,
          });
        }
      }

      if (clientResult.status === "fulfilled") {
        for (const c of clientResult.value.customers) {
          apiResults.push({
            id: `client-${c.id}`,
            type: "client",
            title: c.name,
            subtitle: c.phone ?? "Sin telefono",
            to: `/clients`,
          });
        }
      }

      // Merge: pages first, then API results
      results.value = [...pageResults, ...apiResults];
    } catch {
      // Keep page results only
    } finally {
      isSearching.value = false;
    }
  }, 300);
});

/** Icon for result type. */
const typeIcons = {
  product: Package,
  client: Users,
  page: FileText,
};

defineExpose({ open });
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[15vh]"
      @click.self="close"
    >
      <div
        class="glass-strong w-full max-w-lg rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)]"
      >
        <!-- Search input -->
        <div class="flex items-center gap-3 border-b border-white/30 px-5 py-4">
          <Search :size="18" class="flex-shrink-0 text-gray-400" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="Buscar productos, clientes, paginas..."
            class="w-full bg-transparent text-sm font-medium text-gray-800 outline-none placeholder:text-gray-400"
            @keydown.escape="close"
          />
          <button
            class="flex-shrink-0 text-gray-300 hover:text-gray-500"
            @click="close"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Results -->
        <div class="max-h-[50vh] overflow-y-auto p-2">
          <!-- Loading -->
          <div
            v-if="isSearching && results.length === 0"
            class="py-8 text-center text-sm text-gray-400"
          >
            Buscando...
          </div>

          <!-- No results -->
          <div
            v-else-if="query.trim() && results.length === 0"
            class="py-8 text-center text-sm text-gray-400"
          >
            Sin resultados para "{{ query }}"
          </div>

          <!-- Empty state -->
          <div
            v-else-if="!query.trim()"
            class="py-6 text-center text-xs text-gray-400"
          >
            Escribe para buscar productos, clientes o navegar
          </div>

          <!-- Result list -->
          <button
            v-for="r in results"
            :key="r.id"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-spring hover:bg-white/60"
            @click="goTo(r)"
          >
            <div
              class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              :class="{
                'bg-purple-100 text-purple-600': r.type === 'product',
                'bg-blue-100 text-blue-600': r.type === 'client',
                'bg-gray-100 text-gray-600': r.type === 'page',
              }"
            >
              <component :is="typeIcons[r.type]" :size="14" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-gray-800">
                {{ r.title }}
              </p>
              <p class="truncate text-xs text-gray-400">{{ r.subtitle }}</p>
            </div>
          </button>
        </div>

        <!-- Footer -->
        <div
          class="flex items-center justify-between border-t border-white/30 px-5 py-2.5 text-[10px] text-gray-400"
        >
          <span>Navega con las flechas</span>
          <span class="flex items-center gap-1">
            <kbd
              class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]"
              >ESC</kbd
            >
            para cerrar
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>
