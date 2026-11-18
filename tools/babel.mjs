// Babel settings that make code run on iOS 8 Safari (tested on the iPad minis, Nov 2026).
// computed-properties etc. are forced on: Safari 8 claims them but throws "Attempted to redefine property".
export const BABEL_IOS8 = {
  babelrc: false, configFile: false, compact: true, comments: false, sourceType: 'script',
  presets: [['@babel/preset-env', {
    targets: { ios: '8' }, modules: false, loose: true,
    exclude: ['transform-typeof-symbol'],
    include: ['transform-computed-properties', 'transform-shorthand-properties', 'transform-duplicate-keys'],
  }]],
};
