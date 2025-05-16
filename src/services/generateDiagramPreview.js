const { fromPath } = require("pdf2pic");
const sharp = require("sharp");
const path = require("path");
const fetch = require("node-fetch");
const { bucket } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");

/**
 * Determines how to generate a preview based on the file type.
 */
async function generateDiagramPreview(storagePath) {
  const ext = path.extname(storagePath).toLowerCase();

  if (ext === ".pdf") {
    return await generatePdfPreview(storagePath);
  } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return await generateImageThumbnail(storagePath);
  } else {
    throw new Error("Unsupported file type for preview generation.");
  }
}

async function generatePdfPreview(storagePath) {
  console.log(`[PREVIEW] Generating preview for: ${storagePath}`);

  // Get signed URL from Firebase Storage
  const [pdfUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  // Download PDF as buffer
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
  const pdfBuffer = await res.buffer();

  // Convert first page to image using pdf2pic
  const converter = fromBuffer(pdfBuffer, {
    density: 150, // controls image quality
    format: "png",
    width: 1200, // scale up for better resolution
    height: 1600,
  });

  console.log(`[PREVIEW] Rendering first page...`);
  const result = await converter(1); // first page
  const previewBuffer = result.base64
    ? Buffer.from(result.base64, "base64")
    : result.path
    ? await fs.promises.readFile(result.path)
    : null;

  if (!previewBuffer) throw new Error("Failed to generate preview image.");

  // Generate thumbnail with sharp
  const thumbBuffer = await sharp(previewBuffer)
    .resize({ width: 300 }) // thumbnail width
    .toBuffer();

  const dir = path.dirname(storagePath);
  const previewPath = `${dir}/preview.png`;
  const thumbPath = `${dir}/thumb.png`;

  console.log(`[PREVIEW] Uploading images...`);
  const [previewUrl, thumbnailUrl] = await Promise.all([
    uploadToFirebase(previewBuffer, previewPath),
    uploadToFirebase(thumbBuffer, thumbPath),
  ]);

  console.log(`[PREVIEW] Done.`);
  return { previewUrl, thumbnailUrl };
}

async function generateImageThumbnail(storagePath) {
  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  const response = await fetch(downloadUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  const thumbBuffer = await sharp(imageBuffer)
    .resize({ width: 300 })
    .toBuffer();

  const dir = path.dirname(storagePath);
  const thumbPath = `${dir}/thumb.png`;

  const thumbnailUrl = await uploadToFirebase(thumbBuffer, thumbPath);

  return {
    previewUrl: downloadUrl, // original image stays as-is
    thumbnailUrl,
  };
}

async function generateImageThumbnail(storagePath) {
  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  const response = await fetch(downloadUrl);
  const imageBuffer = await response.arrayBuffer();

  const thumbBuffer = await sharp(Buffer.from(imageBuffer))
    .resize({ width: 300 })
    .toBuffer();

  const dir = path.dirname(storagePath);
  const thumbPath = `${dir}/thumb.png`;

  const thumbnailUrl = await uploadToFirebase(thumbBuffer, thumbPath);

  return {
    previewUrl: downloadUrl, // original image
    thumbnailUrl,
  };
}

async function uploadToFirebase(buffer, storagePath) {
  const file = bucket.file(storagePath);
  const uuid = uuidv4();

  await file.save(buffer, {
    metadata: {
      contentType: "image/png",
      metadata: {
        firebaseStorageDownloadTokens: uuid,
      },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${
    bucket.name
  }/o/${encodeURIComponent(storagePath)}?alt=media&token=${uuid}`;
}

module.exports = { generateDiagramPreview };
