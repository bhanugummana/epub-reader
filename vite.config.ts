import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.REACT_APP_GITHUB_BASE ?? "/",
  plugins: [react()],
})
