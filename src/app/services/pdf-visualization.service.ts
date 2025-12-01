import { Injectable, signal, Signal } from '@angular/core';

export interface PdfPreviewContent {
  url: string;
  type: string;
  fileName?: string;
  base64?: string;
}

/**
 * Serviço responsável pela visualização de PDFs e imagens
 * Gerencia o estado do modal de preview
 */
@Injectable({
  providedIn: 'root',
})
export class PdfVisualizationService {
  private isPreviewOpen = signal<boolean>(false);
  private previewContent = signal<PdfPreviewContent | null>(null);
  private isPasswordProtected = signal<boolean>(false);

  // Signals públicos (readonly)
  readonly isPreviewOpenSignal: Signal<boolean> = this.isPreviewOpen.asReadonly();
  readonly previewContentSignal: Signal<PdfPreviewContent | null> =
    this.previewContent.asReadonly();
  readonly isPasswordProtectedSignal: Signal<boolean> = this.isPasswordProtected.asReadonly();

  /**
   * Abre o preview de um arquivo
   * @param file Arquivo a visualizar
   * @param isProtectedByPassword Indica se o PDF tem senha
   * @param base64 Conteúdo base64 do arquivo (opcional)
   */
  openPreview(file: File, isProtectedByPassword: boolean = false, base64?: string): void {
    this.closePreview(); // Revoga URL anterior
    const url = URL.createObjectURL(file);
    this.previewContent.set({
      url,
      type: file.type,
      fileName: file.name,
      base64,
    });
    this.isPasswordProtected.set(isProtectedByPassword);
    this.isPreviewOpen.set(true);
  }

  /**
   * Fecha o preview e libera recursos
   */
  closePreview(): void {
    this.revokePreviewUrl();
    this.isPreviewOpen.set(false);
    this.previewContent.set(null);
    this.isPasswordProtected.set(false);
  }

  /**
   * Revoga a URL do objeto para liberar memória
   */
  private revokePreviewUrl(): void {
    const content = this.previewContent();
    if (content?.url) {
      URL.revokeObjectURL(content.url);
    }
  }

  /**
   * Verifica se o preview está aberto
   */
  isOpen(): boolean {
    return this.isPreviewOpen();
  }
}
