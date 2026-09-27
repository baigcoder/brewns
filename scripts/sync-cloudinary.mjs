#!/usr/bin/env node
/**
 * Brewns Coffee — Cloudinary Product Enhancer & Uploader
 * 
 * Usage:
 *   node scripts/sync-cloudinary.mjs
 * 
 * Automatically enhances and uploads all product and café images to Cloudinary CDN
 * with automatic WebP/AVIF formatting and quality optimizations.
 */

import { v2 as cloudinary } from 'cloudinary';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// Try loading .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  const envContent = readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = trimmed.split('=');
    if (k && rest.length > 0 && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET || 'piGVMqflZ6EcPwF6nqgp-77NyZs';

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL, secure: true });
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
} else {
  console.error('\n❌ Cloudinary configuration incomplete!');
  console.error('Please set CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY in .env.local\n');
  process.exit(1);
}

console.log(`\n☁️ Connected to Cloudinary cloud: ${cloudinary.config().cloud_name}`);
console.log('📦 Enhancing & uploading product images...\n');

const directories = [
  { dir: path.join(process.cwd(), 'public/assets/shop/snap'), folder: 'brewns/products/shop' },
  { dir: path.join(process.cwd(), 'public/assets/kitchen'), folder: 'brewns/products/kitchen' },
  { dir: path.join(process.cwd(), 'public/assets/moments'), folder: 'brewns/moments' },
];

let totalUploaded = 0;

for (const { dir, folder } of directories) {
  if (!existsSync(dir)) continue;
  const files = await readdir(dir);
  for (const file of files) {
    if (!/\.(webp|jpg|jpeg|png)$/i.test(file)) continue;
    const fullPath = path.join(dir, file);
    const baseName = path.parse(file).name;
    try {
      const res = await cloudinary.uploader.upload(fullPath, {
        folder,
        public_id: baseName,
        overwrite: true,
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }
        ],
        tags: ['brewns', 'product-enhanced'],
      });
      console.log(`  ✓ Uploaded & Enhanced: ${file} -> ${res.secure_url}`);
      totalUploaded++;
    } catch (e) {
      console.error(`  ✗ Failed ${file}: ${e.message}`);
    }
  }
}

console.log(`\n🎉 Done! Enhanced and uploaded ${totalUploaded} images to Cloudinary CDN.\n`);
