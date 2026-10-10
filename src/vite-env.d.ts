/// <reference types="vite/client" />

declare const __BUILD_STAMP__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEPLOY_HOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
