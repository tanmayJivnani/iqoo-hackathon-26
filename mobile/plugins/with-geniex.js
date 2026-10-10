const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withGenieX(config) {
  return withGradleProperties(config, config => {
    const properties = { 'android.minSdkVersion': '27', 'expo.useLegacyPackaging': 'true' };
    config.modResults = config.modResults.filter(item => !(item.type === 'property' && item.key in properties));
    for (const [key, value] of Object.entries(properties)) config.modResults.push({ type: 'property', key, value });
    return config;
  });
};
