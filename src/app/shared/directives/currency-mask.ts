import { Directive, ElementRef, forwardRef, HostListener, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Acima disso o Number perde precisão; nenhum lançamento chega perto. */
const MAX_DIGITS = 15;

/**
 * Máscara de dinheiro que preenche da direita, como caixa eletrônico:
 * 9 vira 0,09, depois 0,90, 9,00, 90,00. O campo mostra texto formatado,
 * mas o formulário continua recebendo número — então Validators.min e o
 * payload da API não mudam em nada.
 *
 * Use em input type="text": type="number" não aceita separador de milhar
 * nem permite mover o cursor com setSelectionRange.
 */
@Directive({
  selector: 'input[appCurrency]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyMask),
      multi: true,
    },
  ],
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
  },
})
export class CurrencyMask implements ControlValueAccessor {

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  @HostListener('input')
  protected handleInput(): void {
    const input = this.el.nativeElement;
    // Só os dígitos importam: vírgula e pontos são redesenhados a cada tecla.
    const digits = input.value.replace(/\D/g, '').slice(0, MAX_DIGITS);

    if (!digits) {
      input.value = '';
      this.onChange(null);
      return;
    }

    const value = Number(digits) / 100;
    this.render(value);
    this.onChange(value);
  }

  @HostListener('blur')
  protected handleBlur(): void {
    this.onTouched();
  }

  writeValue(value: number | null): void {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      // Vazio de verdade, para o placeholder aparecer em vez de "0,00".
      this.el.nativeElement.value = '';
      return;
    }

    this.render(value, false);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }

  /** O dígito novo entra pela direita, então o cursor fica sempre no fim. */
  private render(value: number, moveCaret = true): void {
    const input = this.el.nativeElement;
    input.value = FORMAT.format(value);

    if (moveCaret) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }
}
