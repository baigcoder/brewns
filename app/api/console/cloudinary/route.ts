import { NextRequest, NextResponse } from 'next/server';
import { currentStaff } from '@/lib/server/auth';
import { isCloudinaryConfigured, uploadMediaToCloudinary } from '@/lib/server/cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** GET — check Cloudinary configuration status and stats */
export async function GET() {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configured = isCloudinaryConfigured();
  const cfg = cloudinary.config();

  return NextResponse.json({
    configured,
    cloudName: cfg.cloud_name || null,
    apiKeyConfigured: Boolean(cfg.api_key),
    apiSecretConfigured: Boolean(cfg.api_secret),
  });
}

/** POST — sync & enhance local product images to Cloudinary */
export async function POST(req: NextRequest) {
  const staff = await currentStaff();
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json({
      error: 'Cloudinary is not fully configured. Please ensure CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY are set in .env.local',
    }, { status: 400 });
  }

  try {
    const foldersToSync = [
      { localDir: path.join(process.cwd(), 'public', 'assets', 'shop', 'snap'), folder: 'brewns/products/shop' },
      { localDir: path.join(process.cwd(), 'public', 'assets', 'kitchen'), folder: 'brewns/products/kitchen' },
    ];

    const results: { file: string; secureUrl: string }[] = [];

    for (const { localDir, folder } of foldersToSync) {
      try {
        const files = await readdir(/*turbopackIgnore: true*/ localDir);
        for (const file of files) {
          if (!/\.(webp|jpg|jpeg|png)$/i.test(file)) continue;
          const fullPath = path.join(/*turbopackIgnore: true*/ localDir, file);
          const buffer = await readFile(/*turbopackIgnore: true*/ fullPath);
          const baseName = path.parse(file).name;

          const uploadRes = await uploadMediaToCloudinary(buffer, {
            folder,
            publicId: baseName,
            resourceType: 'image',
            tags: ['brewns', 'product', 'enhanced'],
          });

          results.push({ file, secureUrl: uploadRes.secureUrl });
        }
      } catch (err: any) {
        console.warn(`[Cloudinary Sync] Error scanning directory ${localDir}:`, err.message);
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: results.length,
      images: results,
      message: `Successfully enhanced and uploaded ${results.length} product images to Cloudinary CDN!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to sync product images to Cloudinary' }, { status: 500 });
  }
}
