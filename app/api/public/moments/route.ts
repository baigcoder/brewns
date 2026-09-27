import { NextRequest, NextResponse } from 'next/server';
import { listApprovedMoments, submitMoment, likeMoment, isVideoMedia } from '@/lib/server/moments';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export const maxDuration = 60;

/** GET — return all approved moments for the website gallery */
export async function GET() {
  try {
    const moments = await listApprovedMoments();
    return NextResponse.json({ moments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch moments' }, { status: 500 });
  }
}

/** POST — submit a new moment (photo or video) or like an existing one */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // 1. Multipart Form-Data (recommended for binary video and large photos)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const action = formData.get('action');

      if (action === 'like') {
        const id = formData.get('id') as string;
        if (!id) return NextResponse.json({ error: 'Missing moment id' }, { status: 400 });
        const likes = await likeMoment(id);
        if (likes === null) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
        return NextResponse.json({ likes });
      }

      const file = formData.get('file') as File | null;
      const name = (formData.get('name') as string)?.trim();
      const author = (formData.get('author') as string)?.trim() || name;
      const location = (formData.get('location') as string)?.trim() || 'Gulberg';
      const caption = (formData.get('caption') as string)?.trim();
      const product = (formData.get('product') as string)?.trim() || '';

      let finalMediaUrl = (formData.get('imageUrl') as string)?.trim() || '';
      let detectedType: 'image' | 'video' = 'image';

      if (file && typeof file === 'object' && 'name' in file && file.size > 0) {
        const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
        detectedType = isVid ? 'video' : 'image';
        const buffer = Buffer.from(await file.arrayBuffer());

        // Attempt Cloudinary upload first if configured
        try {
          const { isCloudinaryConfigured, uploadMediaToCloudinary } = await import('@/lib/server/cloudinary');
          if (isCloudinaryConfigured()) {
            const uploadRes = await uploadMediaToCloudinary(buffer, {
              resourceType: isVid ? 'video' : 'image',
              folder: 'brewns/moments',
            });
            finalMediaUrl = uploadRes.secureUrl;
          }
        } catch (cErr) {
          console.warn('[Cloudinary] Upload failed, falling back to local storage:', cErr);
        }

        // Fallback to local storage if Cloudinary wasn't configured or failed
        if (!finalMediaUrl) {
          let ext = path.extname(file.name).toLowerCase().replace('.', '') || (isVid ? 'mp4' : 'jpg');
          if (ext === 'jpeg') ext = 'jpg';
          const fileName = `moment_${isVid ? 'vid_' : ''}${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
          const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads', 'moments');
          await mkdir(uploadDir, { recursive: true });
          const filePath = path.join(uploadDir, fileName);
          await writeFile(filePath, buffer);
          finalMediaUrl = `/assets/uploads/moments/${fileName}`;
        }
      }

      if (!finalMediaUrl || !name || !caption) {
        return NextResponse.json({ error: 'Please provide a photo or video, your name, and a caption.' }, { status: 400 });
      }

      const moment = await submitMoment({
        imageUrl: finalMediaUrl,
        mediaType: detectedType,
        author,
        name,
        location,
        caption,
        product,
      });

      return NextResponse.json({
        moment,
        message: 'Moment submitted! Once reviewed and approved by our team, it will appear live on the Brewns Moments wall.',
      }, { status: 201 });
    }

    // 2. JSON Body (supports base64 data URLs, remote URLs, and likes)
    const body = await req.json();

    if (body.action === 'like') {
      if (!body.id) return NextResponse.json({ error: 'Missing moment id' }, { status: 400 });
      const likes = await likeMoment(body.id);
      if (likes === null) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      return NextResponse.json({ likes });
    }

    let { imageUrl, mediaUrl, mediaType, author, name, location, caption, product } = body;
    let finalMediaUrl = mediaUrl || imageUrl;
    if (!finalMediaUrl || !name || !caption) {
      return NextResponse.json({ error: 'Please provide a photo or video, your name, and a caption.' }, { status: 400 });
    }

    let detectedType: 'image' | 'video' = mediaType === 'video' ? 'video' : 'image';

    // If finalMediaUrl is base64 video
    if (finalMediaUrl.startsWith('data:video/')) {
      detectedType = 'video';
      try {
        const { isCloudinaryConfigured, uploadMediaToCloudinary } = await import('@/lib/server/cloudinary');
        if (isCloudinaryConfigured()) {
          const res = await uploadMediaToCloudinary(finalMediaUrl, {
            resourceType: 'video',
            folder: 'brewns/moments',
          });
          finalMediaUrl = res.secureUrl;
        }
      } catch (cErr) {
        console.warn('[Cloudinary] Video base64 upload failed, falling back to local file:', cErr);
      }

      if (finalMediaUrl.startsWith('data:video/')) {
        try {
          const matches = finalMediaUrl.match(/^data:video\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (matches) {
            let ext = matches[1].toLowerCase();
            if (ext === 'quicktime') ext = 'mov';
            else if (ext.includes('mp4')) ext = 'mp4';
            else if (ext.includes('webm')) ext = 'webm';
            else ext = 'mp4';
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `moment_vid_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
            const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads', 'moments');
            await mkdir(uploadDir, { recursive: true });
            const filePath = path.join(uploadDir, fileName);
            await writeFile(filePath, buffer);
            finalMediaUrl = `/assets/uploads/moments/${fileName}`;
          }
        } catch (e) {
          console.error('Failed to save base64 video:', e);
        }
      }
    } else if (finalMediaUrl.startsWith('data:image/')) {
      detectedType = 'image';
      try {
        const { isCloudinaryConfigured, uploadMediaToCloudinary } = await import('@/lib/server/cloudinary');
        if (isCloudinaryConfigured()) {
          const res = await uploadMediaToCloudinary(finalMediaUrl, {
            resourceType: 'image',
            folder: 'brewns/moments',
          });
          finalMediaUrl = res.secureUrl;
        }
      } catch (cErr) {
        console.warn('[Cloudinary] Image base64 upload failed, falling back to local file:', cErr);
      }

      if (finalMediaUrl.startsWith('data:image/')) {
        try {
          const matches = finalMediaUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (matches) {
            let ext = matches[1].toLowerCase().replace('jpeg', 'jpg');
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `moment_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
            const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads', 'moments');
            await mkdir(uploadDir, { recursive: true });
            const filePath = path.join(uploadDir, fileName);
            await writeFile(filePath, buffer);
            finalMediaUrl = `/assets/uploads/moments/${fileName}`;
          }
        } catch (e) {
          console.error('Failed to save base64 image:', e);
        }
      }
    } else if (isVideoMedia(finalMediaUrl, mediaType)) {
      detectedType = 'video';
    }

    const moment = await submitMoment({
      imageUrl: finalMediaUrl,
      mediaType: detectedType,
      author: author || name,
      name,
      location: location || 'Gulberg',
      caption,
      product,
    });

    return NextResponse.json({
      moment,
      message: 'Moment submitted! Once reviewed and approved by our team, it will appear live on the Brewns Moments wall.',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}
