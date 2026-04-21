<script setup lang="ts">
/**
 * Team management page (owner only).
 *
 * Allows the owner to:
 * - View all employees (active and inactive)
 * - Add new employees (creates Clerk account + access link)
 * - Edit employee name
 * - Generate/regenerate access links for employees
 * - Deactivate/reactivate employees
 *
 * Connected to:
 * - GET /api/employees
 * - POST /api/employees
 * - PATCH /api/employees/:id
 * - DELETE /api/employees/:id
 * - POST /api/employees/:id/access-link
 */

import {
  UserPlus,
  Pencil,
  UserX,
  UserCheck,
  ArrowLeft,
  Link2,
  Copy,
  Check,
} from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();

/** Employee from API. */
interface Employee {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  hasClerkAccount: boolean;
  createdAt: string;
}

const employees = ref<Employee[]>([]);
const isLoading = ref(true);
const loadError = ref("");

/** Fetch employees. */
async function fetchEmployees() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const result = await $api<{ employees: Employee[] }>("/api/employees");
    employees.value = result.employees;
  } catch {
    loadError.value = "Error cargando equipo";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchEmployees);

/** Active employees (excluding owner). */
const activeEmployees = computed(() =>
  employees.value.filter((e) => e.isActive && e.role !== "owner"),
);
const inactiveEmployees = computed(() =>
  employees.value.filter((e) => !e.isActive),
);
const ownerEntry = computed(() =>
  employees.value.find((e) => e.role === "owner" && e.isActive),
);

// ============================================================
// Add employee modal
// ============================================================

const showAddModal = ref(false);
const newName = ref("");
const addError = ref("");
const isAdding = ref(false);
const newAccessLink = ref("");

function openAddModal() {
  newName.value = "";
  addError.value = "";
  newAccessLink.value = "";
  showAddModal.value = true;
}

async function addEmployee() {
  if (!newName.value.trim()) return;

  isAdding.value = true;
  addError.value = "";
  newAccessLink.value = "";

  try {
    const result = await $api<{
      employee: Employee;
      accessLink: string;
    }>("/api/employees", {
      method: "POST",
      body: { name: newName.value.trim() },
    });
    newAccessLink.value = result.accessLink;
    await fetchEmployees();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    addError.value = fetchError.data?.error ?? "Error al agregar empleado";
  } finally {
    isAdding.value = false;
  }
}

// ============================================================
// Edit employee modal
// ============================================================

const showEditModal = ref(false);
const editId = ref("");
const editName = ref("");
const editError = ref("");
const isEditing = ref(false);

function openEditModal(emp: Employee) {
  editId.value = emp.id;
  editName.value = emp.name;
  editError.value = "";
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editName.value.trim()) return;

  isEditing.value = true;
  editError.value = "";

  try {
    await $api(`/api/employees/${editId.value}`, {
      method: "PATCH",
      body: { name: editName.value.trim() },
    });
    showEditModal.value = false;
    await fetchEmployees();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    editError.value = fetchError.data?.error ?? "Error al editar empleado";
  } finally {
    isEditing.value = false;
  }
}

// ============================================================
// Access link generation
// ============================================================

const generatingLinkFor = ref<string | null>(null);
const generatedLink = ref("");
const linkCopied = ref(false);

async function generateAccessLink(emp: Employee) {
  generatingLinkFor.value = emp.id;
  generatedLink.value = "";
  linkCopied.value = false;

  try {
    const result = await $api<{ accessLink: string }>(
      `/api/employees/${emp.id}/access-link`,
      { method: "POST" },
    );
    generatedLink.value = result.accessLink;
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    generatedLink.value = "";
    alert(fetchError.data?.error ?? "Error generando link");
    generatingLinkFor.value = null;
  }
}

async function copyLink() {
  if (!generatedLink.value) return;
  try {
    await navigator.clipboard.writeText(generatedLink.value);
    linkCopied.value = true;
    setTimeout(() => {
      linkCopied.value = false;
    }, 2000);
  } catch {
    // Fallback: select text
    prompt("Copia este link:", generatedLink.value);
  }
}

function closeLinkModal() {
  generatingLinkFor.value = null;
  generatedLink.value = "";
  linkCopied.value = false;
}

// ============================================================
// Deactivate / reactivate
// ============================================================

async function toggleActive(emp: Employee) {
  try {
    if (emp.isActive) {
      await $api(`/api/employees/${emp.id}`, { method: "DELETE" });
    } else {
      await $api(`/api/employees/${emp.id}`, {
        method: "PATCH",
        body: { isActive: true },
      });
    }
    await fetchEmployees();
  } catch {
    // Silently fail -- the list will show the old state
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6">
      <NuxtLink
        to="/settings"
        class="mb-3 inline-flex items-center gap-1 text-sm font-bold text-gray-400 transition-spring hover:text-gray-600"
      >
        <ArrowLeft :size="16" />
        Configuracion
      </NuxtLink>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-gradient">
            Equipo
          </h1>
          <p class="text-sm font-medium text-gray-500">
            Gestiona empleados y sus accesos
          </p>
        </div>
        <button
          class="dark-pill flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-spring"
          @click="openAddModal"
        >
          <UserPlus :size="16" />
          Agregar
        </button>
      </div>
    </div>

    <!-- How it works -->
    <div class="card-premium mb-4 p-4 text-sm text-gray-700">
      <p class="font-bold text-gray-800">Como funciona</p>
      <div class="mt-2 space-y-1.5 text-xs text-gray-600">
        <p>1. Agrega un empleado con su nombre</p>
        <p>2. Se genera un link de acceso unico</p>
        <p>3. Comparte el link por WhatsApp o como prefieras</p>
        <p>4. El empleado abre el link y queda autenticado</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div
        class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary"
      />
      Cargando equipo...
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="card-premium p-6 text-center">
      <p class="text-sm font-semibold text-red-500">{{ loadError }}</p>
      <button
        class="mt-3 text-xs font-bold text-nova-primary underline"
        @click="fetchEmployees"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Owner card -->
      <div
        v-if="ownerEntry"
        class="card-premium mb-4 flex items-center gap-4 p-4"
      >
        <div
          class="dark-pill flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold"
        >
          {{ ownerEntry.name.charAt(0) }}
        </div>
        <div class="flex-1">
          <p class="font-bold text-gray-800">{{ ownerEntry.name }}</p>
          <p class="text-xs font-bold text-nova-accent">Dueno</p>
        </div>
      </div>

      <!-- Active employees -->
      <div v-if="activeEmployees.length > 0" class="space-y-2.5">
        <div
          v-for="emp in activeEmployees"
          :key="emp.id"
          class="card-premium flex items-center gap-4 p-4"
        >
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFECFF] to-[#D0CCF9] text-sm font-extrabold text-nova-accent"
          >
            {{ emp.name.charAt(0) }}
          </div>
          <div class="flex-1">
            <p class="font-bold text-gray-800">{{ emp.name }}</p>
            <p class="text-xs font-medium text-gray-500">Empleado</p>
          </div>
          <button
            class="rounded-xl p-2 text-gray-400 transition-spring hover:bg-nova-accent/10 hover:text-nova-accent"
            title="Generar link de acceso"
            @click="generateAccessLink(emp)"
          >
            <Link2 :size="16" />
          </button>
          <button
            class="rounded-xl p-2 text-gray-400 transition-spring hover:bg-white/80 hover:text-gray-600"
            title="Editar"
            @click="openEditModal(emp)"
          >
            <Pencil :size="16" />
          </button>
          <button
            class="rounded-xl p-2 text-gray-400 transition-spring hover:bg-red-50 hover:text-red-500"
            title="Desactivar"
            @click="toggleActive(emp)"
          >
            <UserX :size="16" />
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="card-premium py-12 text-center">
        <p class="text-sm font-medium text-gray-400">
          No hay empleados registrados
        </p>
        <button
          class="mt-3 text-sm font-bold text-nova-primary hover:underline"
          @click="openAddModal"
        >
          Agregar primer empleado
        </button>
      </div>

      <!-- Inactive employees -->
      <div v-if="inactiveEmployees.length > 0" class="mt-6">
        <h2 class="mb-2 text-sm font-bold text-gray-400">Desactivados</h2>
        <div class="space-y-2.5">
          <div
            v-for="emp in inactiveEmployees"
            :key="emp.id"
            class="card-premium flex items-center gap-4 p-4 opacity-50"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-400"
            >
              {{ emp.name.charAt(0) }}
            </div>
            <div class="flex-1">
              <p class="font-semibold text-gray-500">{{ emp.name }}</p>
            </div>
            <button
              class="rounded-xl p-2 text-gray-400 transition-spring hover:bg-green-50 hover:text-green-600"
              title="Reactivar"
              @click="toggleActive(emp)"
            >
              <UserCheck :size="16" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Add employee modal -->
    <Teleport to="body">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showAddModal = false"
      >
        <div
          class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]"
        >
          <!-- Before link is generated -->
          <template v-if="!newAccessLink">
            <h3
              class="mb-5 text-xl font-extrabold tracking-tight text-gradient"
            >
              Nuevo empleado
            </h3>

            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600"
                >Nombre</label
              >
              <input
                v-model="newName"
                type="text"
                placeholder="Ej: Maria Garcia"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
                autofocus
              />
            </div>

            <p v-if="addError" class="mt-3 text-sm font-semibold text-red-500">
              {{ addError }}
            </p>

            <div class="mt-5 flex gap-3">
              <button
                class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
                @click="showAddModal = false"
              >
                Cancelar
              </button>
              <button
                class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
                :disabled="!newName.trim() || isAdding"
                @click="addEmployee"
              >
                {{ isAdding ? "Creando..." : "Crear empleado" }}
              </button>
            </div>
          </template>

          <!-- After link is generated -->
          <template v-else>
            <h3
              class="mb-2 text-xl font-extrabold tracking-tight text-gradient"
            >
              Empleado creado
            </h3>
            <p class="mb-4 text-[13px] font-medium text-gray-500">
              Comparte este link con {{ newName }} para que pueda acceder:
            </p>

            <div
              class="mb-4 rounded-2xl bg-white/60 p-3 text-xs font-mono text-gray-600 break-all"
            >
              {{ newAccessLink }}
            </div>

            <button
              class="dark-pill mb-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-spring"
              @click="
                navigator.clipboard.writeText(newAccessLink);
                linkCopied = true;
                setTimeout(() => (linkCopied = false), 2000);
              "
            >
              <component :is="linkCopied ? Check : Copy" :size="16" />
              {{ linkCopied ? "Copiado!" : "Copiar link" }}
            </button>

            <button
              class="glass w-full rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showAddModal = false"
            >
              Listo
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- Edit employee modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showEditModal = false"
      >
        <div
          class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]"
        >
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Editar empleado
          </h3>

          <div>
            <label class="mb-1.5 block text-[13px] font-bold text-gray-600"
              >Nombre</label
            >
            <input
              v-model="editName"
              type="text"
              class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
            />
          </div>

          <p v-if="editError" class="mt-3 text-sm font-semibold text-red-500">
            {{ editError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              class="glass flex-1 rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              class="dark-pill flex-1 rounded-2xl py-3 text-sm font-bold transition-spring disabled:opacity-50"
              :disabled="!editName.trim() || isEditing"
              @click="saveEdit"
            >
              {{ isEditing ? "Guardando..." : "Guardar" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Access link modal -->
    <Teleport to="body">
      <div
        v-if="generatingLinkFor"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="closeLinkModal"
      >
        <div
          class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]"
        >
          <h3 class="mb-2 text-xl font-extrabold tracking-tight text-gradient">
            Link de acceso
          </h3>

          <!-- Loading -->
          <div v-if="!generatedLink" class="py-6 text-center">
            <div
              class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-accent"
            />
            <p class="text-sm text-gray-500">Generando link...</p>
          </div>

          <!-- Link ready -->
          <template v-else>
            <p class="mb-4 text-[13px] font-medium text-gray-500">
              Comparte este link con el empleado. Es de un solo uso y expira en
              30 dias.
            </p>

            <div
              class="mb-4 rounded-2xl bg-white/60 p-3 text-xs font-mono text-gray-600 break-all"
            >
              {{ generatedLink }}
            </div>

            <button
              class="dark-pill mb-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-spring"
              @click="copyLink"
            >
              <component :is="linkCopied ? Check : Copy" :size="16" />
              {{ linkCopied ? "Copiado!" : "Copiar link" }}
            </button>
          </template>

          <button
            class="glass w-full rounded-2xl py-3 text-sm font-bold text-gray-700 transition-spring"
            @click="closeLinkModal"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
