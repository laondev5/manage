import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { siteMapHtml, type SiteMapInput } from './site-map-html';

export function SiteMap({ latitude, longitude, radiusMeters, name }: SiteMapInput) {
  return (
    <View
      className="h-[210px] overflow-hidden rounded-[18px] border border-line bg-[#EDF1F8]"
      accessibilityRole="image"
      accessibilityLabel={`Map of ${name} and its ${radiusMeters} metre boundary`}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: siteMapHtml({ latitude, longitude, radiusMeters, name }) }}
        style={{ flex: 1, backgroundColor: '#EDF1F8' }}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
