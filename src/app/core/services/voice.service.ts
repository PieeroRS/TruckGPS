import { Injectable, signal } from '@angular/core';

const VOICE_KEY = 'truckgps_voz';

/** Guía hablada con la voz del propio equipo (Web Speech API). */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  readonly enabled = signal(this.readPref());
  readonly lastText = signal('');
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (!this.supported) return;
    this.pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice());
  }

  private readPref(): boolean {
    try {
      return localStorage.getItem(VOICE_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    try {
      localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
    } catch {
      /* preferencia no guardada */
    }
    if (!on) this.stop();
  }

  private pickVoice(): void {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
    const order = ['es-pe', 'es-mx', 'es-us', 'es-419', 'es-co', 'es-cl', 'es-ar', 'es-es'];
    const rank = (v: SpeechSynthesisVoice) => {
      const i = order.indexOf(v.lang.toLowerCase().replace('_', '-'));
      return (i === -1 ? order.length : i) - (v.localService ? 0.5 : 0);
    };
    this.voice = voices.sort((a, b) => rank(a) - rank(b))[0] ?? null;
  }

  /**
   * iOS y Android solo dejan hablar después de un toque del usuario: se llama
   * desde el botón «Iniciar» para desbloquear la voz del resto del viaje.
   */
  unlock(): void {
    if (!this.supported) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* sin voz */
    }
  }

  speak(text: string, interrupt = true): void {
    this.lastText.set(text);
    if (!this.supported || !this.enabled() || !text) return;
    try {
      const synth = window.speechSynthesis;
      if (interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (!this.voice) this.pickVoice();
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? 'es-PE';
      u.rate = 1;
      u.pitch = 1;
      synth.speak(u);
    } catch {
      /* sin voz: la indicación sigue en pantalla */
    }
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }
}
