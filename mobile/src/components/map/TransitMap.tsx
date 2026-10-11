import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { createMapDocument, scriptJson } from './mapDocument';
import { attributionUrl, handleMapMessage, type TransitMapProps } from './mapTypes';
import { styles } from './TransitMap.styles';

export function TransitMap(props: TransitMapProps) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const source = useMemo(() => ({ html: createMapDocument(props.network) }), [props.network]);
  useEffect(() => {
    if (ready)
      ref.current?.injectJavaScript(
        `window.TransitMap.setFilter(${scriptJson(props.filter)});true;`,
      );
  }, [props.filter, ready]);
  return (
    <WebView
      ref={ref}
      source={source}
      style={styles.map}
      originWhitelist={['*']}
      applicationNameForUserAgent="TransitFlow/1.0"
      mixedContentMode="never"
      javaScriptEnabled
      onLoadStart={() => setReady(false)}
      onShouldStartLoadWithRequest={(request) =>
        request.url === 'about:blank' || request.url.startsWith('data:text/html')
      }
      onMessage={(event) => {
        try {
          const message = JSON.parse(event.nativeEvent.data);
          if (message.source !== 'transitflow-map') return;
          if (message.type === 'ready') setReady(true);
          if (message.type === 'open-url') {
            const url = attributionUrl(message);
            if (url) void Linking.openURL(url);
          }
          handleMapMessage(message, props);
        } catch {
          /* Ignore malformed bridge messages. */
        }
      }}
    />
  );
}
