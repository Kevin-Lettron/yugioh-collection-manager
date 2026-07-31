/**
 * Les couleurs pointent vers les variables CSS définies dans src/styles/theme.css.
 * Conséquence : les classes déjà écrites dans les pages (bg-white, text-gray-700,
 * bg-blue-600…) suivent automatiquement le thème sombre/clair, sans réécriture.
 *
 * Remap sémantique :
 *   blue / sky               → OR (couleur primaire)
 *   purple / indigo / violet → VIOLET (secondaire)
 *   teal / cyan              → CYAN (accent)
 *   pink / rose              → MAGENTA
 *   red                      → DANGER
 *   green / emerald          → SUCCÈS
 *   yellow / amber / orange  → AVERTISSEMENT
 *   gray / slate / zinc / neutral / stone → échelle INVERSÉE en thème sombre
 *
 * `black` reste du vrai noir : il sert aux fonds de caméra du scanner.
 *
 * @type {import('tailwindcss').Config}
 */

// `rgb(... / <alpha-value>)` conserve le support des opacités Tailwind (bg-white/50).
const ramp = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => [
      shade,
      `rgb(var(--c-${name}-${shade}) / <alpha-value>)`,
    ])
  );

const gray = ramp('gray');
const gold = ramp('blue');
const violet = ramp('purple');
const cyan = ramp('teal');
const magenta = ramp('pink');
const danger = ramp('red');
const success = ramp('green');
const warn = ramp('yellow');

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--c-white) / <alpha-value>)',

        gray,
        slate: gray,
        zinc: gray,
        neutral: gray,
        stone: gray,

        blue: gold,
        sky: gold,
        primary: gold,

        purple: violet,
        indigo: violet,
        violet,

        teal: cyan,
        cyan,

        pink: magenta,
        rose: magenta,

        red: danger,
        green: success,
        emerald: success,

        yellow: warn,
        amber: warn,
        orange: warn,
      },
      fontFamily: {
        display: ['Orbitron', 'Rajdhani', 'system-ui', 'sans-serif'],
        sans: ['Rajdhani', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(245, 197, 24, 0.25)',
        'glow-violet': '0 0 24px rgba(168, 85, 247, 0.3)',
      },
    },
  },
  plugins: [],
};
