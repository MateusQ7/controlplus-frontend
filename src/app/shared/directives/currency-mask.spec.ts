import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it, beforeEach } from 'vitest';
import { CurrencyMask } from './currency-mask';

@Component({
  imports: [ReactiveFormsModule, CurrencyMask],
  template: `<input type="text" appCurrency [formControl]="amount" />`,
})
class Host {
  readonly amount = new FormControl<number | null>(null);
}

describe('CurrencyMask', () => {
  let fixture: ComponentFixture<Host>;
  let input: HTMLInputElement;

  /** Simula a digitação de um caractere no fim do campo. */
  function type(char: string): void {
    input.value = input.value + char;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  it('preenche da direita, centavos primeiro', () => {
    type('9');
    expect(input.value).toBe('0,09');
    expect(fixture.componentInstance.amount.value).toBe(0.09);

    type('0');
    expect(input.value).toBe('0,90');
    expect(fixture.componentInstance.amount.value).toBe(0.9);

    type('0');
    expect(input.value).toBe('9,00');
    expect(fixture.componentInstance.amount.value).toBe(9);

    type('0');
    expect(input.value).toBe('90,00');
    expect(fixture.componentInstance.amount.value).toBe(90);
  });

  it('agrupa milhar', () => {
    for (const char of '123456') {
      type(char);
    }

    expect(input.value).toBe('1.234,56');
    expect(fixture.componentInstance.amount.value).toBe(1234.56);
  });

  it('ignora o que não é dígito', () => {
    type('a');
    expect(input.value).toBe('');
    expect(fixture.componentInstance.amount.value).toBeNull();

    type('5');
    type('R$');
    expect(input.value).toBe('0,05');
  });

  it('esvaziar zera o controle em vez de virar 0,00', () => {
    type('5');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(input.value).toBe('');
    expect(fixture.componentInstance.amount.value).toBeNull();
  });

  it('mostra o valor que vem do formulário e some quando é nulo', () => {
    fixture.componentInstance.amount.setValue(1234.5);
    fixture.detectChanges();
    expect(input.value).toBe('1.234,50');

    fixture.componentInstance.amount.setValue(null);
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('desabilita o campo junto com o controle', () => {
    fixture.componentInstance.amount.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });
});
