const puppeteer = require("puppeteer");
const sharp = require("sharp");
const { bucket } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

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
  const [pdfUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
    pdfUrl
  )}`;
  await page.goto(viewerUrl, { waitUntil: "networkidle2" });
  await page.waitForSelector('.page[data-page-number="1"] canvas');

  const canvas = await page.$('.page[data-page-number="1"] canvas');
  const previewBuffer = await canvas.screenshot();
  await browser.close();

  const thumbBuffer = await sharp(previewBuffer)
    .resize({ width: 300 })
    .toBuffer();

  const dir = path.dirname(storagePath);
  const previewPath = `${dir}/preview.png`;
  const thumbPath = `${dir}/thumb.png`;

  const [previewUrl, thumbnailUrl] = await Promise.all([
    uploadToFirebase(previewBuffer, previewPath),
    uploadToFirebase(thumbBuffer, thumbPath),
  ]);

  return { previewUrl, thumbnailUrl };
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
