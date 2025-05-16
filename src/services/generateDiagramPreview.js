const { Poppler } = require("node-poppler");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { bucket } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");

const poppler = new Poppler();

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
  console.log("[PDF PREVIEW] Generating preview for PDF:", storagePath);
  const inputPath = "/tmp/input.pdf";
  const outputPath = "/tmp/preview.png";

  // Save downloaded PDF to /tmp/input.pdf
  const [pdfUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  // Download PDF
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error("Failed to download PDF");

  const pdfBuffer = Buffer.from(await res.arrayBuffer());
  console.log("[PDF PREVIEW] ----4----");
  await fs.writeFile(inputPath, pdfBuffer);
  console.log("[PDF PREVIEW] ----5----");
  // Convert the first page using pdftoppm
  await poppler.pdfToCairo(inputPath, outputPath.replace(".png", ""), {
    pngFile: true,
    singleFile: true,
    firstPageToConvert: 1,
    lastPageToConvert: 1,
    resolutionXAxis: 150,
    resolutionYAxis: 150,
  });
  console.log("[PDF PREVIEW] ----6----");
  const previewBuffer = await fs.readFile(outputPath);
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
