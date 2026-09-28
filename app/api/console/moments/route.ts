import { NextRequest, NextResponse } from 'next/server';
import { currentStaff } from '@/lib/server/auth';
import { listAllMoments, approveMoment, rejectMoment, deleteMoment } from '@/lib/server/moments';

/** GET — return all moments for console moderation */
export async function GET() {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const moments = await listAllMoments();
  const pendingCount = moments.filter((m) => m.status === 'pending').length;
  const approvedCount = moments.filter((m) => m.status === 'approved').length;
  const rejectedCount = moments.filter((m) => m.status === 'rejected').length;

  return NextResponse.json({
    moments,
    counts: {
      total: moments.length,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  });
}

/** PATCH — approve or reject a moment */
export async function PATCH(req: NextRequest) {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, action } = await req.json();
    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
    }

    if (action === 'approve') {
      const moment = await approveMoment(id);
      if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      return NextResponse.json({ success: true, moment });
    } else if (action === 'reject') {
      const moment = await rejectMoment(id);
      if (!moment) return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
      return NextResponse.json({ success: true, moment });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}

/** DELETE — remove a moment */
export async function DELETE(req: NextRequest) {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });

    const success = await deleteMoment(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 400 });
  }
}

/** POST — add a new moment directly as owner/staff (defaults to approved & live) */
export async function POST(req: NextRequest) {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let finalMediaUrl = '';
    let detectedType: 'image' | 'video' = 'image';
    let name = '';
    let author = '';
    let location = 'Gulberg';
    let caption = '';
    let product = '';
    let status: 'approved' | 'pending' = 'approved';

    if (contentType.includes('multipart/form-data')) {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const path = (await import('node:path')).default;
      const { randomBytes } = await import('node:crypto');

      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      name = (formData.get('name') as string)?.trim() || staff.user.name || 'Owner';
      author = (formData.get('author') as string)?.trim() || `@${name.toLowerCase().replace(/\s+/g, '')}`;
      location = (formData.get('location') as string)?.trim() || 'Gulberg';
      caption = (formData.get('caption') as string)?.trim() || '';
      product = (formData.get('product') as string)?.trim() || '';
      finalMediaUrl = (formData.get('imageUrl') as string)?.trim() || '';
      const reqStatus = formData.get('status') as string;
      if (reqStatus === 'pending') status = 'pending';

      if (file && typeof file === 'object' && 'name' in file && file.size > 0) {
        const isVid = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name);
        detectedType = isVid ? 'video' : 'image';
        const buffer = Buffer.from(await file.arrayBuffer());

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
          console.warn('[Cloudinary] Owner upload failed, falling back to local file:', cErr);
        }

        if (!finalMediaUrl) {
          const mimeType = file.type || (isVid ? 'video/mp4' : 'image/jpeg');
          if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
            try {
              let ext = path.extname(file.name).toLowerCase().replace('.', '') || (isVid ? 'mp4' : 'jpg');
              if (ext === 'jpeg') ext = 'jpg';
              const fileName = `moment_staff_${isVid ? 'vid_' : ''}${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
              const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads', 'moments');
              await mkdir(uploadDir, { recursive: true });
              const filePath = path.join(uploadDir, fileName);
              await writeFile(filePath, buffer);
              finalMediaUrl = `/assets/uploads/moments/${fileName}`;
            } catch (fsErr) {
              console.warn('[Storage] Local write failed, falling back to data URL:', fsErr);
            }
          }
          if (!finalMediaUrl) {
            finalMediaUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
          }
        }
      }
    } else {
      const body = await req.json();
      finalMediaUrl = body.imageUrl?.trim() || '';
      name = body.name?.trim() || staff.user.name || 'Owner';
      author = body.author?.trim() || `@${name.toLowerCase().replace(/\s+/g, '')}`;
      location = body.location?.trim() || 'Gulberg';
      caption = body.caption?.trim() || '';
      product = body.product?.trim() || '';
      detectedType = body.mediaType || 'image';
      if (body.status === 'pending') status = 'pending';

      // Check if body is base64 image or video
      if (finalMediaUrl.startsWith('data:')) {
        try {
          const { isCloudinaryConfigured, uploadMediaToCloudinary } = await import('@/lib/server/cloudinary');
          if (isCloudinaryConfigured()) {
            const isVid = finalMediaUrl.startsWith('data:video/') || detectedType === 'video';
            const uploadRes = await uploadMediaToCloudinary(finalMediaUrl, {
              resourceType: isVid ? 'video' : 'image',
              folder: 'brewns/moments',
            });
            finalMediaUrl = uploadRes.secureUrl;
            detectedType = isVid ? 'video' : 'image';
          }
        } catch (cErr) {
          console.warn('[Cloudinary] Base64 upload failed:', cErr);
        }
      }
    }

    if (!finalMediaUrl) {
      return NextResponse.json({ error: 'Please provide or upload a photo or video.' }, { status: 400 });
    }
    if (!caption) {
      return NextResponse.json({ error: 'Please enter a caption for the moment.' }, { status: 400 });
    }

    const { submitMoment } = await import('@/lib/server/moments');
    const moment = await submitMoment({
      imageUrl: finalMediaUrl,
      mediaType: detectedType,
      author,
      name,
      location,
      caption,
      product,
      status,
    });

    return NextResponse.json({ success: true, moment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create moment' }, { status: 500 });
  }
}

