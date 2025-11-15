import { Component, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfManager } from '../../services/pdf-manager.service';
import { PreviewModalComponent } from '../preview-modal/preview-modal.component';

@Component({
  selector: 'app-pdf-image-viewer',
  standalone: true,
  imports: [CommonModule, PreviewModalComponent],
  templateUrl: './pdf-image-viewer.component.html',
  styleUrl: './pdf-image-viewer.component.scss',
})
export class PdfImageViewerComponent implements OnDestroy {
  files = signal<File[]>([]);
  pdfManager = inject(PdfManager);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files).filter((file) => {
        // Aceitar por tipo MIME
        if (
          file.type === 'application/pdf' ||
          file.type.startsWith('image/')
        ) {
          return true;
        }

        // Fallback: aceitar por extensão do arquivo
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
        return validExtensions.some((ext) => fileName.endsWith(ext));
      });

      this.files.update((currentFiles) => [...currentFiles, ...newFiles]);
      input.value = ''; // Clear the input to allow selecting the same file again
    }
  }

  selectFileForPreview(file: File): void {
    this.pdfManager.openPreview(file);
  }

  removeFile(index: number): void {
    this.files.update((currentFiles) => currentFiles.filter((_, i) => i !== index));
  }

  async mergeAndDownload(): Promise<void> {
    if (this.files().length === 0) {
      alert('Por favor, selecione arquivos para unificar.');
      return;
    }

    try {
      console.log(`\n📥 ═══ INICIANDO PROCESSO DE UNIFICAÇÃO ═══`);
      console.log(`📋 ${this.files().length} arquivo(s) selecionado(s)`);
      const processStartTime = performance.now();

      // Validar e preparar arquivos (validação, compressão)
      console.log(`⏳ Validando e comprimindo arquivos...`);
      const validationStart = performance.now();
      const { files: preparedFiles } = await this.pdfManager.validateAndPrepareFiles(this.files());
      const validationTime = ((performance.now() - validationStart) / 1000).toFixed(2);
      console.log(`✅ Validação concluída em ${validationTime}s`);

      // Fazer merge
      console.log(`\n⏳ Mesclando arquivos...`);
      const mergeStart = performance.now();
      const mergedPdfBytes = await this.pdfManager.mergeFiles(preparedFiles);
      const mergeTime = ((performance.now() - mergeStart) / 1000).toFixed(2);
      console.log(`✅ Merge concluído em ${mergeTime}s`);

      // Garantir que temos um Uint8Array válido
      const safeBytes = new Uint8Array(mergedPdfBytes);
      const blob = new Blob([safeBytes], { type: 'application/pdf' });
      const finalSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documento_unificado.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const totalTime = ((performance.now() - processStartTime) / 1000).toFixed(2);
      console.log(`\n✅ ═══ PROCESSO CONCLUÍDO ═══`);
      console.log(`📦 PDF Final: ${finalSizeMB}MB`);
      console.log(`⏱️  Tempo total: ${totalTime}s`);
      console.log(`   - Validação: ${validationTime}s`);
      console.log(`   - Merge: ${mergeTime}s`);
      console.log(`═══════════════════════════════════\n`);

      // Limpar arquivos após sucesso
      this.files.set([]);
      alert('Documentos unificados com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Falha ao unificar. Verifique o console.';
      console.error('Erro ao unificar:', error);
      alert(errorMessage);
    }
  }

  ngOnDestroy(): void {
    this.pdfManager.closePreview();
  }
}
