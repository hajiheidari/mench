# ADR 0001: foundation stack

Status: accepted for M0. Date: 2026-10-03.

Registry metadata checked: Expo 57.0.26, Vite 8.3.2, Fastify 5.12.5. Expo's published bundledNativeModules.json pins React 19.2.3 and React Native 0.86.3; use those compatible releases instead of independently choosing latest React/native. Node 24.19.0 is provided and satisfies Vite. TypeScript 5.9 and ESLint 10 are conservative supported toolchain choices; avoid a simultaneous major compiler migration. Exact resolution lives in package-lock.json.

Choose npm workspaces, React/Vite, Expo, Fastify, Vitest, PostgreSQL and Redis. React/Expo allow shared contracts and maintainable native UI; Expo supports both stores without Android-only assumptions. A native iOS build still requires macOS and signing. No store submission now.

Next.js SSR is unnecessary for an interactive authenticated board and adds runtime complexity. NestJS is viable but unnecessary for the M0 health endpoint; Fastify modules can provide explicit boundaries. npm workspaces need no additional task daemon. Prisma versus alternatives is deferred until persistence requirements exist. Docker/Compose are development tools, not a production deployment design.

Sources: https://registry.npmjs.org/expo, https://registry.npmjs.org/vite, https://registry.npmjs.org/fastify, published Expo 57.0.26 bundledNativeModules.json; https://docs.expo.dev/ and https://vite.dev/guide/.
