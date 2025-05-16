const fs = require("fs/promises");
const path = require("path");
const fetch = require("node-fetch");
const sharp = require("sharp");
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
  let convert;
  console.log("[PDF PREVIEW] Generating preview for PDF:", storagePath);
  try {
    ({ convert } = require("pdf-poppler"));
    console.log("[PDF PREVIEW] { convert } = require(pdf-poppler)");
  } catch (err) {
    console.log("[PDF PREVIEW] Failed to load pdf-poppler:", err.message);
    console.error("[PDF PREVIEW] Failed to load pdf-poppler:", err.message);
    throw err;
  }
  const [pdfUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });
  console.log("[PDF PREVIEW] ----1----");
  const tmpPdfPath = "/tmp/input.pdf";
  const tmpImagePrefix = "/tmp/preview";
  // Download PDF
  const res = await fetch(pdfUrl);
  console.log("[PDF PREVIEW] ----2----");
  if (!res.ok) throw new Error("Failed to download PDF");
  console.log("[PDF PREVIEW] ----3----");
  const pdfBuffer = await res.buffer();
  console.log("[PDF PREVIEW] ----4----");
  await fs.writeFile(tmpPdfPath, pdfBuffer);
  console.log("[PDF PREVIEW] ----5----");
  // Convert first page
  await convert(tmpPdfPath, {
    format: "png",
    out_dir: "/tmp",
    out_prefix: "preview",
    page: 1,
    scale: 150,
  });
  console.log("[PDF PREVIEW] ----6----");
  const previewBuffer = await fs.readFile("/tmp/preview-1.png");
  console.log("[PDF PREVIEW] ----7----");
  const thumbBuffer = await sharp(previewBuffer)
    .resize({ width: 300 })
    .toBuffer();
  console.log("[PDF PREVIEW] ----8----");
  const dir = path.dirname(storagePath);
  const previewPath = `${dir}/preview.png`;
  const thumbPath = `${dir}/thumb.png`;
  const [previewUrl, thumbnailUrl] = await Promise.all([
    uploadToFirebase(previewBuffer, previewPath),
    uploadToFirebase(thumbBuffer, thumbPath),
  ]);
  console.log("[PDF PREVIEW] ----9----");
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
