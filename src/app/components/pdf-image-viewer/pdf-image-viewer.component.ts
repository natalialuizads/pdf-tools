import { Component, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfManager } from '../../services/pdf-merger.service';
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
      const newFiles = Array.from(input.files).filter(
        (file) =>
          file.type === 'application/pdf' ||
          file.type.startsWith('image/png') ||
          file.type.startsWith('image/jpeg')
      );
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
      alert('Please select files to merge.');
      return;
    }

    try {
      const mergedPdfBytes = await this.pdfManager.mergeFilesToPdf(this.files());
      // Ensure we have proper Uint8Array with ArrayBuffer backing
      const safeBytes = new Uint8Array(mergedPdfBytes);
      const blob = new Blob([safeBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged_document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to merge documents. Check console for details.';
      console.error('Error merging documents:', error);
      alert(errorMessage);
    }
  }

  ngOnDestroy(): void {
    this.pdfManager.closePreview();
  }
}
