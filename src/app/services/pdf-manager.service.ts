import { Injectable } from '@angular/core';
import { Signal } from '@angular/core';
import { PdfValidationService, PdfValidationResult } from './pdf-validation.service';
import { PdfMergerService } from './pdf-merger.service';
import { PdfVisualizationService, PdfPreviewContent } from './pdf-visualization.service';
import { ImageCompressionService } from './image-compression.service';

/**
 * PdfManager: Orquestrador Principal
 *
 * Responsabilidades:
 * - Coordena todos os serviços de PDF (validação, merge, visualização, compressão)
 * - Valida PDFs antes de fazer merge
 * - Comprime imagens automaticamente
 * - Gerencia o workflow completo
 *
 * Workflow típico:
 * 1. Usuário seleciona arquivos
 * 2. PdfManager valida e comprime
 * 3. Usuário visualiza preview (PdfVisualizationService)
 * 4. Usuário faz merge (PdfMergerService)
 * 5. Download do PDF unificado
 */
@Injectable({
  providedIn: 'root',
})
export class PdfManager {
  private readonly MAX_TOTAL_SIZE_BYTES = 7 * 1024 * 1024; // 7 MB

  constructor(
    private pdfValidation: PdfValidationService,
    private pdfMerger: PdfMergerService,
    private pdfVisualization: PdfVisualizationService,
    private imageCompression: ImageCompressionService
  ) {}

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
    files: File[]
  ): Promise<{ files: File[]; validations: PdfValidationResult[] }> {
    if (!files || files.length === 0) {
      throw new Error('Nenhum arquivo foi selecionado');
    }

    console.log(`\n🚀 Iniciando validação e preparação de ${files.length} arquivo(s)...`);
    const startTime = performance.now();

    const validations: PdfValidationResult[] = [];
    const processedFiles: File[] = [];
    const passwordProtectedFiles: string[] = [];

    // Validar e processar cada arquivo
    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Validar PDFs
        const validation = await this.pdfValidation.validatePdf(file);
        validations.push(validation);

        if (!validation.isValid) {
          throw new Error(`PDF inválido: ${file.name} - ${validation.error}`);
        }

        if (validation.requiresPassword) {
          passwordProtectedFiles.push(file.name);
        }

        processedFiles.push(file);
      } else if (this.isImageFile(file)) {
        // Comprimir imagens
        try {
          console.log(`📸 Comprimindo imagem: ${file.name}`);
          const compressionStart = performance.now();
          const result = await this.imageCompression.compressImage(file);
          const compressionTime = ((performance.now() - compressionStart) / 1000).toFixed(2);

          console.log(
            `✅ Imagem comprimida em ${compressionTime}s - Economia: ${this.imageCompression.calculateSavings(
              result.originalSize,
              result.compressedSize
            )}`
          );
          processedFiles.push(result.compressedFile);
        } catch (error) {
          console.warn(`⚠️ Falha ao comprimir imagem ${file.name}, usando original`);
          processedFiles.push(file);
        }
      } else {
        throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
      }
    }

    // Verificar se há PDFs com senha
    if (passwordProtectedFiles.length > 0) {
      const filesList = passwordProtectedFiles.join(', ');
      throw new Error(
        `Os seguintes PDFs estão protegidos por senha: ${filesList}. Remova a proteção antes de continuar.`
      );
    }

    // Validar tamanho total
    this.validateTotalSize(processedFiles);

    const endTime = performance.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Validação e preparação concluída em ${totalTime}s\n`);

    return { files: processedFiles, validations };
  }

  /**
   * Valida se o tamanho total não excede 7MB
   */
  private validateTotalSize(files: File[]): void {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > this.MAX_TOTAL_SIZE_BYTES) {
      const maxSizeMB = this.MAX_TOTAL_SIZE_BYTES / (1024 * 1024);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      throw new Error(`Tamanho total (${totalSizeMB}MB) excede o limite de ${maxSizeMB}MB`);
    }
  }

  /**
   * Valida um único PDF
   */
  async validateSinglePdf(file: File): Promise<PdfValidationResult> {
    if (file.type !== 'application/pdf') {
      throw new Error('O arquivo fornecido não é um PDF');
    }
    return this.pdfValidation.validatePdf(file);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── MERGE DE ARQUIVOS ───
  // ═══════════════════════════════════════════════════════════

  /**
   * Unifica múltiplos PDFs e imagens em um único PDF
   * Pressupõe que validateAndPrepareFiles foi executado
   * @param files Array de arquivos processados
   * @returns PDF unificado como Uint8Array
   */
  async mergeFiles(files: File[]): Promise<Uint8Array> {
    if (!files || files.length === 0) {
      throw new Error('Nenhum arquivo para unificar');
    }

    console.log(`\n📦 Iniciando merge de ${files.length} arquivo(s)...`);
    const startTime = performance.now();

    try {
      const result = await this.pdfMerger.mergeFilesToPdf(files);
      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const sizeMB = (result.length / (1024 * 1024)).toFixed(2);

      console.log(`✅ Merge concluído em ${duration}s`);
      console.log(`📄 PDF final: ${sizeMB}MB\n`);

      return result;
    } catch (error) {
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

      this.pdfVisualization.openPreview(file, isProtected);
    } catch (error) {
      console.error('Erro ao abrir preview:', error);
      this.pdfVisualization.openPreview(file, false);
    }
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
