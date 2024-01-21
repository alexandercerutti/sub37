import { type Locator, test as base } from "@playwright/test";
import { FakeHTMLVideoElement } from "../../sample/src/components/customElements/fake-video";

interface RendererFixture {
	getFakeVideo(): Locator;
	pauseServing(): Promise<void>;
	seekToSecond(atSecond: number): Promise<void>;
	waitForEvent(event: "playing"): Promise<void>;
}

const SUB37_SAMPLE_PAGE_PATH = "./pages/sub37-example/index.html";

export const RendererFixture = base.extend<RendererFixture>({
	page({ page }, use) {
		page.goto(SUB37_SAMPLE_PAGE_PATH);
		return use(page);
	},
	getFakeVideo({ page }, use) {
		return use(() => page.locator("fake-video"));
	},
	waitForEvent({ getFakeVideo }, use) {
		return use(async (eventName) => {
			const videoElement = getFakeVideo();

			return videoElement.evaluate<void, { eventName: string }, FakeHTMLVideoElement>(
				(element, { eventName }) => {
					return new Promise<void>((resolve) => {
						element.addEventListener(eventName, () => resolve());
					});
				},
				{ eventName },
			);
		});
	},
	pauseServing({ getFakeVideo }, use) {
		return use(async () => {
			const videoElement = getFakeVideo();
			await videoElement.evaluate<void, void, FakeHTMLVideoElement>((element) => {
				element.pause();
			}, undefined);
		});
	},
	seekToSecond({ getFakeVideo }, use) {
		return use(async (atSecond) => {
			const videoElement = getFakeVideo();
			await videoElement.evaluate<void, { atSecond: number }, FakeHTMLVideoElement>(
				(element, { atSecond }) => {
					element.currentTime = atSecond;
				},
				{ atSecond },
			);
		});
	},
});
