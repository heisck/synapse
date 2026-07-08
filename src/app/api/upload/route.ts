import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Slide } from '@prisma/client';

const ALLOWED_EXTENSIONS = ['.pdf', '.pptx', '.docx', '.odp', '.odt', '.txt', '.md', '.markdown', '.csv', '.rtf', '.html', '.htm'];
const LEGACY_EXTENSIONS = ['.ppt', '.doc'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface ParsedSlide {
  title: string;
  content: string;
}

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/** Groups free text into slide-sized chunks. */
function splitIntoSlides(text: string, filename: string): ParsedSlide[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const baseName = filename.replace(/\.[^.]+$/, '');

  if (paragraphs.length === 0) {
    const trimmed = text.trim();
    return trimmed ? [{ title: `${baseName} - Content`, content: trimmed }] : [];
  }

  const slides: ParsedSlide[] = [];
  const CHUNK_SIZE = 4;
  for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
    const chunk = paragraphs.slice(i, i + CHUNK_SIZE);
    const firstLine = chunk[0].split('\n')[0].trim();
    const title = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
    slides.push({
      title: title || `${baseName} - Slide ${Math.floor(i / CHUNK_SIZE) + 1}`,
      content: chunk.join('\n\n').trim(),
    });
  }
  return slides;
}

/** PDF: one slide per page via unpdf (serverless-friendly pdf.js build). */
async function extractPdfSlides(buffer: ArrayBuffer, filename: string): Promise<ParsedSlide[]> {
  const { extractText } = await import('unpdf');
  const { text: pages } = await extractText(new Uint8Array(buffer), { mergePages: false });
  const baseName = filename.replace(/\.[^.]+$/, '');

  const slides: ParsedSlide[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pageText = (pages[i] || '').replace(/\s+\n/g, '\n').trim();
    if (!pageText) continue;
    const firstLine = pageText.split('\n')[0].trim();
    slides.push({
      title: firstLine && firstLine.length <= 90 ? firstLine : `${baseName} — Page ${i + 1}`,
      content: pageText,
    });
  }
  // Dense single-page PDFs read better re-chunked
  if (slides.length === 1 && slides[0].content.length > 4000) {
    return splitIntoSlides(slides[0].content, filename);
  }
  return slides;
}

/** PPTX: ZIP of XML — one slide per ppt/slides/slideN.xml. */
async function extractPptxSlides(buffer: ArrayBuffer, filename: string): Promise<ParsedSlide[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return numA - numB;
    });

  const baseName = filename.replace(/\.[^.]+$/, '');
  const slides: ParsedSlide[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const textRuns = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g))
      .map((m) => decodeXmlEntities(m[1]))
      .filter((t) => t.trim().length > 0);
    if (textRuns.length === 0) continue;
    slides.push({
      title: textRuns[0].trim() || `${baseName} - Slide ${i + 1}`,
      content: textRuns.slice(1).join('\n').trim() || textRuns[0].trim(),
    });
  }
  return slides;
}

/** DOCX via mammoth. */
async function extractDocxSlides(buffer: ArrayBuffer, filename: string): Promise<ParsedSlide[]> {
  const mammoth = await import('mammoth');
  const result = await mammoth.default.extractRawText({ buffer: Buffer.from(buffer) });
  return splitIntoSlides(result.value, filename);
}

/** ODP (presentation): ZIP with content.xml — one slide per <draw:page>. */
async function extractOdpSlides(buffer: ArrayBuffer, filename: string): Promise<ParsedSlide[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.files['content.xml'];
  if (!contentFile) return [];
  const xml = await contentFile.async('text');
  const baseName = filename.replace(/\.[^.]+$/, '');

  const pages = Array.from(xml.matchAll(/<draw:page[^>]*>([\s\S]*?)<\/draw:page>/g));
  const extractParagraphs = (chunk: string) =>
    Array.from(chunk.matchAll(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g))
      .map((m) => decodeXmlEntities(m[1].replace(/<[^>]+>/g, '')))
      .map((t) => t.trim())
      .filter(Boolean);

  if (pages.length === 0) {
    // ODT (document): flat paragraphs
    const paras = extractParagraphs(xml);
    return splitIntoSlides(paras.join('\n\n'), filename);
  }

  const slides: ParsedSlide[] = [];
  pages.forEach((page, i) => {
    const paras = extractParagraphs(page[1]);
    if (paras.length === 0) return;
    slides.push({
      title: paras[0] || `${baseName} - Slide ${i + 1}`,
      content: paras.slice(1).join('\n') || paras[0],
    });
  });
  return slides;
}

/** RTF: strip control words and groups down to plain text. */
function extractRtfText(buffer: ArrayBuffer): string {
  const raw = new TextDecoder('latin1').decode(buffer);
  return raw
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-f]{2}/g, ' ')
    .replace(/\\[a-z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** HTML: strip tags/scripts to readable text. */
function extractHtmlText(buffer: ArrayBuffer): string {
  const raw = new TextDecoder().decode(buffer);
  return decodeXmlEntities(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(p|div|br|li|h[1-6]|tr)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' '),
  ).trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please upload a file.' },
        { status: 400 },
      );
    }

    const ext = getFileExtension(file.name);

    if (LEGACY_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Legacy ${ext} files use an old binary format. Please re-save the file as ${ext === '.ppt' ? '.pptx' : '.docx'} and upload again.` },
        { status: 422 },
      );
    }

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Supported: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const filename = file.name;

    // Extract real content per format — no fake placeholder slides, ever
    let slides: ParsedSlide[] = [];
    try {
      switch (ext) {
        case '.pdf':
          slides = await extractPdfSlides(buffer, filename);
          break;
        case '.pptx':
          slides = await extractPptxSlides(buffer, filename);
          break;
        case '.docx':
          slides = await extractDocxSlides(buffer, filename);
          break;
        case '.odp':
        case '.odt':
          slides = await extractOdpSlides(buffer, filename);
          break;
        case '.rtf':
          slides = splitIntoSlides(extractRtfText(buffer), filename);
          break;
        case '.html':
        case '.htm':
          slides = splitIntoSlides(extractHtmlText(buffer), filename);
          break;
        default: // .txt, .md, .markdown, .csv
          slides = splitIntoSlides(new TextDecoder().decode(buffer), filename);
          break;
      }
    } catch (parseErr) {
      console.error(`[/api/upload] ${ext} parse error:`, parseErr);
      return NextResponse.json(
        { error: `Could not read this ${ext} file — it may be corrupted or password-protected.` },
        { status: 422 },
      );
    }

    if (slides.length === 0) {
      return NextResponse.json(
        { error: 'No readable text found in this file. If it is a scanned document or image-only deck, try a text-based export.' },
        { status: 422 },
      );
    }

    // Create course in database
    const course = await db.course.create({
      data: {
        title: filename.replace(/\.[^.]+$/, ''),
        description: `Uploaded from ${filename}`,
        subject: '',
      },
    });

    // Create slide records
    const createdSlides: Slide[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = await db.slide.create({
        data: {
          courseId: course.id,
          title: slides[i].title.slice(0, 300),
          content: slides[i].content,
          order: i + 1,
        },
      });
      createdSlides.push(slide);
    }

    return NextResponse.json({
      success: true,
      courseId: course.id,
      course,
      slideCount: createdSlides.length,
      slides: createdSlides,
    });
  } catch (error) {
    console.error('[/api/upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process uploaded file. Please try again.' },
      { status: 500 },
    );
  }
}
