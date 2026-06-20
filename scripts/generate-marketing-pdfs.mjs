import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "/Users/jianghu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = path.resolve("output/pdf");
const baseUrl = process.env.PDF_SOURCE_BASE_URL ?? "http://127.0.0.1:4175";

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const sharedPrintCss = `
  @page { size: A4; margin: 12mm 10mm 15mm; }
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  * {
    animation: none !important;
    transition: none !important;
  }
`;

const jobs = [
  {
    url: `${baseUrl}/ecosystem`,
    output: "VVVEco_Ecosystem.pdf",
    publicUrl: "https://vvveco.io/ecosystem",
    css: `
      ${sharedPrintCss}
      .ecosystem-site .topbar {
        position: absolute !important;
      }
      .ecosystem-site .hero-section {
        min-height: 1180px !important;
      }
      .ecosystem-site .page-container {
        width: 960px !important;
      }
      .ecosystem-site .section-shell,
      .ecosystem-site .why-section,
      .ecosystem-site .vision-section,
      .ecosystem-site .final-cta {
        break-before: page;
        min-height: 1120px !important;
      }
      .ecosystem-site .section-shell,
      .ecosystem-site .why-section {
        padding-top: 70px !important;
        padding-bottom: 70px !important;
        display: flex !important;
        align-items: center !important;
      }
      .ecosystem-site footer {
        break-before: page;
      }
    `,
  },
  {
    url: "https://vvveco.io/",
    output: "VVVEco_Official_Website.pdf",
    publicUrl: "https://vvveco.io/",
    css: `
      ${sharedPrintCss}
      header {
        display: none !important;
      }
      main > section:first-of-type {
        min-height: 0 !important;
        padding-top: 22mm !important;
        padding-bottom: 22mm !important;
      }
      main > section {
        break-inside: auto;
      }
      main > section:not(:first-of-type) {
        break-before: page;
      }
      [data-rk] {
        min-height: auto !important;
      }
    `,
  },
];

for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });

  await page.goto(job.url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(job.url.startsWith("https://") ? 8_000 : 2_000);
  await page.addStyleTag({ content: job.css });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);

  await page.pdf({
    path: path.join(outputDir, job.output),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `
      <div style="width:100%;padding:0 10mm;font-family:Arial,sans-serif;font-size:7px;color:#143c62;display:flex;justify-content:space-between;">
        <span>VVVEco</span>
        <span>${job.publicUrl}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: "12mm",
      right: "10mm",
      bottom: "15mm",
      left: "10mm",
    },
    scale: job.output === "VVVEco_Ecosystem.pdf" ? 0.72 : 0.58,
  });

  await page.close();
}

await browser.close();
