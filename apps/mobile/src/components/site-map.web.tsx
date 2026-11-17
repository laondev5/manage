import { createElement } from 'react';
import { View } from 'react-native';
import { siteMapHtml, type SiteMapInput } from './site-map-html';

export function SiteMap({ latitude, longitude, radiusMeters, name }: SiteMapInput) {
  return (
    <View
      className="h-[210px] overflow-hidden rounded-[18px] border border-line bg-[#EDF1F8]"
      accessibilityRole="image"
      accessibilityLabel={`Map of ${name} and its ${radiusMeters} metre boundary`}
    >
      {createElement('iframe', {
        title: `Map of ${name}`,
        srcDoc: siteMapHtml({ latitude, longitude, radiusMeters, name }),
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
        loading: 'lazy',
      })}
    </View>
  );
}
