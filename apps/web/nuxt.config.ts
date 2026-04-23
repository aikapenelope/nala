import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",

  devtools: { enabled: true },

  modules: ["@clerk/nuxt", "@vite-pwa/nuxt", "@nuxt/eslint"],

  clerk: {
    // Tell Clerk where the dedicated sign-in and sign-up pages live.
    // Used for internal links ("Already have an account?" etc.).
    signInUrl: "/auth/login",
    signUpUrl: "/auth/signup",
    // Always redirect to /auth/resolve after sign-in or sign-up.
    // This ensures the Nova user is resolved before accessing the app.
    signInForceRedirectUrl: "/auth/resolve",
    signUpForceRedirectUrl: "/auth/resolve",
    // After sign-out, go to landing page.
    afterSignOutUrl: "/landing",
  },

  css: ["~/assets/css/main.css"],

  vite: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite version mismatch between Nuxt and @tailwindcss/vite
    plugins: [tailwindcss() as any],
  },

  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Nova - Backoffice Operativo",
      short_name: "Nova",
      description:
        "Backoffice operativo para comerciantes y PyMEs. Ventas, inventario, clientes, reportes.",
      theme_color: "#1e40af",
      background_color: "#ffffff",
      display: "standalone",
      orientation: "any",
      icons: [
        {
          src: "/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
    },
    devOptions: {
      enabled: false,
    },
  },

  runtimeConfig: {
    public: {
      /** Base URL of the Nova API. Override with NUXT_PUBLIC_API_BASE. */
      apiBase: "http://localhost:3001",
      /** Domain for tenant subdomains. Override with NUXT_PUBLIC_TENANT_DOMAIN. */
      tenantDomain: "novaincs.com",
    },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  app: {
    pageTransition: { name: "page", mode: "out-in" },
    head: {
      title: "Nova",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Backoffice operativo para comerciantes y PyMEs",
        },
      ],
    },
  },
});
