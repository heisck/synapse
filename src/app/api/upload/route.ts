import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { LLM, authFromRequest, type LLMAuth } from '@/lib/ai';
import { normalizeDocument } from '@/lib/document/normalizer';
import type { Slide } from '@prisma/client';

const ALLOWED_EXTENSIONS = ['.pdf', '.pptx', '.docx', '.odp', '.odt', '.txt', '.md', '.markdown', '.csv', '.rtf', '.html', '.htm', '.epub', '.png', '.jpg', '.jpeg', '.webp'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
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

/** EPUB: ZIP of XHTML chapters — read the OPF spine order, one slide per chapter. */
async function extractEpubSlides(buffer: ArrayBuffer, filename: string): Promise<ParsedSlide[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // container.xml → OPF path → manifest + spine
  const container = await zip.files['META-INF/container.xml']?.async('text');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath ? await zip.files[opfPath]?.async('text') : undefined;
  const baseDir = opfPath?.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  let chapterPaths: string[] = [];
  if (opf) {
    const manifest = new Map(
      Array.from(opf.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*\/>/g)).map((m) => [m[1], m[2]]),
    );
    chapterPaths = Array.from(opf.matchAll(/<itemref[^>]*idref="([^"]+)"/g))
      .map((m) => manifest.get(m[1]))
      .filter((href): href is string => !!href && /\.x?html?$/i.test(href))
      .map((href) => baseDir + href);
  }
  if (chapterPaths.length === 0) {
    chapterPaths = Object.keys(zip.files).filter((n) => /\.x?html?$/i.test(n)).sort();
  }

  const slides: ParsedSlide[] = [];
  for (const path of chapterPaths) {
    const html = await zip.files[path]?.async('text');
    if (!html) continue;
    const text = extractHtmlText(new TextEncoder().encode(html).buffer as ArrayBuffer);
    if (!text.trim()) continue;
    const titleMatch = html.match(/<(?:h1|h2|title)[^>]*>([\s\S]*?)<\/(?:h1|h2|title)>/i);
    const title = titleMatch ? decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
    // Long chapters read better re-chunked
    if (text.length > 4000) {
      slides.push(...splitIntoSlides(text, filename).map((s, i) => (i === 0 && title ? { ...s, title } : s)));
    } else {
      slides.push({ title: title || text.split('\n')[0].slice(0, 80), content: text });
    }
  }
  return slides;
}

/**
 * Images / scans (task 28, C5/C6): no selectable text exists, so the vision
 * rotation transcribes the page — text first, then a plain description of any
 * diagrams/figures, and formulas as LaTeX (task 29 hook). Runs only for image
 * uploads (the "orchestrator decides OCR is needed" case) and needs the
 * learner's own key.
 */
async function extractImageSlides(
  buffer: ArrayBuffer,
  filename: string,
  mime: string,
  auth: LLMAuth,
): Promise<{ slides: ParsedSlide[]; error?: string }> {
  if (!auth.apiKey) {
    return { slides: [], error: 'Reading images needs your OpenRouter API key (Settings → AI Access) so a vision model can transcribe them.' };
  }
  const dataUrl = `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
  const text = await LLM.vision({
    prompt:
      'Transcribe this study material image for a learner. Output, in order: (1) ALL readable text, preserving headings and bullet structure; (2) for each diagram/chart/figure, one short paragraph starting "Diagram:" describing what it shows and what it means; (3) any mathematical formulas as LaTeX on their own lines. Output only the transcription, no commentary.',
    images: [{ dataUrl }],
    auth,
  });
  if (!text || !text.trim()) {
    return { slides: [], error: 'The vision model could not read this image. Try a clearer scan or a text-based export.' };
  }
  return { slides: splitIntoSlides(text, filename) };
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
      if (IMAGE_EXTENSIONS.includes(ext)) {
        const result = await extractImageSlides(buffer, filename, file.type || 'image/png', authFromRequest(request));
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 422 });
        }
        slides = result.slides;
      } else switch (ext) {
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
        case '.epub':
          slides = await extractEpubSlides(buffer, filename);
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

    // Local-first mode (ROADMAP Phase 2): parse only — the browser stores the
    // course in the learner's IndexedDB and nothing touches the shared DB.
    if (formData.get('persist') === '0') {
      const now = new Date().toISOString();
      const localCourseId = `local-${crypto.randomUUID()}`;
      const localCourse = {
        id: localCourseId,
        title: filename.replace(/\.[^.]+$/, ''),
        description: `Uploaded from ${filename}`,
        subject: '',
        thumbnail: null,
        createdAt: now,
        updatedAt: now,
      };
      const localSlides = slides.map((s, i) => ({
        id: `local-slide-${crypto.randomUUID()}`,
        courseId: localCourseId,
        title: s.title.slice(0, 300),
        content: s.content,
        order: i + 1,
        createdAt: now,
      }));
      // Structured document (tasks 25/26): classified pages, stable block IDs,
      // compact sequence. Returned to the browser, stored ONLY user-side (R1).
      const structuredDoc = normalizeDocument(slides, filename);
      return NextResponse.json({
        success: true,
        local: true,
        courseId: localCourseId,
        course: localCourse,
        slideCount: localSlides.length,
        slides: localSlides,
        structuredDoc,
      });
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
