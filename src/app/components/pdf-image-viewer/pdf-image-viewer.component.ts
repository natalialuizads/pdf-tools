import { Component, signal, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { PdfMergerService } from '../../services/pdf-merger.service';

@Component({
  selector: 'app-pdf-image-viewer',
  standalone: true,
  imports: [CommonModule, PdfViewerModule],
  templateUrl: './pdf-image-viewer.component.html',
  styleUrl: './pdf-image-viewer.component.scss',
})
export class PdfImageViewerComponent implements OnDestroy {
  files = signal<File[]>([]);
  selectedFile = signal<{ url: string; type: string } | null>(null);
  pdfMergerService = inject(PdfMergerService);

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
    // Revoke previous object URL to prevent memory leaks
    if (this.selectedFile()?.url) {
      URL.revokeObjectURL(this.selectedFile()!.url);
    }

    const url = URL.createObjectURL(file);
    this.selectedFile.set({ url, type: file.type });
  }

  removeFile(index: number): void {
    const fileToRemove = this.files()[index];
    if (this.selectedFile()?.url === URL.createObjectURL(fileToRemove)) {
      URL.revokeObjectURL(this.selectedFile()!.url);
      this.selectedFile.set(null);
    }
    this.files.update((currentFiles) => currentFiles.filter((_, i) => i !== index));
  }

  async mergeAndDownload(): Promise<void> {
    if (this.files().length === 0) {
      alert('Please select files to merge.');
      return;
    }

    try {
      const mergedPdfBytes = await this.pdfMergerService.mergeFilesToPdf(this.files());
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
    // Revoke any remaining object URL when the component is destroyed
    if (this.selectedFile()?.url) {
      URL.revokeObjectURL(this.selectedFile()!.url);
    }
  }
}
