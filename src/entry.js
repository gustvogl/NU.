import { loadRuntimeConfig } from './runtime-config.js';
await loadRuntimeConfig({env:{VITE_SUPABASE_URL:import.meta.env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}});
await import('./main.jsx');
