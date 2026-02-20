import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 });

  await page.route("**/seek?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        Ok: {
          snapshot: { id: "snap-e2e-123456" },
          delta_ranges: [{ estimated_deltas: 42 }],
        },
      }),
    });
  });

  await page.goto("/");
});

test("layer toggles remain operator-visible with dense counts", async ({ page }) => {
  const adsbLayer = page.getByTestId("layer-ADSB");
  await expect(adsbLayer).toBeVisible();
  await expect(adsbLayer).toHaveAttribute("aria-pressed", "true");

  await expect(adsbLayer).toContainText("ADS-B Aircraft");
  await expect(adsbLayer).toContainText(/\d/);

  await adsbLayer.click();
  await expect(adsbLayer).toHaveAttribute("aria-pressed", "false");

  await adsbLayer.click();
  await expect(adsbLayer).toHaveAttribute("aria-pressed", "true");
});

test("DVR scrubber triggers seek metadata rehydration state", async ({ page }) => {
  await page.getByTestId("timeline-play-toggle").click();

  const scrubber = page.getByTestId("timeline-scrubber");
  await expect(scrubber).toBeEnabled();

  await scrubber.evaluate((element) => {
    const slider = element as HTMLInputElement;
    const max = Number(slider.max);
    const min = Number(slider.min);
    const target = Math.max(min, max - 120_000);
    slider.value = String(target);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const seekMeta = page.getByTestId("timeline-seek-meta");
  await expect(seekMeta).toContainText("Δ42");
  await expect(seekMeta).toContainText("S:snap-e2e");
});

test("alert click expands evidence chain interactions", async ({ page }) => {
  const alertItem = page.getByTestId("alert-item-e2e-alert-1");
  await expect(alertItem).toBeVisible();

  await alertItem.click({ force: true });
  await expect(page.getByText("EVIDENCE_CHAIN")).toBeVisible();
  await expect(
    page.getByText("TRACK:e2e-track-1 -> observed_by -> SENSOR:e2e-sensor-1"),
  ).toBeVisible();

  const focusButton = page.getByTestId("alert-focus-e2e-link-1");
  await expect(focusButton).toBeVisible();
  await focusButton.click();
});
