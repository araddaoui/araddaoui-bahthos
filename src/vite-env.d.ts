/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BYPASS_AUTH?: string;
  readonly VITE_ADMIN_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}