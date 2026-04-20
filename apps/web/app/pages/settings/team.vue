<script setup lang="ts">
/**
 * Team management page (owner only).
 *
 * Allows the owner to:
 * - View all employees (active and inactive)
 * - Add new employees with name + PIN
 * - Edit employee name or PIN
 * - Deactivate/reactivate employees
 *
 * Connected to:
 * - GET /api/employees
 * - POST /api/employees
 * - PATCH /api/employees/:id
 * - DELETE /api/employees/:id
 */

import { PIN_LENGTH } from "@nova/shared";
import { UserPlus, Pencil, UserX, UserCheck, ArrowLeft } from "lucide-vue-next";

definePageMeta({ middleware: ["admin-only"] });

const { $api } = useApi();
const { refreshRoster } = useTeamRoster();

/** Employee from API. */
interface Employee {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
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
const newPin = ref("");
const addError = ref("");
const isAdding = ref(false);

function openAddModal() {
  newName.value = "";
  newPin.value = "";
  addError.value = "";
  showAddModal.value = true;
}

async function addEmployee() {
  if (!newName.value.trim() || newPin.value.length !== PIN_LENGTH) return;

  isAdding.value = true;
  addError.value = "";

  try {
    await $api("/api/employees", {
      method: "POST",
      body: { name: newName.value.trim(), pin: newPin.value },
    });
    showAddModal.value = false;
    await fetchEmployees();
    await refreshRoster();
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
const editPin = ref("");
const editError = ref("");
const isEditing = ref(false);

function openEditModal(emp: Employee) {
  editId.value = emp.id;
  editName.value = emp.name;
  editPin.value = "";
  editError.value = "";
  showEditModal.value = true;
}

async function saveEdit() {
  if (!editName.value.trim()) return;

  isEditing.value = true;
  editError.value = "";

  const body: Record<string, string> = { name: editName.value.trim() };
  if (editPin.value.length === PIN_LENGTH) {
    body.pin = editPin.value;
  }

  try {
    await $api(`/api/employees/${editId.value}`, {
      method: "PATCH",
      body,
    });
    showEditModal.value = false;
    await fetchEmployees();
    await refreshRoster();
  } catch (err) {
    const fetchError = err as { data?: { error?: string } };
    editError.value = fetchError.data?.error ?? "Error al editar empleado";
  } finally {
    isEditing.value = false;
  }
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
    await refreshRoster();
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
          <h1 class="text-2xl font-extrabold tracking-tight text-gradient">Equipo</h1>
          <p class="text-sm font-medium text-gray-500">
            Gestiona empleados y sus PINs de acceso
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

    <!-- Permissions info -->
    <div class="card-premium mb-4 p-4 text-sm text-gray-700">
      <p class="font-bold text-gray-800">Permisos por rol</p>
      <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p class="font-bold text-gray-800">Dueno</p>
          <ul class="mt-1 space-y-0.5 text-gray-600">
            <li>Vender y cobrar</li>
            <li>Anular ventas</li>
            <li>Crear/editar productos</li>
            <li>Ajustar inventario</li>
            <li>Ver reportes y contabilidad</li>
            <li>Gestionar empleados</li>
            <li>Configurar negocio</li>
          </ul>
        </div>
        <div>
          <p class="font-bold text-gray-800">Empleado</p>
          <ul class="mt-1 space-y-0.5 text-gray-600">
            <li>Vender y cobrar</li>
            <li>Ver inventario</li>
            <li>Ver clientes</li>
            <li>Ver historial de ventas</li>
          </ul>
          <p class="mt-2 text-[10px] text-gray-500">
            No puede: anular ventas, editar productos, ver reportes, configurar
          </p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-nova-primary" />
      Cargando equipo...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="card-premium p-6 text-center"
    >
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
      <div
        v-else
        class="card-premium py-12 text-center"
      >
        <p class="text-sm font-medium text-gray-400">No hay empleados registrados</p>
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
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Nuevo empleado
          </h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Nombre</label>
              <input
                v-model="newName"
                type="text"
                placeholder="Ej: Maria Garcia"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
                autofocus
              >
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
                PIN ({{ PIN_LENGTH }} digitos)
              </label>
              <input
                v-model="newPin"
                type="password"
                inputmode="numeric"
                :maxlength="PIN_LENGTH"
                placeholder="0000"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-center text-xl font-bold tracking-[0.5em] text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
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
              :disabled="
                !newName.trim() || newPin.length !== PIN_LENGTH || isAdding
              "
              @click="addEmployee"
            >
              {{ isAdding ? "Guardando..." : "Agregar" }}
            </button>
          </div>
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
        <div class="glass-strong w-full max-w-sm rounded-[32px] p-7 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)]">
          <h3 class="mb-5 text-xl font-extrabold tracking-tight text-gradient">
            Editar empleado
          </h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">Nombre</label>
              <input
                v-model="editName"
                type="text"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-sm font-semibold text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring placeholder:text-gray-400 focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
            <div>
              <label class="mb-1.5 block text-[13px] font-bold text-gray-600">
                Nuevo PIN (dejar vacio para no cambiar)
              </label>
              <input
                v-model="editPin"
                type="password"
                inputmode="numeric"
                :maxlength="PIN_LENGTH"
                placeholder="****"
                class="w-full rounded-2xl border border-white bg-white/60 px-4 py-3 text-center text-xl font-bold tracking-[0.5em] text-gray-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] outline-none transition-spring focus:bg-white focus:ring-[3px] focus:ring-nova-accent/20"
              >
            </div>
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
  </div>
</template>
