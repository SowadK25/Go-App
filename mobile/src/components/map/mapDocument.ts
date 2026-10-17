import type { NetworkMap } from '../../api/generated';
import { leafletJs, leafletCss, mapRuntime, mapCss } from './generatedAssets';

export function scriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function createMapDocument(network: NetworkMap) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>${leafletCss}\n${mapCss}</style></head><body><div id="map" aria-label="GO Transit and UP Express network map"></div><script>${leafletJs.replace(/<\/script/gi, '<\\/script')}</script><script>window.TRANSIT_NETWORK=${scriptJson(network)};</script><script>${mapRuntime.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}
