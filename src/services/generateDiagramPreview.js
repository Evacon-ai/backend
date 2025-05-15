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
  console.log(`[PREVIEW] Generating preview for: ${storagePath}`);

  const [pdfUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });

  const viewerBaseUrl = process.env.VIEWER_BASE_URL;
  if (!viewerBaseUrl) throw new Error("Missing VIEWER_BASE_URL");

  const proxiedPdfUrl = `${viewerBaseUrl}/pdf-proxy?url=${encodeURIComponent(
    pdfUrl
  )}`;
  const encodedProxyUrl = encodeURIComponent(proxiedPdfUrl);
  const viewerUrl = `${viewerBaseUrl}/pdf-viewer/web/viewer.html?file=${encodedProxyUrl}`;
  console.log(`[DEBUG] viewerUrl: ${viewerUrl}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // prevents /dev/shm overflow
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-breakpad",
      "--no-zygote",
      "--single-process",
    ],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log(`[VIEWER LOG] ${msg.text()}`));
  page.on("pageerror", (err) => console.error(`[VIEWER ERROR] ${err}`));

  try {
    console.log("[TEST] Navigating to https://example.com...");
    await page.goto("https://example.com", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    const buf = await page.screenshot({ path: "/tmp/test.png" });
    console.log("[TEST] Ended successfully");

    console.log("[PREVIEW] Navigating to viewer...");
    await page.goto(viewerUrl, { waitUntil: "networkidle2" });

    console.log("[DEBUG] Waiting 3s before checking canvas...");
    await page.setViewport({ width: 1280, height: 800 });
    await new Promise((r) => setTimeout(r, 10000));

    console.log("[DEBUG] Checking canvas presence...");
    if (page.isClosed()) {
      console.log("[ERROR] Page was closed before screenshot.");
      throw new Error("Page was closed before screenshot.");
    }

    const frameUrl = page.mainFrame().url();
    console.log("[DEBUG] Main frame URL:", frameUrl);

    console.log("[DEBUG] Capturing screenshot...");
    const previewBuffer = await page.screenshot(); // just screenshot visible viewport

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

    console.log("[PREVIEW] Upload complete.");
    return { previewUrl, thumbnailUrl };
  } catch (error) {
    console.error(`[PREVIEW ERROR] ${error.message}`);
    throw error;
  } finally {
    await browser.close();
    console.log("[PREVIEW] Browser closed.");
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
