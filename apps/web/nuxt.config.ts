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
    // Manifest is served dynamically via server/routes/manifest.json.get.ts
    // to support per-tenant PWA branding on subdomains.
    manifest: false,
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
    },
    devOptions: {
      enabled: false,
    },
  },

  routeRules: {
    // Storefront pages: always SSR for SEO and social sharing
    "/tienda/**": { ssr: true },
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
      link: [{ rel: "manifest", href: "/manifest.json" }],
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        {
          name: "description",
          content: "Backoffice operativo para comerciantes y PyMEs",
        },
      ],
    },
  },
});
