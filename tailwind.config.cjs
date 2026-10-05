module.exports = {
      content: ['./index.html', './lesson-player.js', './extras.js', './cloud-sync.js'],
      darkMode: 'class',
      theme: { extend: {
        colors: {
          brand: { 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 950: '#022c22' },
          dark: { base: '#030712' }
        },
        fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] }
      } }
    };
