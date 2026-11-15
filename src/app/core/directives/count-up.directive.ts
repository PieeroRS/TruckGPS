import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Muestra un valor contando desde el número anterior hasta el nuevo («0 → 12», «80% → 87%»).
 * Acepta texto con prefijo o sufijo; si no hay número, lo muestra tal cual.
 */
@Directive({ standalone: true, selector: '[appCountUp]' })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('appCountUp') value: string | number | null | undefined = '';
  @Input() countMs = 700;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private frame = 0;
  private shown = 0;

  ngOnChanges(): void {
    cancelAnimationFrame(this.frame);
    const text = String(this.value ?? '');
    const m = /^(\D*?)(-?\d[\d.,]*)(.*)$/s.exec(text);
    const quieto = typeof window === 'undefined' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.hidden;
    if (!m || quieto) {
      this.el.nativeElement.textContent = text;
      return;
    }
    const [, pre, num, post] = m;
    // «1,234.5» o «1234,5»: se respeta el formato original.
    const comaDecimal = /,\d{1,2}$/.test(num) && !num.includes('.');
    const target = Number(comaDecimal ? num.replace(/\./g, '').replace(',', '.') : num.replace(/,/g, ''));
    if (!Number.isFinite(target)) {
      this.el.nativeElement.textContent = text;
      return;
    }
    const decimales = (num.split(comaDecimal ? ',' : '.')[1] ?? '').length;
    const miles = !comaDecimal && /\d,\d{3}/.test(num);
    const from = this.shown;
    const t0 = performance.now();
    const pinta = (v: number) => {
      let s = v.toFixed(decimales);
      if (comaDecimal) s = s.replace('.', ',');
      if (miles) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      this.el.nativeElement.textContent = pre + s + post;
    };
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / this.countMs);
      const e = 1 - Math.pow(1 - k, 3);
      this.shown = from + (target - from) * e;
      if (k < 1) {
        pinta(this.shown);
        this.frame = requestAnimationFrame(step);
      } else {
        this.shown = target;
        this.el.nativeElement.textContent = text; // el texto final es exactamente el recibido
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }
}
