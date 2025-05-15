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

  console.log("[DEBUG] pdfUrl:", pdfUrl);
  const proxiedPdfUrl = `${viewerBaseUrl}/pdf-proxy?url=${encodeURIComponent(
    pdfUrl
  )}`;
  console.log("[DEBUG] proxiedPdfUrl:", proxiedPdfUrl);
  const viewerUrl = `${viewerBaseUrl}/pdf-viewer/web/viewer.html?file=${proxiedPdfUrl}`;
  console.log(`[DEBUG] viewerUrl: ${viewerUrl}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Pipe viewer console logs into Node logs
  page.on("console", (msg) => console.log(`[VIEWER LOG] ${msg.text()}`));
  page.on("pageerror", (err) => console.error(`[VIEWER ERROR] ${err}`));

  try {
    await page.goto(viewerUrl, { waitUntil: "networkidle2" });
    await page.waitForSelector("#viewer .page canvas", {
      timeout: 60000,
      visible: true,
    });
    console.log("[PREVIEW] Canvas element found.");

    const canvasHandle = await page.$("#viewer .page canvas");

    console.log("[PREVIEW] Waiting for canvas to be rendered...");
    await page.evaluate(async (canvas) => {
      const ctx = canvas.getContext("2d");
      let attempts = 0;
      let hasContent = false;

      while (attempts < 30 && !hasContent) {
        await new Promise((r) => setTimeout(r, 500));
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        hasContent = pixels.some((v, i) => i % 4 !== 3 && v > 0);
        attempts++;
      }

      if (!hasContent) {
        throw new Error("Timeout: Canvas was not rendered with PDF content.");
      }
    }, canvasHandle);

    console.log("[PREVIEW] Canvas rendering confirmed. Taking screenshot...");
    const previewBuffer = await canvasHandle.screenshot();

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

    console.log("[PREVIEW] Thumbnail and preview uploaded successfully.");
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
