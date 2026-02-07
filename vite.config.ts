import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// No GitHub Pages, use a base igual ao nome do repositório (ex: /Ranking-Cabare/).
// Definido pela workflow; localmente usa caminhos relativos (./).
const base = process.env.VITE_BASE_PATH ?? './'

export default defineConfig({
  base,
  plugins: [tailwindcss()],
})
