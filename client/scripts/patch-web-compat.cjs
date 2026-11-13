const fs = require('node:fs');
const path = require('node:path');

// Some dependencies still use deprecated React Native Web props.
// Keep its toast layout, animation and gestures while using the current props.
// Apply after npm ci/install so this fix survives a clean dependency install.
const modules = path.join(__dirname, '../node_modules');
const components = 'react-native-toast-message/lib/src/components/';
function patch(name, update) {
  const file = path.join(modules, name);
  const original = fs.readFileSync(file, 'utf8');
  const next = update(original.replace(/\r\n/g, '\n'));
  if (next !== original.replace(/\r\n/g, '\n')) fs.writeFileSync(file, next);
}
// Expo Router 57 uses query-string 7 (CommonJS). The security-fixed decoder
// is ESM; unwrap its default export for both Metro and Node's ESM interop.
patch('query-string/index.js', source => {
  const legacy = "const decodeComponent = require('decode-uri-component');";
  const fixed = "const decodeComponentModule = require('decode-uri-component');\nconst decodeComponent = decodeComponentModule.default || decodeComponentModule;";
  if (source.includes(fixed)) return source;
  if (!source.includes(legacy)) throw new Error('Query-string security compatibility patch needs review after the dependency update.');
  return source.replace(legacy, fixed);
});
patch(components + 'BaseToast.styles.js', source => {
  if (!source.includes('shadowOffset:')) return source;
  const legacy = 'shadowOffset: { width: 0, height: 0 },\n        shadowOpacity: 0.1,\n        shadowRadius: BORDER_RADIUS,';
  if (!source.includes(legacy)) throw new Error('Toast shadow compatibility patch needs review after the dependency update.');
  return source.replace(legacy, "boxShadow: '0 0 6px rgba(0,0,0,0.1)',");
});
patch(components + 'AnimatedContainer.js', source => {
  if (!source.includes("pointerEvents='box-none'")) return source;
  const legacy = 'style={[styles.base, styles[position], animationStyles]}';
  if (!source.includes(legacy)) throw new Error('Toast pointer-events compatibility patch needs review after the dependency update.');
  return source.replace(legacy, "style={[styles.base, styles[position], animationStyles, { pointerEvents: 'box-none' }]}")
    .replace("pointerEvents='box-none' ", '');
});
for (const directory of ['dist/exports', 'dist/cjs/exports']) {
  patch('react-native-web/' + directory + '/TouchableOpacity/index.js', source => {
    const legacy = "pointerEvents: disabled ? 'box-none' : undefined,";
    if (!source.includes(legacy)) return source;
    const style = 'style: [styles.root, !disabled && styles.actionable, style, opacityOverride';
    if (!source.includes(style)) throw new Error('Web TouchableOpacity compatibility patch needs review after the dependency update.');
    return source.replace(legacy, '').replace(style, "style: [styles.root, !disabled && styles.actionable, style, disabled && { pointerEvents: 'box-none' }, opacityOverride");
  });
}
