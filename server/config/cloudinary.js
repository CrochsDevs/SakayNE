import { v2 as cloudinary } from "cloudinary";
import { requireValue } from '../shared/errors.js';

function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export function validateImage(base64, mimeType = 'image/jpeg') {
  requireValue(typeof base64 === 'string' && ALLOWED_TYPES.includes(mimeType), 'Upload a PNG, JPEG or WebP image');
  let content = base64;
  if (content.startsWith('data:')) {
    const prefix = `data:${mimeType};base64,`;
    requireValue(content.startsWith(prefix), 'Image data must match its declared type');
    content = content.slice(prefix.length);
  }
  requireValue(content.length > 0 && content.length <= Math.ceil(MAX_SIZE / 3) * 4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content), 'Invalid or oversized base64 image');
  const bytes = Buffer.from(content, 'base64');
  requireValue(bytes.length <= MAX_SIZE, 'Image exceeds 5MB limit');
  const matches = mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mimeType === 'image/webp' ? bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  requireValue(matches, 'Image contents do not match its declared type');
  return `data:${mimeType};base64,${content}`;
}

export async function uploadImage(base64, mimeType = "image/jpeg", document = false) {
  const dataUri = validateImage(base64, mimeType);

  const result = await getCloudinary().uploader.upload(dataUri, {
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    folder: document ? 'sakayne/documents' : 'sakayne/avatars',
    ...(document ? { type: 'authenticated' } : { transformation: [{ width: 300, height: 300, crop: "fill", quality: "auto" }] }),
  });
  return document ? getCloudinary().url(result.public_id, { secure: true, sign_url: true, type: 'authenticated', format: result.format }) : result.secure_url;
}
