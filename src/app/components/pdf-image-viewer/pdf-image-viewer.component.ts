import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfManager } from '../../services/pdf-manager.service';
import { PreviewModalComponent } from '../preview-modal/preview-modal.component';
import { ManagedFile } from '../../services/file-manager.models';

@Component({
  selector: 'app-pdf-image-viewer',
  standalone: true,
  imports: [CommonModule, PreviewModalComponent],
  templateUrl: './pdf-image-viewer.component.html',
  styleUrl: './pdf-image-viewer.component.scss',
})
export class PdfImageViewerComponent implements OnDestroy {
  pdfManager = inject(PdfManager);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files).filter((file) => {
        // Aceitar por tipo MIME ou extensão
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        return isPdf || isImage;
      });

      this.pdfManager.addFiles(newFiles);
      input.value = ''; // Limpa o input para permitir selecionar o mesmo arquivo
    }
  }

  selectFileForPreview(managedFile: ManagedFile): void {
    // Usa o arquivo original para preview para evitar mostrar a versão comprimida
    this.pdfManager.openPreview(managedFile.file);
  }

  removeFile(fileId: string): void {
    this.pdfManager.removeFile(fileId);
  }

  async mergeAndDownload(): Promise<void> {
    const managedFiles = this.pdfManager.managedFiles();
    if (managedFiles.length === 0) {
      alert('Por favor, selecione arquivos para unificar.');
      return;
    }

    try {
      console.log(`\n📥 ═══ INICIANDO PROCESSO DE UNIFICAÇÃO ═══`);
      console.log(`📋 ${managedFiles.length} arquivo(s) selecionado(s)`);
      const processStartTime = performance.now();

      // 1. Validar arquivos (agora sem compressão, que já foi feita)
      console.log(`⏳ Validando arquivos...`);
      const validationStart = performance.now();
      await this.pdfManager.validateAndPrepareFiles(managedFiles);
      const validationTime = ((performance.now() - validationStart) / 1000).toFixed(2);
      console.log(`✅ Validação concluída em ${validationTime}s`);

      // 2. Fazer merge
      console.log(`\n⏳ Mesclando arquivos...`);
      const mergeStart = performance.now();
      const mergedPdfBytes = await this.pdfManager.mergeFiles(managedFiles);
      const mergeTime = ((performance.now() - mergeStart) / 1000).toFixed(2);
      console.log(`✅ Merge concluído em ${mergeTime}s`);

      // 3. Download
      const blob = new Blob([mergedPdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const finalSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      const url = URL.createObjectURL(blob);

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
      this.pdfManager.managedFiles.set([]);
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
    this.pdfManager.managedFiles.set([]); // Limpa os arquivos ao sair
  }
}
