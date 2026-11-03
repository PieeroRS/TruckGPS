import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin, Location } from '@capacitor-community/background-geolocation';

/**
 * GPS nativo para la app Android (Capacitor). Sigue enviando la ubicación con la pantalla
 * apagada o la app en segundo plano mediante un servicio en primer plano con notificación.
 * En el navegador no existe: ahí se usa navigator.geolocation.
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface NativeFix {
  lat: number;
  lng: number;
  accuracy: number;
  speedMs: number | null;
  time: number;
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): string {
  return Capacitor.getPlatform();
}

/** Android 13+ necesita este permiso para mostrar la notificación del servicio. */
async function ensureNotificationPermission(): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const st = await LocalNotifications.checkPermissions();
    if (st.display !== 'granted') await LocalNotifications.requestPermissions();
  } catch {
    /* sin el plugin, el servicio sigue funcionando aunque la notificación no se vea */
  }
}

export async function startNativeWatch(
  onFix: (fix: NativeFix) => void,
  onError: (message: string, needsSettings: boolean) => void
): Promise<string> {
  await ensureNotificationPermission();
  return BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'TruckGPS está compartiendo tu ubicación',
      backgroundMessage: 'El centro de control ve tu unidad en tiempo real. Desactívalo desde la app.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5
    },
    (location?: Location, error?: { code?: string; message?: string }) => {
      if (error) {
        const denied = error.code === 'NOT_AUTHORIZED';
        onError(
          denied
            ? 'TruckGPS no tiene permiso de ubicación. Ábrelo en Ajustes y elige «Permitir siempre» o «Mientras se usa la app».'
            : error.message || 'No se pudo obtener la ubicación.',
          denied
        );
        return;
      }
      if (!location) return;
      onFix({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: Math.round(location.accuracy),
        speedMs: location.speed,
        time: location.time ?? Date.now()
      });
    }
  );
}

export async function stopNativeWatch(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await BackgroundGeolocation.removeWatcher({ id });
  } catch {
    /* ya estaba detenido */
  }
}

export function openNativeSettings(): void {
  void BackgroundGeolocation.openSettings();
}
