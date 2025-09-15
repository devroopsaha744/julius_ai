import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No resume file provided' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PDF, DOC, DOCX, or TXT files only.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Create temp directory for this session (using OS temp dir for automatic cleanup)
    const tempDir = join(tmpdir(), 'julius-ai-resumes', sessionId);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Generate safe filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'txt';
    const fileName = `resume_${sessionId}_${timestamp}.${fileExtension}`;
    const filePath = join(tempDir, fileName);

    // Convert file to buffer and save to temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    console.log(`📁 Resume saved to temp directory: ${filePath}`);

    // Return success response with file path (no Redis needed!)
    return NextResponse.json({
      success: true,
      message: 'Resume uploaded successfully to temp directory',
      filePath: filePath,
      fileName: fileName,
      sessionId: sessionId,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error uploading resume:', error);
    return NextResponse.json(
      { error: 'Internal server error during file upload' },
      { status: 500 }
    );
  }
}
