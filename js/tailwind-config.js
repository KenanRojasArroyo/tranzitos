// Configuración de Tailwind CSS (CDN).
// Debe cargarse justo después de https://cdn.tailwindcss.com
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        title: ['Outfit', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pop': 'pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite alternate',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' }
        },
        glowPulse: {
          '0%': { filter: 'drop-shadow(0 0 15px rgba(236, 72, 153, 0.4))' },
          '100%': { filter: 'drop-shadow(0 0 35px rgba(168, 85, 247, 0.7))' }
        }
      }
    }
  }
};
