# 📐 Arquitetura do PDF-Tools

## 🏗️ Visão Geral

A aplicação segue uma arquitetura **em camadas com separação de responsabilidades**, onde cada serviço tem uma responsabilidade única e bem definida.

```
┌─────────────────────────────────────────────────────────┐
│         COMPONENTES (UI)                                │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ PdfImageViewerComp   │  │ PreviewModalComponent│    │
│  └──────────────┬───────┘  └──────────────┬───────┘    │
└─────────────────┼──────────────────────────┼─────────────┘
                  │                          │
                  └──────────────┬───────────┘
                                 │
        ┌────────────────────────▼────────────────────────┐
        │      PdfManager (Orquestrador Central)         │
        │                                                 │
        │  • validateAndPrepareFiles()                   │
        │  • mergeFiles()                                │
        │  • openPreview()                               │
        │  • closePreview()                              │
        └────────────────────────┬────────────────────────┘
                                 │
        ┌────────┬───────────────┼───────────┬──────────┐
        │        │               │           │          │
    ┌───▼──┐ ┌──▼────────┐ ┌────▼────┐ ┌───▼───┐       │
    │      │ │           │ │         │ │       │       │
    │ PDFs │ │ Imagens   │ │Validação│ │Compre-│       │
    │      │ │           │ │         │ │ssão  │       │
    └──────┘ └────────────┘ └─────────┘ └───────┘       │
```

## 🎯 Serviços Principais

### 1. **PdfManager** (`pdf-manager.service.ts`) - 🎭 Orquestrador

```typescript
// Responsabilidades:
✓ Coordena todos os serviços
✓ Valida PDFs (senha, tipo, metadados)
✓ Comprime imagens automaticamente
✓ Gerencia workflow completo
✓ Expõe signals para componentes

// Métodos principais:
- validateAndPrepareFiles(files): Valida + comprime + valida tamanho
- mergeFiles(files): Unifica PDFs e imagens
- openPreview(file): Abre preview com detecção de senha
- closePreview(): Fecha modal
```

**Por que separado?**

- Evita lógica de negócio nos componentes
- Facilita testes
- Centraliza decisões de workflow
- Reutilizável em diferentes componentes

---

### 2. **PdfValidationService** (`pdf-validation.service.ts`) - 🔍 Validador

```typescript
// Responsabilidades:
✓ Detecta se PDF tem senha
✓ Extrai metadados (título, autor, páginas)
✓ Valida se é PDF válido
✓ Retorna informações detalhadas

// Interface de retorno:
interface PdfValidationResult {
  isValid: boolean;
  isEncrypted: boolean;
  requiresPassword: boolean;
  pageCount?: number;
  fileSize?: number;
  metadata?: { title, author, subject, keywords };
  error?: string;
}

// Métodos principais:
- validatePdf(file): Valida e extrai informações
- validatePdfFromUrl(url): Valida de URL
- getPdfInfo(arrayBuffer): Extrai metadados
```

**Usando:** PDF.js para detectar encriptação e extrair metadados

---

### 3. **ImageCompressionService** (`image-compression.service.ts`) - 🗜️ Compressor

```typescript
// Responsabilidades:
✓ Comprime imagens JPG/PNG
✓ Mantém qualidade visual
✓ Calcula economia de espaço
✓ Processa múltiplas imagens em paralelo

// Interface de retorno:
interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressedFile: File;
}

// Métodos principais:
- compressImage(file, options?): Comprime uma imagem
- compressMultipleImages(files, options?): Comprime várias
- processFileArray(files): Comprime apenas imagens, PDFs intactos
- isImageFile(file): Verifica se é imagem

// Configuração padrão:
{
  maxSizeMB: 1,
  maxWidthOrHeight: 2000,
  useWebWorker: true
}
```

**Usando:** browser-image-compression (100% no browser, sem servidor)

---

### 4. **PdfMergerService** (`pdf-merger-simple.service.ts`) - 🔗 Unificador

```typescript
// Responsabilidades:
✓ Unifica PDFs em um único arquivo
✓ Incorpora imagens em páginas
✓ Calcula escala de imagens automaticamente
✓ SEM validações (apenas merge)

// Métodos principais:
- mergeFilesToPdf(files): Unifica múltiplos arquivos

// Workflow interno:
1. Cria novo documento PDF
2. Para cada arquivo:
   - Se PDF: copia páginas
   - Se imagem: cria página e incorpora imagem
3. Retorna Uint8Array comprimido
```

**Usando:** pdf-lib (manipulação de PDFs no browser)

---

### 5. **PdfVisualizationService** (`pdf-visualization.service.ts`) - 👁️ Visualizador

```typescript
// Responsabilidades:
✓ Gerencia estado do modal de preview
✓ Controla abertura/fechamento
✓ Detecção de PDF protegido
✓ Libera memória (revoga URLs)

// Signals (Reactive):
- isPreviewOpenSignal: boolean (read-only)
- previewContentSignal: PdfPreviewContent | null (read-only)
- isPasswordProtectedSignal: boolean (read-only)

// Métodos principais:
- openPreview(file, isProtectedByPassword): Abre modal
- closePreview(): Fecha modal
- isOpen(): Verifica se está aberto
```

**Por que signals?**

- Reatividade automática
- Sem subscribers manuais
- Performance otimizada
- Sintaxe simples

---

## 🔄 Fluxo de Dados

### Cenário: Usuário seleciona arquivos e faz merge

```
1️⃣ COMPONENTE
   └─> files.set([file1, file2, file3])

2️⃣ MERGE CLICK
   └─> pdfManager.validateAndPrepareFiles(files)
       │
       ├─> Para cada PDF:
       │   └─> pdfValidation.validatePdf()
       │       ├─ Detecta: válido? ✓
       │       ├─ Detecta: tem senha? ❌
       │       └─ Extrai: 5 páginas, 2.1MB
       │
       ├─> Para cada IMAGEM:
       │   └─> imageCompression.compressImage()
       │       ├─ Original: 3.5MB
       │       └─ Comprimido: 850KB (↓ 76%)
       │
       ├─> Valida tamanho total < 7MB ✓
       │
       └─> Retorna: { files: [...], validations: [...] }

3️⃣ MERGE EXECUTION
   └─> pdfManager.mergeFiles(preparedFiles)
       └─> pdfMerger.mergeFilesToPdf(files)
           ├─ Cria novo PDF
           ├─ Copia 5 páginas do PDF1
           ├─ Incorpora imagem comprimida
           ├─ Copia 3 páginas do PDF2
           └─ Retorna Uint8Array

4️⃣ DOWNLOAD
   └─> Cria Blob
   └─> Baixa documento_unificado.pdf
```

---

## 🎨 Componentes

### PdfImageViewerComponent

```typescript
// Responsabilidades:
- Selecionar arquivos
- Remover arquivo da lista
- Exibir lista de arquivos
- Trigger de merge

// Integração:
this.pdfManager.validateAndPrepareFiles()
this.pdfManager.mergeFiles()
this.pdfManager.openPreview()
```

### PreviewModalComponent

```typescript
// Responsabilidades:
- Exibir modal com animações
- Mostrar indicador de senha 🔒
- Bloquear visualização de PDFs protegidos
- Fechar modal

// Reactive (Signals):
- Acompanha isPreviewOpenSignal
- Acompanha isPasswordProtectedSignal
- Acompanha previewContentSignal
```

---

## 🔐 Validação de Senha - Como funciona?

```
Usuário seleciona PDF
    │
    ▼
PdfManager.validateAndPrepareFiles()
    │
    ├─> PdfValidationService.validatePdf()
    │   │
    │   ├─> PDF.js tenta carregar arquivo
    │   │
    │   ├─ Sucesso? ✓
    │   │   └─> isEncrypted = false
    │   │       requiresPassword = false
    │   │
    │   └─ Erro "password" detectado? ❌
    │       └─> isEncrypted = true
    │           requiresPassword = true
    │           ❌ Lança erro: "PDF protegido"
    │
    └─> UI avisa usuário: "Remove a senha antes"
```

---

## 📊 Validação de Tamanho

```
Arquivos selecionados:
  - pdf1.pdf: 2.1 MB
  - imagem1.jpg: 3.5 MB (será comprimida para 850KB)
  - pdf2.pdf: 1.8 MB
  ─────────────────────
  Total ANTES: 7.4 MB ❌ Exceeds 7MB

Após compressão:
  - pdf1.pdf: 2.1 MB (intacto)
  - imagem1.jpg: 0.85 MB (comprimida)
  - pdf2.pdf: 1.8 MB (intacto)
  ─────────────────────
  Total DEPOIS: 4.75 MB ✓ Válido!
```

---

## 🚀 Benefícios da Arquitetura

| Aspecto              | Benefício                                 |
| -------------------- | ----------------------------------------- |
| **Separação**        | Cada serviço faz UMA coisa bem            |
| **Testabilidade**    | Fácil testar cada serviço isolado         |
| **Reusabilidade**    | Serviços usáveis em qualquer componente   |
| **Manutenibilidade** | Mudanças isoladas, sem efeitos colaterais |
| **Escalabilidade**   | Fácil adicionar novos recursos            |
| **Performance**      | Compressão automática, otimizações claras |
| **UX**               | Validação clara, mensagens úteis          |

---

## 🔧 Como Adicionar Novos Recursos

### Exemplo: Suportar ODT (LibreOffice)

```typescript
// 1. Estender PdfValidationService
async validateOdt(file: File) {
  // Validação específica de ODT
}

// 2. Estender PdfMergerService
private async mergeOdtFile() {
  // Converter ODT para PDF e mergear
}

// 3. Atualizar PdfManager
async validateAndPrepareFiles(files) {
  // Adicionar case para ODT
  if (file.type === 'application/vnd.oasis.opendocument.text') {
    // Processar ODT
  }
}
```

### Exemplo: Adicionar Marca d'água

```typescript
// 1. Novo serviço: PdfWatermarkService
async addWatermark(pdf: Uint8Array, text: string) {
  // Adicionar texto ao PDF
}

// 2. Integrar ao PdfManager
async mergeFilesWithWatermark(files, watermarkText) {
  const merged = await this.mergeFiles(files);
  return await this.pdfWatermark.addWatermark(merged, watermarkText);
}
```

---

## 📈 Futuras Melhorias

- [ ] Suporte a OCR (extrair texto de imagens)
- [ ] Marca d'água automática
- [ ] Assinatura digital
- [ ] Compressão de PDFs (não apenas imagens)
- [ ] Reordenação de páginas
- [ ] Extração de páginas específicas
- [ ] Conversão de formatos (ODT, DOCX → PDF)
- [ ] Preview com anotações
- [ ] Cache de compressão para mesmos arquivos

---

## 📝 Summary

```
┌─────────────────────────────────────────────────────────┐
│ COMPONENTE                                              │
│  ↓                                                      │
│ PdfManager (Orquestrador)                              │
│  ├─ Valida (PdfValidationService)                      │
│  ├─ Comprime (ImageCompressionService)                 │
│  ├─ Unifica (PdfMergerService)                         │
│  ├─ Visualiza (PdfVisualizationService)                │
│  └─ Retorna resultado                                  │
│  ↓                                                      │
│ DOWNLOAD / PREVIEW                                     │
└─────────────────────────────────────────────────────────┘
```

**Princípio:** Cada serviço faz UMA coisa bem, PdfManager coordena.
