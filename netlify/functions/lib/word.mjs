// Genera el Word "TAX INVOICE" con el mismo diseño de la plantilla original.
// Los datos personales vienen de variables de entorno (el repositorio es público).
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, ExternalHyperlink, VerticalAlign, LineRuleType,
} from 'docx';
import { config } from './config.mjs';
import { auDate } from './dates.mjs';

const FONT = 'Arial';
const GREY = '808080';
const LINE = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

export const PROFILE_VARS = {
  businessName: 'INVOICE_BUSINESS_NAME',
  abn: 'INVOICE_ABN',
  fullName: 'INVOICE_FULL_NAME',
  address: 'INVOICE_ADDRESS',
  phone: 'INVOICE_PHONE',
  email: 'INVOICE_EMAIL',
  bankAccountName: 'BANK_ACCOUNT_NAME',
  bsb: 'BANK_BSB',
  accountNumber: 'BANK_ACCOUNT_NUMBER',
};
const OPTIONAL = new Set(['businessName']);

export function profile() {
  return Object.fromEntries(Object.entries(PROFILE_VARS).map(([k, env]) => [k, process.env[env] || '']));
}
export function missingProfileVars() {
  const p = profile();
  return Object.entries(PROFILE_VARS).filter(([k]) => !OPTIONAL.has(k) && !p[k]).map(([, env]) => env);
}

export function amountText(n) {
  return `$ ${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} AUD`;
}

const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: opts.size || 22, bold: opts.bold, color: opts.color });
const para = (children, opts = {}) => new Paragraph({ children: [].concat(children), alignment: opts.align, spacing: { after: 0, line: 276, lineRule: LineRuleType.AUTO, ...opts.spacing } });
const label = (l, v, boldValue = true) => para([run(l, { bold: true }), run(v, { bold: boldValue })]);
const blank = () => para(run(''));

export async function buildWord(draft) {
  const p = profile();

  const left = [
    label('Business Name: ', p.businessName),
    blank(),
    label('ABN / ACN: ', p.abn),
    blank(),
    label('Full Name: ', p.fullName),
    label('Address: ', p.address),
    label('Phone: ', p.phone, false),
    label('Email: ', p.email),
  ];
  const right = [
    para(run('TAX INVOICE NO', { bold: true, size: 48 }), { align: AlignmentType.RIGHT }),
    para(run(String(draft.invoiceNumber), { bold: true, size: 48 }), { align: AlignmentType.RIGHT }),
    blank(),
    para([run('Date: ', { bold: true }), run(auDate(draft.invoiceDate))], { align: AlignmentType.CENTER }),
  ];

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({ children: [
      new TableCell({ children: left, width: { size: 50, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: right, width: { size: 50, type: WidthType.PERCENTAGE } }),
    ] })],
  });

  const billTo = [
    para(run('BILL TO:', { bold: true })),
    ...config.billTo.map((line) => {
      const m = line.match(/^(Website:\s*)(\S+)$/);
      if (!m) return para(run(line));
      return para([run(m[1]), new ExternalHyperlink({
        link: `https://${m[2].replace(/^https?:\/\//, '')}`,
        children: [new TextRun({ text: m[2], font: FONT, size: 22, style: 'Hyperlink', color: '1155CC', underline: {} })],
      })]);
    }),
  ];

  // Tabla Description / Amount
  const cellBorders = (vertical) => ({ top: LINE, bottom: LINE, left: NONE, right: vertical ? LINE : NONE });
  const greyCell = (text, pct) => new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: GREY, color: 'auto' },
    borders: { top: LINE, bottom: LINE, left: LINE, right: LINE },
    children: [para(run(text, { bold: true, color: 'FFFFFF' }), { align: AlignmentType.CENTER })],
  });
  const row = (desc, amount, { descBold, descAlign, amountAlign = AlignmentType.LEFT, divider = true } = {}) => new TableRow({ children: [
    new TableCell({
      width: { size: 78, type: WidthType.PERCENTAGE },
      borders: cellBorders(divider),
      margins: { left: 100, right: 100 },
      children: [para(run(desc, { bold: descBold }), { align: descAlign })],
    }),
    new TableCell({
      width: { size: 22, type: WidthType.PERCENTAGE },
      borders: cellBorders(false),
      margins: { left: 150, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [para(run(amount), { align: amountAlign })],
    }),
  ] });

  const amount = amountText(draft.totalAmount);
  const items = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({ tableHeader: true, children: [greyCell('Description', 78), greyCell('Amount', 22)] }),
      row(draft.description, amount),
      ...Array.from({ length: 8 }, () => row('', '')),
      row('GST (10%)', '', { descBold: true, descAlign: AlignmentType.RIGHT }),
      row('TOTAL', amount, { descBold: true, divider: false, amountAlign: AlignmentType.CENTER }),
    ],
  });

  const boxed = { top: LINE, bottom: LINE, left: LINE, right: LINE };
  const bank = new Table({
    width: { size: 96, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ children: [new TableCell({
        borders: boxed,
        shading: { type: ShadingType.CLEAR, fill: GREY, color: 'auto' },
        children: [para(run('Banking Details for Electronic Fund Transfer', { bold: true, color: 'FFFFFF' }), { align: AlignmentType.CENTER })],
      })] }),
      ...[['Account Name: ', p.bankAccountName], ['BSB Number: ', p.bsb], ['Account Number: ', p.accountNumber]].map(([l, v]) =>
        new TableRow({ children: [new TableCell({ borders: boxed, margins: { left: 100 }, children: [label(l, v)] })] })),
    ],
  });

  const doc = new Document({
    creator: config.name,
    title: `Tax Invoice ${draft.invoiceNumber}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } },
      children: [
        header,
        blank(), blank(), blank(),
        ...billTo,
        blank(), blank(), blank(),
        items,
        blank(),
        bank,
      ],
    }],
  });
  return Packer.toBuffer(doc);
}
