import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Envelope sobre o <dialog> nativo: ele já entrega foco preso, Esc para fechar
 * e inerte no resto da página. Renderize dentro de um @if — o construtor abre.
 */
@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements AfterViewInit {

  readonly heading = input.required<string>();
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Um só caminho de saída: o evento close do <dialog> cobre Esc e botão. */
  protected onClose(): void {
    this.closed.emit();
  }

  /** Clique no backdrop cai no próprio <dialog>, não no conteúdo. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
