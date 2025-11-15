#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const { PDFDocument, rgb } = require('pdf-lib');

const examplesDir = path.join(__dirname, '../public/examples');
if (!fs.existsSync(examplesDir)) {
  fs.mkdirSync(examplesDir, { recursive: true });
}

// Criar imagens grandes JPEG
console.log('📸 Criando imagens de teste...');

// Imagem 1: Gradiente azul-amarelo (2000x1500)
const canvas1 = createCanvas(2000, 1500);
const ctx1 = canvas1.getContext('2d');
const gradient1 = ctx1.createLinearGradient(0, 0, 2000, 1500);
gradient1.addColorStop(0, '#0000FF');
gradient1.addColorStop(1, '#FFFF00');
ctx1.fillStyle = gradient1;
ctx1.fillRect(0, 0, 2000, 1500);
ctx1.font = 'bold 100px Arial';
ctx1.fillStyle = '#FFFFFF';
ctx1.strokeStyle = '#000000';
ctx1.lineWidth = 3;
ctx1.textAlign = 'center';
ctx1.strokeText('Large Image 1', 1000, 750);
ctx1.fillText('Large Image 1', 1000, 750);
fs.writeFileSync(path.join(examplesDir, 'large-image-1.jpg'), canvas1.toBuffer('image/jpeg', { quality: 0.85 }));
console.log('✅ large-image-1.jpg criado (2000x1500)');

// Imagem 2: Padrão colorido (3000x2000)
const canvas2 = createCanvas(3000, 2000);
const ctx2 = canvas2.getContext('2d');
for (let i = 0; i < 3000; i += 100) {
  for (let j = 0; j < 2000; j += 100) {
    const hue = ((i + j) / 5000) * 360;
    ctx2.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx2.fillRect(i, j, 100, 100);
  }
}
ctx2.font = 'bold 120px Arial';
ctx2.fillStyle = '#FFFFFF';
ctx2.strokeStyle = '#000000';
ctx2.lineWidth = 4;
ctx2.textAlign = 'center';
ctx2.strokeText('Large Image 2 - 3000x2000', 1500, 1000);
ctx2.fillText('Large Image 2 - 3000x2000', 1500, 1000);
fs.writeFileSync(path.join(examplesDir, 'large-image-2.jpg'), canvas2.toBuffer('image/jpeg', { quality: 0.80 }));
console.log('✅ large-image-2.jpg criado (3000x2000)');

// Imagem 3: Médio (1920x1080)
const canvas3 = createCanvas(1920, 1080);
const ctx3 = canvas3.getContext('2d');
ctx3.fillStyle = '#E8F5E9';
ctx3.fillRect(0, 0, 1920, 1080);
ctx3.fillStyle = '#FF5722';
ctx3.fillRect(0, 0, 1920, 300);
ctx3.fillStyle = '#FFFFFF';
ctx3.font = 'bold 80px Arial';
ctx3.textAlign = 'center';
ctx3.fillText('Medium Image - 1920x1080', 960, 150);
ctx3.fillStyle = '#333333';
ctx3.font = '40px Arial';
ctx3.fillText('Perfect for presentations', 960, 550);
fs.writeFileSync(path.join(examplesDir, 'medium-image.jpg'), canvas3.toBuffer('image/jpeg', { quality: 0.90 }));
console.log('✅ medium-image.jpg criado (1920x1080)');

// Criar PDFs de teste
console.log('\n📄 Criando PDFs de teste...');

async function createTestPdfs() {
  // PDF 1: Simples com texto
  const pdf1 = await PDFDocument.create();
  const page1 = pdf1.addPage([595, 842]);
  page1.drawText('Document 1 - Simple PDF', {
    x: 50,
    y: 750,
    size: 24,
    color: rgb(0, 0, 0),
  });
  page1.drawText('This is a test PDF for merging', {
    x: 50,
    y: 700,
    size: 14,
    color: rgb(0.5, 0.5, 0.5),
  });
  page1.drawText('Created: ' + new Date().toLocaleString(), {
    x: 50,
    y: 650,
    size: 12,
    color: rgb(0.7, 0.7, 0.7),
  });
  const pdf1Bytes = await pdf1.save();
  fs.writeFileSync(path.join(examplesDir, 'document-1.pdf'), pdf1Bytes);
  console.log('✅ document-1.pdf criado');

  // PDF 2: Multi-página
  const pdf2 = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) {
    const page = pdf2.addPage([595, 842]);
    page.drawText(`Page ${i} - Multi-page Document`, {
      x: 50,
      y: 750,
      size: 24,
      color: rgb(0, 0.5, 1),
    });
    page.drawText(`This is page ${i} of a 3-page document`, {
      x: 50,
      y: 700,
      size: 14,
      color: rgb(0, 0, 0),
    });
    page.drawText('Lorem ipsum dolor sit amet, consectetur adipiscing elit.', {
      x: 50,
      y: 650,
      size: 12,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  const pdf2Bytes = await pdf2.save();
  fs.writeFileSync(path.join(examplesDir, 'document-2.pdf'), pdf2Bytes);
  console.log('✅ document-2.pdf criado (3 páginas)');

  // PDF 3: Com mais conteúdo
  const pdf3 = await PDFDocument.create();
  const page3 = pdf3.addPage([595, 842]);
  page3.drawText('Document 3 - Report', {
    x: 50,
    y: 750,
    size: 24,
    color: rgb(1, 0, 0),
  });
  const lines = [
    'Section 1: Introduction',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    '',
    'Section 2: Main Content',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    '',
    'Section 3: Conclusion',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
  ];
  let y = 700;
  for (const line of lines) {
    page3.drawText(line, {
      x: 50,
      y: y,
      size: 12,
      color: rgb(0, 0, 0),
    });
    y -= 30;
  }
  const pdf3Bytes = await pdf3.save();
  fs.writeFileSync(path.join(examplesDir, 'document-3.pdf'), pdf3Bytes);
  console.log('✅ document-3.pdf criado');

  console.log('\n✨ Todos os exemplos foram criados com sucesso!');
  console.log(`📂 Localização: ${examplesDir}`);
  console.log('\n📋 Arquivos criados:');
  fs.readdirSync(examplesDir).forEach(file => {
    const stats = fs.statSync(path.join(examplesDir, file));
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   - ${file} (${sizeMB} MB)`);
  });
}

createTestPdfs().catch(console.error);
