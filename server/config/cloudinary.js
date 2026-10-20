import { v2 as cloudinary } from "cloudinary";

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

export async function uploadImage(base64, mimeType = "image/jpeg", document = false) {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Only PNG, JPG, and JPEG files are allowed");
  }

  const size = (base64.length * 3) / 4;
  if (size > MAX_SIZE) {
    throw new Error("Image exceeds 5MB limit");
  }

  const dataUri = base64.startsWith("data:")
    ? base64
    : `data:${mimeType};base64,${base64}`;

  const result = await getCloudinary().uploader.upload(dataUri, {
    folder: document ? 'sakayne/documents' : 'sakayne/avatars',
    ...(document ? { type: 'authenticated' } : { transformation: [{ width: 300, height: 300, crop: "fill", quality: "auto" }] }),
  });
  return document ? getCloudinary().url(result.public_id, { secure: true, sign_url: true, type: 'authenticated', format: result.format }) : result.secure_url;
}
