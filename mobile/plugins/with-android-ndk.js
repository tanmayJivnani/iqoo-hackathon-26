const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidNdk(config) {
  return withGradleProperties(config, config => {
    config.modResults = config.modResults.filter(item => !(item.type === 'property' && item.key === 'ndkVersion'));
    config.modResults.push({ type: 'property', key: 'ndkVersion', value: '30.0.16248370' });
    return config;
  });
};
