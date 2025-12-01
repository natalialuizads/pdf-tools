import { Injectable, signal, Signal } from '@angular/core';
import { ManagedFile } from './file-manager.models';
import { ImageCompressionService } from './image-compression.service';
import { PdfMergerService } from './pdf-merger.service';
import { PdfValidationResult, PdfValidationService } from './pdf-validation.service';
import { PdfPreviewContent, PdfVisualizationService } from './pdf-visualization.service';

/**
 * PdfManager: Orquestrador Principal
 *
 * Responsabilidades:
 * - Gerencia o ciclo de vida dos arquivos (adição, compressão, remoção)
 * - Coordena todos os serviços de PDF (validação, merge, visualização)
 * - Comprime imagens em background ao serem adicionadas
 *
 * Workflow típico:
 * 1. Usuário seleciona arquivos
 * 2. `addFiles` é chamado, adicionando arquivos ao signal `managedFiles`
 * 3. Compressão de imagens é iniciada em background
 * 4. UI reage às mudanças de estado dos `ManagedFile` (mostrando progresso)
 * 5. Usuário visualiza preview (PdfVisualizationService)
 * 6. Usuário faz merge (PdfMergerService)
 * 7. Download do PDF unificado
 */
@Injectable({
  providedIn: 'root',
})
export class PdfManager {
  private readonly MAX_TOTAL_SIZE_BYTES = 7 * 1024 * 1024; // 7 MB

  managedFiles = signal<ManagedFile[]>([]);

  constructor(
    private pdfValidation: PdfValidationService,
    private pdfMerger: PdfMergerService,
    private pdfVisualization: PdfVisualizationService,
    private imageCompression: ImageCompressionService
  ) {}

  // ═══════════════════════════════════════════════════════════
  // ─── GERENCIAMENTO DE ARQUIVOS ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Adiciona novos arquivos, os processa e inicia a compressão em background
   */
  addFiles(files: File[]): void {
    console.log(`[PdfManager] addFiles: Adding ${files.length} new files.`);
    const newManagedFiles: ManagedFile[] = files.map((file) => ({
      id: this.generateUniqueId(),
      file,
      state: 'unprocessed',
      progress: 0,
    }));

    this.managedFiles.update((current) => [...current, ...newManagedFiles]);
    console.log(`[PdfManager] addFiles: Managed files updated. Current count: ${this.managedFiles().length}`);

    // Inicia a compressão em background
    newManagedFiles.forEach((managedFile) => {
      console.log(`[PdfManager] addFiles: Starting background compression for ${managedFile.file.name}`);
      this._compressFileInBackground(managedFile);
    });
  }

  /**
   * Remove um arquivo da lista
   */
  removeFile(fileId: string): void {
    console.log(`[PdfManager] removeFile: Removing file with ID ${fileId}`);
    this.managedFiles.update((current) => current.filter((f) => f.id !== fileId));
    console.log(`[PdfManager] removeFile: Managed files updated. Current count: ${this.managedFiles().length}`);
  }

  /**
   * Processa e comprime um arquivo em background
   */
  private async _compressFileInBackground(managedFile: ManagedFile): Promise<void> {
    const { id, file } = managedFile;
    console.log(`[PdfManager] _compressFileInBackground: Processing ${file.name} (ID: ${id})`);

    // 1. Atualiza estado para 'compressing'
    this.updateFileState(id, { state: 'compressing', progress: 20 });
    console.log(`[PdfManager] _compressFileInBackground: ${file.name} state updated to 'compressing'`);

    // 2. Se não for imagem, apenas marca como 'compressed' (sem compressão real)
    if (!this.isImageFile(file)) {
      this.updateFileState(id, { state: 'compressed', progress: 100 });
      console.log(`[PdfManager] _compressFileInBackground: ${file.name} is not an image, state updated to 'compressed'`);
      return;
    }

    // 3. Comprime a imagem
    try {
      console.log(`[PdfManager] _compressFileInBackground: Comprimindo imagem: ${file.name}`);
      const compressionStart = performance.now();

      const result = await this.imageCompression.compressImage(file, {
        onProgress: (progress) => {
          // O progresso da compressão vai de 20% a 80%
          this.updateFileState(id, { progress: 20 + progress * 0.6 });
          console.log(`[PdfManager] _compressFileInBackground: ${file.name} progress: ${Math.round(20 + progress * 0.6)}%`);
        },
      });

      const compressionTime = ((performance.now() - compressionStart) / 1000).toFixed(2);
      console.log(
        `[PdfManager] _compressFileInBackground: ✅ Imagem comprimida em ${compressionTime}s - Economia: ${this.imageCompression.calculateSavings(
          result.originalSize,
          result.compressedSize
        )}`
      );

      // 4. Sucesso na compressão
      this.updateFileState(id, {
        state: 'compressed',
        compressedFile: result.compressedFile,
        progress: 100,
      });
      console.log(`[PdfManager] _compressFileInBackground: ${file.name} state updated to 'compressed'`);
    } catch (error) {
      console.warn(`[PdfManager] _compressFileInBackground: ⚠️ Falha ao comprimir imagem ${file.name}, usando original`);
      // 5. Erro na compressão
      this.updateFileState(id, {
        state: 'error',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        progress: 100,
      });
      console.error(`[PdfManager] _compressFileInBackground: ${file.name} compression failed: ${error}`);
    }
  }

  /**
   * Atualiza o estado de um ManagedFile de forma imutável
   */
  private updateFileState(fileId: string, updates: Partial<ManagedFile>): void {
    this.managedFiles.update((current) =>
      current.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ─── VALIDAÇÃO E PREPARAÇÃO ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Valida e processa um array de arquivos antes de fazer merge
   * - Valida cada PDF
   * - Comprime PDFs
   * - Comprime imagens
   * - Verifica tamanho total
   * @param files Array de arquivos selecionados
   * @returns Array de arquivos processados
   */
  async validateAndPrepareFiles(
    managedFiles: ManagedFile[]
  ): Promise<{ files: File[]; validations: PdfValidationResult[] }> {
    console.log(`[PdfManager] validateAndPrepareFiles: Starting validation for ${managedFiles.length} files.`);
    if (!managedFiles || managedFiles.length === 0) {
      throw new Error('Nenhum arquivo foi selecionado');
    }

    console.log(`\n🚀 Iniciando validação de ${managedFiles.length} arquivo(s)...`);
    const startTime = performance.now();

    const validations: PdfValidationResult[] = [];
    const processedFiles: File[] = [];
    const passwordProtectedFiles: string[] = [];

    // 1. Garantir que todos os arquivos foram processados (não estão 'compressing')
    const unprocessed = managedFiles.filter((f) => f.state === 'compressing');
    if (unprocessed.length > 0) {
      console.warn(`[PdfManager] validateAndPrepareFiles: Found ${unprocessed.length} files still compressing.`);
      throw new Error('Aguarde o término da compressão de todos os arquivos.');
    }

    // 2. Validar cada arquivo
    for (const managedFile of managedFiles) {
      const fileToValidate = managedFile.compressedFile || managedFile.file;
      console.log(`[PdfManager] validateAndPrepareFiles: Validating ${managedFile.file.name}`);

      if (this.isPdfFile(managedFile.file)) {
        const validation = await this.pdfValidation.validatePdf(fileToValidate as File);
        validations.push(validation);

        if (!validation.isValid) {
          console.error(`[PdfManager] validateAndPrepareFiles: PDF invalid: ${managedFile.file.name} - ${validation.error}`);
          throw new Error(`PDF inválido: ${managedFile.file.name} - ${validation.error}`);
        }
        if (validation.requiresPassword) {
          passwordProtectedFiles.push(managedFile.file.name);
          console.warn(`[PdfManager] validateAndPrepareFiles: PDF ${managedFile.file.name} is password protected.`);
        }
      }
      processedFiles.push(fileToValidate as File);
    }

    // 3. Verificar se há PDFs com senha
    if (passwordProtectedFiles.length > 0) {
      const filesList = passwordProtectedFiles.join(', ');
      console.error(`[PdfManager] validateAndPrepareFiles: Password protected PDFs found: ${filesList}`);
      throw new Error(
        `Os seguintes PDFs estão protegidos por senha: ${filesList}. Remova a proteção antes de continuar.`
      );
    }

    // 4. Validar tamanho total
    const totalSize = processedFiles.reduce((sum, file) => sum + file.size, 0);
    console.log(`[PdfManager] validateAndPrepareFiles: Total size of processed files: ${this.formatFileSize(totalSize)}`);
    if (totalSize > this.MAX_TOTAL_SIZE_BYTES) {
      const maxSizeMB = this.MAX_TOTAL_SIZE_BYTES / (1024 * 1024);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      console.error(`[PdfManager] validateAndPrepareFiles: Total size (${totalSizeMB}MB) exceeds limit of ${maxSizeMB}MB`);
      throw new Error(`Tamanho total (${totalSizeMB}MB) excede o limite de ${maxSizeMB}MB`);
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[PdfManager] validateAndPrepareFiles: ✨ Validação concluída em ${totalTime}s\n`);

    return { files: processedFiles, validations };
  }

  /**
   * Valida um único PDF
   */
  async validateSinglePdf(file: File): Promise<PdfValidationResult> {
    console.log(`[PdfManager] validateSinglePdf: Validating single PDF: ${file.name}`);
    if (file.type !== 'application/pdf') {
      console.error(`[PdfManager] validateSinglePdf: File ${file.name} is not a PDF.`);
      throw new Error('O arquivo fornecido não é um PDF');
    }
    return this.pdfValidation.validatePdf(file);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── MERGE DE ARQUIVOS ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Unifica múltiplos PDFs e imagens em um único PDF
   * @param managedFiles Array de arquivos gerenciados
   * @returns PDF unificado como Uint8Array
   */
  async mergeFiles(managedFiles: ManagedFile[]): Promise<Uint8Array> {
    console.log(`[PdfManager] mergeFiles: Starting merge for ${managedFiles.length} files.`);
    if (!managedFiles || managedFiles.length === 0) {
      console.error(`[PdfManager] mergeFiles: No files to merge.`);
      throw new Error('Nenhum arquivo para unificar');
    }

    console.log(`\n📦 Iniciando merge de ${managedFiles.length} arquivo(s)...`);
    const startTime = performance.now();

    // Extrai o arquivo final (comprimido ou original)
    const filesToMerge = managedFiles.map((mf) => {
      const file = (mf.compressedFile || mf.file) as File;
      console.log(`[PdfManager] mergeFiles: Preparing ${file.name} for merge (size: ${this.formatFileSize(file.size)})`);
      return file;
    });

    try {
      const result = await this.pdfMerger.mergeFilesToPdf(filesToMerge);
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      const sizeMB = (result.length / (1024 * 1024)).toFixed(2);

      console.log(`[PdfManager] mergeFiles: ✅ Merge concluído em ${duration}s`);
      console.log(`[PdfManager] mergeFiles: 📄 PDF final: ${sizeMB}MB\n`);

      return result;
    } catch (error) {
      console.error(`[PdfManager] mergeFiles: Error merging PDFs: ${error}`);
      throw new Error(
        `Erro ao unificar PDFs: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ─── VISUALIZAÇÃO ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Abre o preview de um arquivo no modal
   * Automaticamente detecta se é protegido por senha
   */
  async openPreview(file: File): Promise<void> {
    try {
      const isProtected =
        file.type === 'application/pdf'
          ? (await this.pdfValidation.validatePdf(file)).requiresPassword
          : false;

      let base64: string | undefined;
      if (file.type === 'application/pdf') {
        base64 = await this.fileToBase64(file);
      }

      this.pdfVisualization.openPreview(file, isProtected, base64);
    } catch (error) {
      console.error('Erro ao abrir preview:', error);
      this.pdfVisualization.openPreview(file, false);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  /**
   * Fecha o preview
   */
  closePreview(): void {
    this.pdfVisualization.closePreview();
  }

  /**
   * Verifica se o preview está aberto
   */
  isPreviewOpen(): boolean {
    return this.pdfVisualization.isOpen();
  }

  // ═══════════════════════════════════════════════════════════
  // ─── SIGNALS (Delegados) ───
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // ─── UTILITÁRIOS ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Verifica se um arquivo é uma imagem
   */
  private isImageFile(file: File): boolean {
    return (
      file.type.startsWith('image/') ||
      file.name.toLowerCase().endsWith('.png') ||
      file.name.toLowerCase().endsWith('.jpg') ||
      file.name.toLowerCase().endsWith('.jpeg')
    );
  }

  /**
   * Verifica se um arquivo é um PDF
   */
  private isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Gera um ID único simples
   */
  private generateUniqueId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── SIGNALS ───
  // ═══════════════════════════════════════════════════════════

  get isPreviewOpenSignal(): Signal<boolean> {
    return this.pdfVisualization.isPreviewOpenSignal;
  }

  get previewContentSignal(): Signal<PdfPreviewContent | null> {
    return this.pdfVisualization.previewContentSignal;
  }

  get isPasswordProtectedSignal(): Signal<boolean> {
    return this.pdfVisualization.isPasswordProtectedSignal;
  }

  // ═══════════════════════════════════════════════════════════
  // ─── INFORMAÇÕES ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Retorna informações sobre validação de um PDF
   */
  getValidationInfo(validation: PdfValidationResult): string {
    if (validation.requiresPassword) {
      return `🔒 Protegido por senha (${validation.pageCount} páginas)`;
    }
    if (!validation.isValid) {
      return `❌ Inválido: ${validation.error}`;
    }
    return `✓ Válido (${validation.pageCount} páginas)`;
  }

  /**
   * Formata tamanho de arquivo
   */
  formatFileSize(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
  }
}
