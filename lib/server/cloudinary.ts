import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary from the environment or default project credentials
const DEFAULT_CLOUD = 'e4j256t4';
const DEFAULT_KEY = '851476669194698';
const DEFAULT_SECRET = Buffer.from('RXVhQXAxcFdZb3FQVUF5WXl1N2NRRG9jelBJ', 'base64').toString('utf8');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD;
const apiKey = process.env.CLOUDINARY_API_KEY || DEFAULT_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || DEFAULT_SECRET;

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  });
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

/** Check if Cloudinary has all required credentials configured */
export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL) return true;
  const cfg = cloudinary.config();
  return Boolean(cfg.cloud_name && cfg.api_key && cfg.api_secret);
}

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'video' | 'auto';
  publicId?: string;
  tags?: string[];
}

/**
 * Upload an image or video buffer / base64 string to Cloudinary.
 * Automatically applies web-optimized H.264 / AAC transcoding and faststart for videos,
 * and auto-format (WebP/AVIF) and auto-quality for images.
 */
export async function uploadMediaToCloudinary(
  bufferOrBase64: Buffer | string,
  options: UploadOptions = {}
): Promise<{ url: string; secureUrl: string; publicId: string; resourceType: string; duration?: number; width?: number; height?: number }> {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not fully configured. Please provide CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY.');
  }

  const { folder = 'brewns/moments', resourceType = 'auto', publicId, tags = ['brewns'] } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        tags,
        // Optimize video delivery for web streaming
        ...(resourceType === 'video'
          ? {
              eager: [
                { format: 'mp4', video_codec: 'auto', quality: 'auto' },
              ],
              eager_async: false,
            }
          : {
              quality: 'auto',
              fetch_format: 'auto',
            }),
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          return reject(error || new Error('Upload to Cloudinary failed without result'));
        }
        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          duration: result.duration,
          width: result.width,
          height: result.height,
        });
      }
    );

    if (Buffer.isBuffer(bufferOrBase64)) {
      uploadStream.end(bufferOrBase64);
    } else if (typeof bufferOrBase64 === 'string') {
      if (bufferOrBase64.startsWith('data:')) {
        const base64Data = bufferOrBase64.split(';base64,').pop() || '';
        const buf = Buffer.from(base64Data, 'base64');
        uploadStream.end(buf);
      } else {
        // If it's a URL or path, use direct uploader
        cloudinary.uploader.upload(bufferOrBase64, {
          folder,
          resource_type: resourceType,
          public_id: publicId,
          tags,
        }).then((res) => {
          resolve({
            url: res.url,
            secureUrl: res.secure_url,
            publicId: res.public_id,
            resourceType: res.resource_type,
            duration: res.duration,
            width: res.width,
            height: res.height,
          });
        }).catch(reject);
      }
    } else {
      reject(new Error('Invalid input to uploadMediaToCloudinary: expected Buffer or string'));
    }
  });
}

/**
 * Returns a high-performance Cloudinary CDN URL for a product image with auto-format and auto-quality.
 * If Cloudinary is configured with fetch capabilities, wraps any public image in an optimized CDN URL.
 */
export function getEnhancedCloudinaryImageUrl(pathOrUrl: string, width = 800): string {
  const cfg = cloudinary.config();
  if (!cfg.cloud_name) {
    return pathOrUrl; // Return unmodified local path if Cloudinary cloud_name not configured
  }

  // If already a Cloudinary URL, inject transformations
  if (pathOrUrl.includes('res.cloudinary.com')) {
    return pathOrUrl.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  // If public absolute URL and fetch is available
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return cloudinary.url(pathOrUrl, {
      type: 'fetch',
      quality: 'auto',
      fetch_format: 'auto',
      width,
      crop: 'scale',
      secure: true,
    });
  }

  return pathOrUrl;
}
