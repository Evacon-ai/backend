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

  try {
    const page = await browser.newPage();
    const viewerBaseUrl = process.env.VIEWER_BASE_URL;
    const proxiedPdfUrl = `${viewerBaseUrl}/pdf-proxy?url=${encodeURIComponent(
      pdfUrl
    )}`;
    const viewerUrl = `${viewerBaseUrl}/pdf-viewer/viewer.html?file=${encodeURIComponent(
      proxiedPdfUrl
    )}`;

    console.log("Opening PDF:", viewerUrl);

    await page.goto(viewerUrl, { waitUntil: "networkidle2" });
    await page.waitForSelector("#viewerContainer");

    // Optional: wait for rendering to start
    await page.waitForTimeout(3000);

    // 🖼️ Take a screenshot before waiting for canvas
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const debugPath = `debug/viewer_debug_${Date.now()}.png`;
    const debugUrl = await uploadToFirebase(screenshotBuffer, debugPath);
    console.log("[DEBUG] Screenshot uploaded to:", debugUrl);

    await page.waitForSelector('.page[data-page-number="1"] canvas', {
      timeout: 90000,
      visible: true,
    });

    const canvas = await page.$(".page[data-page-number='1'] canvas");
    const previewBuffer = await canvas.screenshot();

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
  } finally {
    await browser.close();
  }
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
