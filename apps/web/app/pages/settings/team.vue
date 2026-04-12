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
import { UserPlus, Pencil, UserX, UserCheck } from "lucide-vue-next";

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
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Equipo</h1>
        <p class="text-sm text-gray-500">
          Gestiona empleados y sus PINs de acceso
        </p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-nova-primary px-4 py-2 text-sm font-medium text-white"
        @click="openAddModal"
      >
        <UserPlus :size="16" />
        Agregar
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-12 text-center text-gray-400">
      Cargando equipo...
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      class="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600"
    >
      {{ loadError }}
      <button
        class="mt-2 block w-full text-xs font-medium text-red-700 underline"
        @click="fetchEmployees"
      >
        Reintentar
      </button>
    </div>

    <template v-else>
      <!-- Owner card -->
      <div
        v-if="ownerEntry"
        class="mb-4 flex items-center gap-4 rounded-xl bg-blue-50 p-4"
      >
        <span
          class="flex h-10 w-10 items-center justify-center rounded-full bg-nova-primary text-sm font-bold text-white"
        >
          {{ ownerEntry.name.charAt(0) }}
        </span>
        <div class="flex-1">
          <p class="font-medium text-gray-900">{{ ownerEntry.name }}</p>
          <p class="text-xs text-blue-600">Dueno</p>
        </div>
      </div>

      <!-- Active employees -->
      <div v-if="activeEmployees.length > 0" class="space-y-2">
        <div
          v-for="emp in activeEmployees"
          :key="emp.id"
          class="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600"
          >
            {{ emp.name.charAt(0) }}
          </span>
          <div class="flex-1">
            <p class="font-medium text-gray-900">{{ emp.name }}</p>
            <p class="text-xs text-gray-500">Empleado</p>
          </div>
          <button
            class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Editar"
            @click="openEditModal(emp)"
          >
            <Pencil :size="16" />
          </button>
          <button
            class="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
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
        class="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center"
      >
        <p class="text-gray-400">No hay empleados registrados</p>
        <button
          class="mt-3 text-sm font-medium text-nova-primary hover:underline"
          @click="openAddModal"
        >
          Agregar primer empleado
        </button>
      </div>

      <!-- Inactive employees -->
      <div v-if="inactiveEmployees.length > 0" class="mt-6">
        <h2 class="mb-2 text-sm font-medium text-gray-500">Desactivados</h2>
        <div class="space-y-2">
          <div
            v-for="emp in inactiveEmployees"
            :key="emp.id"
            class="flex items-center gap-4 rounded-xl bg-gray-50 p-4 opacity-60"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-400"
            >
              {{ emp.name.charAt(0) }}
            </span>
            <div class="flex-1">
              <p class="font-medium text-gray-500">{{ emp.name }}</p>
            </div>
            <button
              class="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showAddModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-4 text-lg font-semibold text-gray-900">
            Nuevo empleado
          </h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Nombre</label>
              <input
                v-model="newName"
                type="text"
                placeholder="Ej: Maria Garcia"
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
                autofocus
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                PIN ({{ PIN_LENGTH }} digitos)
              </label>
              <input
                v-model="newPin"
                type="password"
                inputmode="numeric"
                :maxlength="PIN_LENGTH"
                placeholder="0000"
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-[0.5em] focus:border-nova-primary focus:outline-none"
              />
            </div>
          </div>

          <p v-if="addError" class="mt-3 text-sm text-red-500">
            {{ addError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
              @click="showAddModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showEditModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="mb-4 text-lg font-semibold text-gray-900">
            Editar empleado
          </h3>

          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600">Nombre</label>
              <input
                v-model="editName"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-nova-primary focus:outline-none"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600">
                Nuevo PIN (dejar vacio para no cambiar)
              </label>
              <input
                v-model="editPin"
                type="password"
                inputmode="numeric"
                :maxlength="PIN_LENGTH"
                placeholder="****"
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-center text-xl tracking-[0.5em] focus:border-nova-primary focus:outline-none"
              />
            </div>
          </div>

          <p v-if="editError" class="mt-3 text-sm text-red-500">
            {{ editError }}
          </p>

          <div class="mt-5 flex gap-3">
            <button
              class="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              class="flex-1 rounded-lg bg-nova-primary py-2.5 text-sm font-medium text-white disabled:opacity-50"
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
