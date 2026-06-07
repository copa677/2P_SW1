/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        plomo: {
          strong: '#161b22', // Fondo general plomo fuerte
          card: '#1f242c',   // Fondo tarjetas plomo
          border: '#30363d', // Borde gris oscuro
          hover: '#2d333b',  // Hover gris oscuro
        }
      }
    },
  },
  plugins: [],
}