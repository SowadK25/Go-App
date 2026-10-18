import { useEffect, useMemo, useRef } from 'react';
import { Linking } from 'react-native';
import { createMapDocument } from './mapDocument';
import { attributionUrl, handleMapMessage, type TransitMapProps } from './mapTypes';
import { frameStyle } from './TransitMap.web.styles';

export function TransitMap(props: TransitMapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => createMapDocument(props.network), [props.network]);
  const sendFilter = () =>
    ref.current?.contentWindow?.postMessage(
      { source: 'transitflow-app', type: 'filter', filter: props.filter },
      '*',
    );
  useEffect(() => {
    sendFilter();
  }, [props.filter]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || event.data?.source !== 'transitflow-map')
        return;
      if (event.data.type === 'ready') sendFilter();
      if (event.data.type === 'open-url') {
        const url = attributionUrl(event.data);
        if (url) void Linking.openURL(url);
      }
      handleMapMessage(event.data, props);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [props]);
  return (
    <iframe
      ref={ref}
      title="Interactive GO Transit and UP Express map"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin"
      style={frameStyle}
      onLoad={sendFilter}
    />
  );
}
