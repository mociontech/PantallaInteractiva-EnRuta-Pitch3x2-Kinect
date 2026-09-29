/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TD_WS_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEVICE_ID?: string;
}
