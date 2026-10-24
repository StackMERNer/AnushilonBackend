import { Browser, chromium } from "playwright";

/**
 * A single shared Chromium instance, launched lazily on first use and
 * reused across every PDF render.
 *
 * Launching a fresh browser per PDF (the original implementation) is
 * fine for a one-off test script, but is far too heavy once we're
 * batch-generating dozens of PDFs for a subject/class — each launch
 * alone costs a few hundred ms and a chunk of memory. We instead open
 * one lightweight `page` per PDF and reuse the same browser process.
 *
 * If the browser ever disconnects/crashes mid-run, the next call
 * transparently relaunches it.
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const browser = await browserPromise;

    if (browser.isConnected()) {
      return browser;
    }

    browserPromise = null;
  }

  browserPromise = chromium.launch();

  return browserPromise;
}

/**
 * Call this when a batch job / server is shutting down so the
 * Chromium process doesn't linger. Not required between individual
 * `generatePdfFromHtml` calls — the whole point is to keep it warm.
 */
export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise;
  browserPromise = null;

  await browser.close();
}

export async function generatePdfFromHtml(html: string, outputPath: string) {
  const browser = await getBrowser();

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 900,
    },
  });

  try {
    await page.setContent(html, {
      waitUntil: "networkidle",
    });

    /*
     * Explicitly wait for MathJax 2 to finish
     * typesetting the entire document.
     */
    await page.evaluate(async () => {
      const mathJax = (window as any).MathJax;

      if (!mathJax || !mathJax.Hub) {
        throw new Error("MathJax failed to load.");
      }

      await new Promise<void>((resolve) => {
        mathJax.Hub.Queue(["Typeset", mathJax.Hub, document, resolve]);
      });
    });

    /*
     * Wait for fonts.
     */
    await page.evaluate(async () => {
      if ("fonts" in document) {
        await (document as any).fonts.ready;
      }
    });

    /*
     * Wait for images.
     */
    await page.evaluate(async () => {
      const images = Array.from(document.images);

      await Promise.all(
        images.map((image) => {
          if (image.complete) {
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });

            image.addEventListener("error", () => resolve(), { once: true });
          });
        }),
      );
    });

    /*
     * Give the browser one final rendering cycle.
     */
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "15mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
    });
  } finally {
    await page.close();
  }
}
