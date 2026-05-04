import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const input = 'docs/SkyCareerV1_Manual_EN.md';
const output = 'docs/SkyCareerV1_Manual_EN.pdf';
const logoPath = 'public/skycareer-logo-clean.png';

const text = fs.readFileSync(input, 'utf8');
const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const margin = 44;
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const contentWidth = pageWidth - margin * 2;

function addFooter() {
  const p = doc.getCurrentPageInfo().pageNumber;
  const total = doc.getNumberOfPages();
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`SkyCareerV1 Manual (EN) · Page ${p}/${total}`, margin, pageHeight - 20);
  doc.setTextColor(20);
}

function ensureSpace(h) {
  if (cursorY + h > pageHeight - 40) {
    addFooter();
    doc.addPage();
    cursorY = margin;
  }
}

function addHeading(txt, size = 16) {
  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.text(txt, margin, cursorY);
  cursorY += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
}

function addParagraph(txt) {
  const lines = doc.splitTextToSize(txt, contentWidth);
  const h = lines.length * 14 + 8;
  ensureSpace(h);
  doc.text(lines, margin, cursorY);
  cursorY += h;
}

let cursorY = margin;

// Cover with logo
if (fs.existsSync(logoPath)) {
  const ext = path.extname(logoPath).toLowerCase() === '.png' ? 'PNG' : 'JPEG';
  const imgData = fs.readFileSync(logoPath).toString('base64');
  const dataUrl = `data:image/${ext.toLowerCase()};base64,${imgData}`;
  doc.setFillColor(245, 248, 252);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.addImage(dataUrl, ext, margin, 90, 220, 90);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('SkyCareerV1 Manual', margin, 240);
  doc.setFontSize(17);
  doc.text('English · Simple · Extended', margin, 272);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Generated automatically from docs/SkyCareerV1_Manual_EN.md', margin, 320);
  addFooter();
  doc.addPage();
}

cursorY = margin;
addHeading('Figure 1: SkyCareerV1 System Architecture', 18);

// Diagram 1
ensureSpace(250);
const x = margin;
const y = cursorY;
const w = contentWidth;
const boxW = 150;
const boxH = 50;
const gap = 22;

const boxes = [
  ['Pilot / User', x, y],
  ['React Frontend', x + boxW + gap, y],
  ['Base44 API', x + (boxW + gap) * 2, y],
  ['Simulator Bridge', x + 70, y + 95],
  ['Scoring & Analytics', x + 70 + boxW + gap, y + 95],
];

for (const [label, bx, by] of boxes) {
  doc.setDrawColor(60, 90, 140);
  doc.setFillColor(235, 243, 255);
  doc.roundedRect(bx, by, boxW, boxH, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, bx + 12, by + 28);
}

doc.setDrawColor(70);
doc.line(x + boxW, y + 25, x + boxW + gap, y + 25);
doc.line(x + boxW*2 + gap, y + 25, x + boxW*2 + gap*2, y + 25);
doc.line(x + boxW + gap + 20, y + boxH, x + boxW + gap + 20, y + 95);
doc.line(x + boxW*2 + gap + 20, y + boxH, x + boxW*2 + gap + 20, y + 95);

cursorY += 270;
addParagraph('This architecture diagram shows the basic data and control flow between users, frontend UI, backend entities, simulator bridge tools, and analytics modules.');

addHeading('Figure 2: Player Progress Loop', 18);
ensureSpace(190);
const ly = cursorY;
const steps = ['Contracts', 'Flights', 'Landing Score', 'Payout + Reputation', 'Fleet Growth'];
let lx = margin;
for (let i = 0; i < steps.length; i++) {
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(lx, ly, 98, 40, 6, 6, 'FD');
  doc.setFontSize(9);
  doc.text(steps[i], lx + 10, ly + 23);
  if (i < steps.length - 1) doc.line(lx + 98, ly + 20, lx + 116, ly + 20);
  lx += 116;
}
cursorY += 70;
addParagraph('Improvement in SkyCareerV1 is cyclical: better operations improve your money and reputation, which unlocks better contracts and stronger aircraft opportunities.');

// Content pages from markdown
const lines = text.split('\n');
for (const raw of lines) {
  if (raw.startsWith('# ')) addHeading(raw.replace('# ', ''), 20);
  else if (raw.startsWith('## ')) addHeading(raw.replace('## ', ''), 15);
  else if (raw.trim() === '---') { ensureSpace(16); doc.setDrawColor(180); doc.line(margin, cursorY, pageWidth - margin, cursorY); cursorY += 12; }
  else addParagraph(raw.length ? raw : ' ');
}

addFooter();
const total = doc.getNumberOfPages();
for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(); }

doc.save(output);
console.log(`PDF created: ${output} (${total} pages)`);
