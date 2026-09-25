// Text extraction for documents attached to GH-GPT chats, so any AI model
// (including free text-only ones) can answer questions about them.
// Supported: PDF, Word (.docx), Excel (.xlsx), CSV/TSV, PowerPoint (.pptx),
// and plain text / Markdown / JSON / code files.
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const mammoth = require('mammoth');
// Require the library file directly: pdf-parse's index.js runs a self-test
// that reads a sample PDF from disk when it isn't the main module.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const { BadRequestError } = require('../errors');

const MAX_CHARS = 60000; // per file, stored and sent to the AI
const MAX_ROWS_PER_SHEET = 500;

const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.json', '.xml', '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx',
    '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rb', '.php', '.rs', '.kt', '.swift', '.sql',
    '.sh', '.bat', '.ps1', '.yml', '.yaml', '.toml', '.ini', '.log', '.env.example', '.rtf',
]);

const kindOf = (name, mime = '') => {
    const ext = path.extname(name || '').toLowerCase();
    if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
    if (ext === '.docx') return 'docx';
    if (ext === '.xlsx' || ext === '.xlsm') return 'xlsx';
    if (ext === '.csv' || ext === '.tsv') return 'csv';
    if (ext === '.pptx') return 'pptx';
    if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/')) return 'text';
    return null;
};

const clean = (text) => String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

async function excelToText(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const parts = [];
    workbook.eachSheet((sheet) => {
        const rows = [];
        sheet.eachRow({ includeEmpty: false }, (row, n) => {
            if (n > MAX_ROWS_PER_SHEET) return;
            const values = row.values.slice(1).map((v) => {
                if (v == null) return '';
                if (typeof v === 'object') return v.result ?? v.text ?? (v.richText ? v.richText.map((r) => r.text).join('') : v.hyperlink || JSON.stringify(v));
                return v;
            });
            rows.push(values.join(' | '));
        });
        const more = sheet.rowCount > MAX_ROWS_PER_SHEET ? `\n… (${sheet.rowCount - MAX_ROWS_PER_SHEET} more rows not shown)` : '';
        parts.push(`## Sheet: ${sheet.name}\n${rows.join('\n')}${more}`);
    });
    return parts.join('\n\n');
}

async function pptxToText(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const out = [];
    for (const [i, file] of slides.entries()) {
        const xml = await zip.files[file].async('string');
        const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ');
        out.push(`## Slide ${i + 1}\n${text}`);
    }
    return out.join('\n\n');
}

/**
 * Extracts readable text from an uploaded file.
 * Resolves to { text, kind, truncated, pages? }. Throws BadRequestError for
 * unsupported or unreadable files.
 */
async function extractText(buffer, name, mime) {
    const kind = kindOf(name, mime);
    if (!kind) {
        throw new BadRequestError('Unsupported file type. Attach a PDF, Word (.docx), Excel (.xlsx), CSV, PowerPoint (.pptx) or text/code file.');
    }
    let text = '';
    let pages;
    try {
        if (kind === 'pdf') {
            const data = await pdfParse(buffer);
            text = data.text;
            pages = data.numpages;
        } else if (kind === 'docx') {
            text = (await mammoth.extractRawText({ buffer })).value;
        } else if (kind === 'xlsx') {
            text = await excelToText(buffer);
        } else if (kind === 'pptx') {
            text = await pptxToText(buffer);
        } else {
            text = buffer.toString('utf8');
        }
    } catch (err) {
        console.error('GH-GPT file extraction failed:', err.message);
        throw new BadRequestError(`Couldn't read "${name}". The file may be damaged or password-protected.`);
    }
    text = clean(text);
    if (!text) {
        throw new BadRequestError(kind === 'pdf'
            ? `"${name}" has no readable text (it may be a scanned image). Try attaching it as a picture instead.`
            : `"${name}" appears to be empty.`);
    }
    const truncated = text.length > MAX_CHARS;
    return { text: truncated ? `${text.slice(0, MAX_CHARS)}\n… (document truncated)` : text, kind, truncated, pages };
}

module.exports = { extractText, kindOf, MAX_CHARS };
