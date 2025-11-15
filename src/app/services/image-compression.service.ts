import { Injectable } from '@angular/core';
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
  onProgress?: (progress: number) => void;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressedFile: File;
}

@Injectable({
  providedIn: 'root',
})
export class ImageCompressionService {
  // Cache de arquivos já comprimidos (key: hash do arquivo, value: arquivo comprimido)
  private compressionCache = new Map<string, CompressionResult>();

  // Opções padrão otimizadas para velocidade
  private readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxSizeMB: 0.5, // Reduzido para 0.5MB (mais agressivo)
    maxWidthOrHeight: 1200, // Reduzido para 1200px (menos pixels = mais rápido)
    useWebWorker: true, // Usar web worker para não bloquear UI
    initialQuality: 0.6, // Qualidade em 60% (mais rápido, ainda bom para PDFs)
  };

  /**
   * Gera uma chave de cache baseada no arquivo (nome + tamanho + modificação)
   */
  private getCacheKey(file: File): string {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }

  /**
   * Comprime uma imagem mantendo a qualidade com cache
   * @param file Arquivo de imagem
   * @param options Opções de compressão customizadas
   * @returns Arquivo comprimido com metadados
   */
  async compressImage(
    file: File,
    options?: Partial<CompressionOptions>
  ): Promise<CompressionResult> {
    console.log(`[ImageCompressionService] compressImage: Attempting to compress ${file.name}`);
    // Verificar cache
    const cacheKey = this.getCacheKey(file);
    if (this.compressionCache.has(cacheKey)) {
      console.log(`[ImageCompressionService] compressImage: ✓ Cache hit for: ${file.name} (no re-processing)`);
      // Simular progresso para cache hits
      options?.onProgress?.(100);
      return this.compressionCache.get(cacheKey)!;
    }

    const compressionOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const fileStartTime = performance.now();

    try {
      const originalSize = file.size;
      const originalSizeMB = (originalSize / (1024 * 1024)).toFixed(2);

      // Skip compressão se arquivo já é pequeno (< 500KB)
      if (originalSize < 500 * 1024) {
        const skipTime = ((performance.now() - fileStartTime) / 1000).toFixed(2);
        console.log(
          `[ImageCompressionService] compressImage: ⚡ ${file.name} [${originalSizeMB}MB] - already small, using original (${skipTime}s)`
        );
        options?.onProgress?.(100); // Progresso completo
        const result: CompressionResult = {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          compressedFile: file,
        };
        this.compressionCache.set(cacheKey, result);
        return result;
      }

      console.log(`[ImageCompressionService] compressImage: ⏳ Comprimindo ${file.name} [${originalSizeMB}MB]...`);
      const compressionStartTime = performance.now();

      const compressedFile = await imageCompression(file, {
        ...compressionOptions,
        onProgress: (progress) => {
          options?.onProgress?.(progress);
          console.log(`[ImageCompressionService] compressImage: ${file.name} compression progress: ${progress}%`);
        },
      });
      const compressedSize = compressedFile.size;
      const compressedSizeMB = (compressedSize / (1024 * 1024)).toFixed(2);
      const compressionTime = ((performance.now() - compressionStartTime) / 1000).toFixed(2);
      const savingsPercent = (((originalSize - compressedSize) / originalSize) * 100).toFixed(1);

      console.log(
        `[ImageCompressionService] compressImage: ✅ ${file.name}: ${originalSizeMB}MB → ${compressedSizeMB}MB (${savingsPercent}% menor) in ${compressionTime}s`
      );

      const result: CompressionResult = {
        originalSize,
        compressedSize,
        compressionRatio: (originalSize - compressedSize) / originalSize,
        compressedFile,
      };

      // Armazenar em cache
      this.compressionCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`[ImageCompressionService] compressImage: ❌ Error compressing image "${file.name}": ${error}`);
      throw new Error(
        `Erro ao comprimir imagem "${file.name}": ${
          error instanceof Error ? error.message : 'Erro desconhecido'
        }`
      );
    }
  }

  /**
   * Comprime múltiplas imagens EM PARALELO (muito mais rápido)
   * @param files Array de arquivos de imagem
   * @param options Opções de compressão
   * @returns Array de arquivos comprimidos
   */
  async compressMultipleImagesParallel(
    files: File[],
    options?: Partial<CompressionOptions>
  ): Promise<CompressionResult[]> {
    console.log(`\n🚀 ═══ COMPRESSÃO EM PARALELO ═══`);
    console.log(`📦 Iniciando compressão de ${files.length} imagem(ns)...`);
    const startTime = performance.now();

    // Processar todas as imagens em paralelo ao invés de sequencial
    const compressionPromises = files.map((file) => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return this.compressImage(file, options);
    });
    const results = await Promise.all(compressionPromises);

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Calcular totais
    const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSavings = totalOriginal - totalCompressed;
    const savingsPercent = ((totalSavings / totalOriginal) * 100).toFixed(1);

    console.log(`\n✅ COMPRESSÃO CONCLUÍDA`);
    console.log(
      `   Total: ${(totalOriginal / (1024 * 1024)).toFixed(2)}MB → ${(
        totalCompressed /
        (1024 * 1024)
      ).toFixed(2)}MB`
    );
    console.log(`   Economia: ${(totalSavings / (1024 * 1024)).toFixed(2)}MB (${savingsPercent}%)`);
    console.log(`   ⏱️  Tempo total: ${duration}s`);
    console.log(`═══════════════════════════════════\n`);

    return results;
  }

  /**
   * Comprime apenas arquivos de imagem de um array misto (com paralelismo)
   * @param files Array de arquivos (PDFs, imagens, etc)
   * @param options Opções de compressão
   * @returns Array com arquivos processados (imagens comprimidas, PDFs intactos)
   */
  async processFileArray(files: File[], options?: Partial<CompressionOptions>): Promise<File[]> {
    // Separar imagens de outros arquivos
    const imageFiles = files.filter((f) => this.isImageFile(f));
    const otherFiles = files.filter((f) => !this.isImageFile(f));

    // Se houver imagens, comprimir em paralelo
    if (imageFiles.length === 0) {
      console.log(`📂 Nenhuma imagem para comprimir. Retornando arquivos originais.`);
      return files;
    }

    try {
      console.log(
        `� Total de arquivos: ${files.length} (${imageFiles.length} imagens, ${otherFiles.length} PDFs)`
      );
      const compressedResults = await this.compressMultipleImagesParallel(imageFiles, options);

      // Combinar PDFs + imagens comprimidas na ordem original
      const processedFiles: File[] = [];
      let imageIndex = 0;
      let otherIndex = 0;

      for (const file of files) {
        if (this.isImageFile(file)) {
          processedFiles.push(compressedResults[imageIndex++].compressedFile);
        } else {
          processedFiles.push(otherFiles[otherIndex++]);
        }
      }

      console.log(`✅ Processamento concluído! ${processedFiles.length} arquivos prontos.`);
      return processedFiles;
    } catch (error) {
      console.warn(`⚠️ Erro ao processar imagens, usando originais:`, error);
      return files;
    }
  }

  /**
   * Verifica se um arquivo é uma imagem
   */
  isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Calcula o espaço economizado
   */
  calculateSavings(originalSize: number, compressedSize: number): string {
    const saved = originalSize - compressedSize;
    const savedMB = (saved / (1024 * 1024)).toFixed(2);
    const percentage = ((saved / originalSize) * 100).toFixed(1);
    return `${savedMB}MB (${percentage}%)`;
  }

  /**
   * Formata tamanho de arquivo em MB
   */
  formatFileSize(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
  }

  /**
   * Limpa o cache de compressão
   */
  clearCache(): void {
    console.log(`🗑️ Cache de compressão limpo (${this.compressionCache.size} itens)`);
    this.compressionCache.clear();
  }

  /**
   * Retorna informações do cache
   */
  getCacheInfo(): {
    size: number;
    entries: Array<{ fileName: string; savedBytes: number }>;
  } {
    const entries: Array<{ fileName: string; savedBytes: number }> = [];
    this.compressionCache.forEach((result, _key) => {
      entries.push({
        fileName: result.compressedFile.name,
        savedBytes: result.originalSize - result.compressedSize,
      });
    });

    return {
      size: this.compressionCache.size,
      entries,
    };
  }
}
