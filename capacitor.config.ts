import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App Android de TruckGPS.
 *
 * La app abre el sitio publicado (server.url), así cada despliegue en Vercel llega al celular
 * sin reinstalar. Lo que aporta la app es nativo: GPS en segundo plano con la pantalla apagada
 * o la app minimizada (servicio en primer plano con notificación permanente).
 */
const config: CapacitorConfig = {
  appId: 'pe.truckgps.app',
  appName: 'TruckGPS',
  webDir: 'dist/truckgps/browser',
  server: {
    url: 'https://truck-gps-umber.vercel.app',
    androidScheme: 'https',
    cleartext: false
  },
  android: {
    // Evita que las actualizaciones de ubicación se corten a los 5 min en segundo plano
    // (indicación del plugin @capacitor-community/background-geolocation).
    useLegacyBridge: true
  },
  plugins: {
    // Envía las peticiones HTTP por la capa nativa: Android limita las del WebView en segundo plano.
    CapacitorHttp: { enabled: true }
  }
};

export default config;
