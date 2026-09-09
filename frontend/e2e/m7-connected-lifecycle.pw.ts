import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installDeterministicApi } from "./fixtures";

const story = (page: Page) => page.locator("[data-scroll-story]");
async function move(page: Page, y: number) {
  await page.evaluate((top) => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo({top, behavior: "instant"}); }, y);
  await page.waitForTimeout(450);
}
async function state(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-scroll-story]")!;
    const stage = root.querySelector<HTMLElement>("[data-scroll-story-pin]")!;
    const spacer = document.querySelector<HTMLElement>(".pin-spacer");
    return {y: scrollY, mode: root.dataset.scrollMode, fit: root.dataset.scrollFit, chapter: root.dataset.activeChapter,
      pins: document.querySelectorAll(".pin-spacer").length, stageHeight: stage.getBoundingClientRect().height,
      start: spacer ? spacer.getBoundingClientRect().top + scrollY : null,
      travel: spacer ? spacer.offsetHeight - stage.offsetHeight : 0,
      overflow: document.documentElement.scrollWidth - innerWidth,
      rootFont: getComputedStyle(root).fontSize,
      chapters: [...root.querySelectorAll<HTMLElement>("[data-scroll-fallback-chapter]")].map((chapter) => {
        const heading = chapter.querySelector("h3")!.getBoundingClientRect();
        const body = chapter.querySelector("h3 + p")!.getBoundingClientRect();
        const rect = chapter.getBoundingClientRect();
        return {stage: chapter.dataset.scrollFallbackChapter, top: rect.top, bottom: rect.bottom, overlap: heading.bottom > body.top + 1};
      }),
    };
  });
}
test.beforeEach(async ({page}) => {
  await installDeterministicApi(page);
  page.on("pageerror", (error) => { throw error; });
});

for (const [width, height, mode, start] of [[1280,800,"full",1366.19],[900,720,"adapted",1716.53]] as const) {
  test(`${mode}: semantic round trips, rapid toggles, user input and release`, async ({page}, info) => {
    await page.setViewportSize({width,height}); await page.goto("/");
    await expect(story(page)).toHaveAttribute("data-scroll-mode", mode);
    const geometry = await state(page);
    expect(geometry.start).toBeCloseTo(start,1);
    expect(geometry.travel).toBe(height * (mode === "full" ? 2.5 : 2));
    const records = [];
    await move(page,500);await page.emulateMedia({reducedMotion:"reduce"});await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(500);
    await page.emulateMedia({reducedMotion:"no-preference"});await page.waitForTimeout(400);
    for (const [progress, chapter] of [[.1,"applications"],[.3,"interviews"],[.55,"preparation"],[.81,"action-center"],[.98,"action-center"]] as const) {
      const y = start + geometry.travel * progress;
      await move(page,y);await expect(story(page)).toHaveAttribute("data-active-chapter",chapter);
      await page.emulateMedia({reducedMotion:"reduce"});await page.waitForTimeout(400);
      const reduced = await state(page);expect(reduced.mode).toBe("static");expect(reduced.pins).toBe(0);expect(reduced.y).toBeGreaterThan(500);
      const corresponding = reduced.chapters.find(item => item.stage === chapter)!;
      expect(corresponding.top).toBeLessThan(height);expect(corresponding.bottom).toBeGreaterThan(0);
      await page.emulateMedia({reducedMotion:"no-preference"});await page.waitForTimeout(500);
      const restored = await state(page);expect(restored.mode).toBe(mode);expect(restored.pins).toBe(1);expect(restored.y).toBeCloseTo(Math.round(y),0);expect(restored.chapter).toBe(chapter);
      records.push({progress,reduced,restored});
      if (progress > .1 && progress < .98) {
        for (const preference of ["reduce","no-preference","reduce","no-preference","reduce"] as const) await page.emulateMedia({reducedMotion:preference});
        await page.waitForTimeout(500);expect((await state(page)).pins).toBe(0);
        await page.emulateMedia({reducedMotion:"no-preference"});await page.waitForTimeout(500);
        expect((await state(page)).chapter).toBe(chapter);expect((await state(page)).y).toBeCloseTo(Math.round(y),0);
      }
    }
    await move(page,start+geometry.travel*.3);await page.emulateMedia({reducedMotion:"reduce"});await page.emulateMedia({reducedMotion:"no-preference"});
    await page.mouse.wheel(0,90);await page.waitForTimeout(500);const userY=await page.evaluate(()=>scrollY);await page.waitForTimeout(700);expect(await page.evaluate(()=>scrollY)).toBe(userY);
    await move(page,start+geometry.travel+3);expect(await page.locator("[data-scroll-story-pin]").evaluate(e=>getComputedStyle(e).position)).not.toBe("fixed");
    expect((await state(page)).overflow).toBe(0);
    await info.attach("round-trips",{body:JSON.stringify(records,null,2),contentType:"application/json"});
  });
}

for (const [width,height] of [[1440,900],[1280,800],[1024,768],[1024,720],[1023,720],[1280,700]]) {
  test(`${width}x${height}: candidate-fit text matrix and non-oscillating recovery`,async({page},info)=>{
    await page.setViewportSize({width,height});await page.goto("/");await page.waitForTimeout(700);
    const records=[];
    for(const scale of [100,125,150,175,200,175,150,100]) {
      await page.evaluate(percent=>document.documentElement.style.fontSize=`${percent}%`,scale);await page.waitForTimeout(650);
      const first=await state(page);await page.waitForTimeout(300);const settled=await state(page);
      expect(settled.mode).toBe(first.mode);expect(settled.pins).toBe(first.pins);expect(settled.overflow).toBe(0);
      if(settled.mode!=="static") {expect(settled.stageHeight).toBeLessThanOrEqual(height+1);expect(settled.pins).toBe(1)}
      else {expect(settled.pins).toBe(0);expect(settled.chapters).toHaveLength(4);expect(settled.chapters.every(c=>!c.overlap)).toBe(true)}
      if(scale===200) {expect(settled.mode).toBe("static");await page.locator('[data-scroll-fallback-chapter="preparation"]').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath("large-text.png")});}
      records.push({scale,...settled});
    }
    expect((await state(page)).mode).toBe(width>=1024&&height>=720?"full":"adapted");
    await info.attach("fit-matrix",{body:JSON.stringify(records,null,2),contentType:"application/json"});
  });
}

test("live text scaling preserves Preparation and unmount leaves no correction",async({page},info)=>{
  await page.goto("/");await page.waitForTimeout(700);const normal=await state(page);await move(page,normal.start!+normal.travel*.55);
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");await page.waitForTimeout(650);
  const large=await state(page);expect(large.mode).toBe("static");expect(large.y).toBeGreaterThan(0);
  const chapter=large.chapters.find(c=>c.stage==="preparation")!;expect(chapter.top).toBeLessThan(800);expect(chapter.bottom).toBeGreaterThan(0);
  await page.evaluate(()=>document.documentElement.style.fontSize="100%");await page.waitForTimeout(650);
  expect((await state(page)).chapter).toBe("preparation");expect((await state(page)).pins).toBe(1);
  for(const setting of ["normal","reduced","large"]) {
    await page.emulateMedia({reducedMotion:setting==="reduced"?"reduce":"no-preference"});
    await page.evaluate(setting=>document.documentElement.style.fontSize=setting==="large"?"200%":"100%",setting);
    await page.getByRole("button",{name:"Continue Demo"}).first().click();await expect(page).toHaveURL(/dashboard/);
    // The authenticated AppLayout owns a normal scroll-to-top on route entry.
    // Wait for that navigation contract, then look for stale landing corrections.
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    expect(await page.locator(".pin-spacer").count()).toBe(0);await page.waitForTimeout(700);expect(await page.evaluate(()=>scrollY)).toBe(0);
    await page.goBack();await expect(page.locator("h1")).toContainText("Keep every opportunity");await page.waitForTimeout(500);
    expect((await state(page)).pins).toBe(setting==="normal"?1:0);
  }
  await info.attach("dynamic-text",{body:JSON.stringify({normal,large},null,2),contentType:"application/json"});
});

test("fresh reduced reading rows initialize the matching normal story without replay",async({page})=>{
  for(const [index,chapter] of [[0,"applications"],[2,"preparation"]] as const) {
    await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");await page.waitForTimeout(500);
    const y=await page.locator("[data-scroll-fallback-chapter]").nth(index).evaluate(e=>e.getBoundingClientRect().top+scrollY);
    await move(page,y);await page.emulateMedia({reducedMotion:"no-preference"});await page.waitForTimeout(600);
    await expect(story(page)).toHaveAttribute("data-active-chapter",chapter);expect((await state(page)).pins).toBe(1);expect((await state(page)).y).toBeGreaterThan(1000);
    await expect(page.locator('[data-hero-motion]')).toHaveAttribute('data-hero-motion-eligible','false');
    for(const reveal of await page.locator('[data-landing-viewport-reveal]').all()) await expect(reveal).toHaveAttribute('data-reveal-state','revealed');
  }
});

test("large-text fallback Axe, native keyboard and initial enlarged-text load",async({page})=>{
  await page.route("**/",async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("<html","<html style=\"font-size:200%\"")})});
  await page.goto("/");await expect(story(page)).toHaveAttribute("data-scroll-mode","static");expect((await state(page)).pins).toBe(0);
  const accessibility=await new AxeBuilder({page}).include('[data-scroll-story]').withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();expect(accessibility.violations).toEqual([]);
  await page.keyboard.press("Tab");await page.waitForTimeout(300);expect(await page.locator(":focus").evaluate(e=>getComputedStyle(e).visibility)).toBe("visible");
});
