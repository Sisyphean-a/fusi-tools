import * as assert from "assert";
import { FeatureLoader } from "../featureLoader";
import { FeatureModule } from "../types/feature";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

suite("FeatureLoader", () => {
  test("activateAll should activate modules in parallel", async () => {
    const loader = new FeatureLoader();
    const context = { subscriptions: [] } as any;

    const createSlowModule = (name: string): FeatureModule => ({
      name,
      async activate() {
        await sleep(80);
        return { success: true };
      },
    });

    loader.register(createSlowModule("m1"));
    loader.register(createSlowModule("m2"));

    const start = Date.now();
    await loader.activateAll(context);
    const elapsed = Date.now() - start;

    assert.ok(
      elapsed < 140,
      `expected parallel activation under 140ms, got ${elapsed}ms`
    );
  });
});
