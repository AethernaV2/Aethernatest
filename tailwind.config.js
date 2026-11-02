/** Configuración de Tailwind de Aetherna V2 (la misma que antes estaba en cada <head>) */
module.exports = {
  content: ['./*.html', './fragments/**/*.htm', './site.js'],
  theme: {
    extend: {
      colors: {
        aetherna: {
          bgMain: '#07051A',
          bgSec: '#0E0A26',
          panel: '#151034',
          field: '#0B0824',
          goldMain: '#D9B46A',
          goldLight: '#F0D79E',
          parchment: '#F6E2B3',
          goldHover: '#FFF2CF',
          bronze: '#9C7A43',
          bronzeDark: '#5A4A8A',
          textNormal: '#E9D7B0',
          textSoft: '#C8B48C',
          textMuted: '#9C8865',
          ember: '#9D6CF0',
          blood: '#44207F',
          error: '#FF7A6A',
          success: '#86C98A',
          warning: '#F0A050',
          locked: '#8A7A62',
          cosmicViolet: '#9A6BFF'
        }
      },
      fontFamily: {
        cinzelDeco: ['Cinzel Decorative', 'serif'],
        cinzel: ['Cinzel', 'serif'],
        garamond: ['EB Garamond', 'serif']
      }
    }
  },
  plugins: []
};
