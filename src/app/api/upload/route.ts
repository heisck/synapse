import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ALLOWED_EXTENSIONS = ['.pptx', '.ppt', '.pdf', '.docx'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.default.extractRawText({ buffer });
  return result.value;
}

function splitIntoSlides(text: string, filename: string): Array<{ title: string; content: string }> {
  // Try splitting by double newlines (paragraphs) into chunks
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const slides: Array<{ title: string; content: string }> = [];
  const baseName = filename.replace(/\.[^.]+$/, '');

  if (paragraphs.length === 0) {
    return [{ title: `${baseName} - Content`, content: text.trim() || 'No extractable content.' }];
  }

  // Group paragraphs into slides (roughly 3-5 paragraphs per slide)
  const CHUNK_SIZE = 4;
  for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
    const chunk = paragraphs.slice(i, i + CHUNK_SIZE);
    const slideContent = chunk.join('\n\n').trim();
    const slideNum = Math.floor(i / CHUNK_SIZE) + 1;
    // Use first line of chunk as title, or generate one
    const firstLine = chunk[0].split('\n')[0].trim();
    const title = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
    slides.push({
      title: title || `${baseName} - Slide ${slideNum}`,
      content: slideContent,
    });
  }

  return slides.length > 0
    ? slides
    : [{ title: `${baseName} - Content`, content: text.trim() }];
}

function createMockSlides(filename: string): Array<{ title: string; content: string }> {
  const baseName = filename.replace(/\.[^.]+$/, '');
  const ext = getFileExtension(filename);
  return [
    {
      title: `${baseName} - Overview`,
      content: `Uploaded file: ${filename}\nFormat: ${ext}\n\nThis file was uploaded but could not be fully parsed. The content will be available once the file processor supports this format.`,
    },
  ];
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
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 },
      );
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const filename = file.name;

    // Extract slides based on format
    let slides: Array<{ title: string; content: string }>;

    if (ext === '.docx') {
      const text = await extractDocxText(buffer);
      slides = splitIntoSlides(text, filename);
    } else {
      slides = createMockSlides(filename);
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
    const createdSlides = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = await db.slide.create({
        data: {
          courseId: course.id,
          title: slides[i].title,
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