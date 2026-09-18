const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('node:path');
// Ignore this app's outputs, while allowing dependencies such as pretty-format/build.
const ignoredRoots = ['build', 'android/build', 'android/app/build', 'ios/Pods', 'macos/Pods']
  .map(dir => path.resolve(__dirname, dir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const config = {
  resolver: {
    platforms: ['ios', 'android', 'macos', 'windows'],
    resolveRequest(context, moduleName, platform) {
      const host = platform === 'macos' ? 'react-native-macos' : platform === 'windows' ? 'react-native-windows' : null;
      if (host) {
        if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) moduleName = moduleName.replace('react-native', host);
        const nativeRoot = path.join(__dirname, 'node_modules/react-native/');
        if (moduleName.startsWith(nativeRoot)) moduleName = moduleName.replace(nativeRoot, path.join(__dirname, `node_modules/${host}/`));
      }
      return context.resolveRequest(context, moduleName, platform);
    },
    blockList: [...ignoredRoots.map(root => new RegExp(`^${root}[/\\\\]`)), /.*\.ProjectImports\.zip$/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
