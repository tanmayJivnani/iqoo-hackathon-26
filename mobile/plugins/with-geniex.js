const { withGradleProperties } = require('expo/config-plugins');
const { genieXGradleProperties } = require('../scripts/android-build-properties');

module.exports = function withGenieX(config) {
  return withGradleProperties(config, config => {
    const properties = { ...genieXGradleProperties };
    const existingMinimum = config.modResults.find(item => item.type === 'property' && item.key === 'android.minSdkVersion');
    properties['android.minSdkVersion'] = String(Math.max(Number.parseInt(existingMinimum?.value, 10) || 0, 27));
    config.modResults = config.modResults.filter(item => !(item.type === 'property' && item.key in properties));
    for (const [key, value] of Object.entries(properties)) config.modResults.push({ type: 'property', key, value });
    return config;
  });
};
