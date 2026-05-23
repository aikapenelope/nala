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
    build: {
      rollupOptions: {
        output: {
          // Isolate heavy libraries into separate chunks so they don't
          // bloat the storefront bundle. These only load when needed.
          manualChunks(id) {
            if (id.includes("@clerk/") || id.includes("clerk")) {
              return "clerk";
            }
            if (id.includes("chart.js") || id.includes("vue-chartjs")) {
              return "charts";
            }
            if (id.includes("xlsx")) {
              return "xlsx";
            }
          },
        },
      },
    },
  },

  pwa: {
    registerType: "autoUpdate",
    // Manifest is served dynamically via server/routes/manifest.json.get.ts
    // to support per-tenant PWA branding on subdomains.
    manifest: false,
    workbox: {
      navigateFallback: "/",
      // Only precache essential assets — avoid downloading the entire admin dashboard
      // on first PWA install. Runtime caching handles the rest on-demand.
      globPatterns: ["**/*.{css,html,png,svg,ico}"],
      // Exclude heavy admin-only JS chunks and non-shell static assets.
      // Note on maximumFileSizeToCacheInBytes: the vite-plugin-pwa default is
      // 2 MiB and hard-errors on build when exceeded. Raising that limit is NOT
      // the right fix — it would push large files into every PWA install payload.
      // Instead, exclude files that are not part of the app shell:
      //   - logo.png         : nav/sidebar logo (512 KB). Not needed on SW
      //                        install; loads with the first authenticated page.
      //   - og-storefront.png: 1.7 MB social-preview image. Never requested
      //                        by the PWA shell at runtime.
      globIgnores: [
        "**/clerk*.js",
        "**/charts*.js",
        "**/xlsx*.js",
        "logo.png",
        "og-storefront.png",
      ],
      // Import push notification handler into the service worker
      importScripts: ["/push-sw.js"],
      runtimeCaching: [
        {
          // Cache JS chunks on-demand with stale-while-revalidate
          urlPattern: /\/_nuxt\/.*\.js$/,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "js-chunks",
            expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
          },
        },
        {
          // Cache product images with cache-first strategy
          urlPattern: /\/images\/products\/.*/,
          handler: "CacheFirst",
          options: {
            cacheName: "product-images",
            expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
          },
        },
        {
          // Cache API catalog responses with network-first (fresh data preferred)
          urlPattern: /\/catalog\/.*/,
          handler: "NetworkFirst",
          options: {
            cacheName: "catalog-api",
            expiration: { maxEntries: 10, maxAgeSeconds: 5 * 60 },
            networkTimeoutSeconds: 5,
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },

  routeRules: {
    // Storefront pages: SSR for SEO + CDN edge caching.
    // s-maxage: CDN caches for 60s, stale-while-revalidate: serve stale for 5min while refreshing.
    // This eliminates SSR latency for most visitors (CDN serves cached HTML).
    "/tienda/**": {
      ssr: true,
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    },
    // Static assets: aggressive caching (1 year, immutable via content hash)
    "/_nuxt/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
    // API proxy or manifest: short cache
    "/manifest.json": {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
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
      link: [
        { rel: "manifest", href: "/manifest.json" },
        // Favicons
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        // Apple touch icon (iOS add-to-homescreen)
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        // Preconnect to font CDN to eliminate DNS+TLS latency
        { rel: "preconnect", href: "https://api.fontshare.com", crossorigin: "" },
        { rel: "dns-prefetch", href: "https://api.fontshare.com" },
        // Load font stylesheet non-blocking (media swap trick)
        {
          rel: "stylesheet",
          href: "https://api.fontshare.com/v2/css?f[]=plus-jakarta-sans@500,700,800&display=swap",
          media: "print",
          onload: "this.media='all'",
        },
      ],
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        {
          name: "description",
          content: "Backoffice operativo para comerciantes y PyMEs",
        },
      ],
      // Fallback for browsers with JS disabled
      noscript: [
        {
          innerHTML: '<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=plus-jakarta-sans@500,700,800&display=swap">',
        },
      ],
    },
  },
});
