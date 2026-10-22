import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // tsconfig.json의 "@/*" 경로와 같게
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)).replaceAll("\\", "/") },
      // 테스트는 서버 환경이므로 "server-only" 검사를 통과시킨다
      { find: "server-only", replacement: fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    // .env 값을 그대로 읽는다 (DB 연동 테스트용)
    env: loadEnv("test", process.cwd(), ""),
  },
});
