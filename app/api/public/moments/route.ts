import { NextRequest, NextResponse } from 'next/server';
import { listApprovedMoments, submitMoment, likeMoment, isVideoMedia } from '@/lib/server/moments';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { HttpError, clientIp, rateLimit } from '@/lib/server/http';
import { checkUpload, safeMediaUrl } from '@/lib/server/uploads';

export const maxDuration = 60;

/** A few posts an hour per visitor: the wall is moderated, but nobody should be able to flood it. */
const limitUpload = (req: Request) => rateLimit(`moment-up:${clientIp(req)}`, 6, 3600, 'That is a lot of moments in an hour. Try again a little later.');

/** One like per visitor per moment per day, and a sane number overall. */
async function limitLike(req: Request, id: string) {
  const ip = clientIp(req);
  await rateLimit(`moment-like:${ip}`, 60, 3600, 'Easy on the likes. Try again a little later.');
  await rateLimit(`moment-like:${ip}:${id.slice(0, 24)}`, 1, 86400, 'You already liked this one.');
}

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
      if (action !== 'like') await limitUpload(req);

      if (action === 'like') {
        const id = formData.get('id') as string;
        if (!id) return NextResponse.json({ error: 'Missing moment id' }, { status: 400 });
        await limitLike(req, id);
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

      let finalMediaUrl = safeMediaUrl(formData.get('imageUrl')) || '';
      let detectedType: 'image' | 'video' = 'image';

      if (file && typeof file === 'object' && 'name' in file && file.size > 0) {
        const up = await checkUpload(file);
        if (!up.ok) return NextResponse.json({ error: up.error }, { status: up.status });
        const { buffer, media } = up;
        const isVid = media.kind === 'video';
        detectedType = media.kind;

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

        // Fallback to local storage (only when filesystem is writable) or resilient base64 data URL
        if (!finalMediaUrl) {
          const mimeType = media.mime;
          // Only attempt local disk write if NOT on Vercel/serverless
          if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
            try {
              // The extension comes from what the file is, never from what it was called.
              const fileName = `moment_${isVid ? 'vid_' : ''}${Date.now()}_${randomBytes(4).toString('hex')}.${media.ext}`;
              const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads', 'moments');
              await mkdir(uploadDir, { recursive: true });
              const filePath = path.join(uploadDir, fileName);
              await writeFile(filePath, buffer);
              finalMediaUrl = `/assets/uploads/moments/${fileName}`;
            } catch (fsErr) {
              console.warn('[Storage] Local write failed, falling back to data URL:', fsErr);
            }
          }
          // Serverless / read-only filesystem fallback: direct base64 data URL
          if (!finalMediaUrl) {
            finalMediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
          }
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
      await limitLike(req, String(body.id));
      const likes = await likeMoment(body.id);
      if (likes === null) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      return NextResponse.json({ likes });
    }

    await limitUpload(req);
    let { imageUrl, mediaUrl, mediaType, author, name, location, caption, product } = body;
    let finalMediaUrl = safeMediaUrl(mediaUrl || imageUrl) || '';
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

      if (finalMediaUrl.startsWith('data:video/') && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
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
          console.warn('[Storage] Could not write video to local disk, keeping base64 data URL:', e);
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

      if (finalMediaUrl.startsWith('data:image/') && !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
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
          console.warn('[Storage] Could not write image to local disk, keeping base64 data URL:', e);
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
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}
