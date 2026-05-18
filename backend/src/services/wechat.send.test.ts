import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from "undici";
import { getAccessToken, sendSubscribeMessage } from "./wechat.js";

describe("sendSubscribeMessage", () => {
  let agent: MockAgent;
  let previousDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeAll(() => {
    previousDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  afterAll(() => {
    agent.close();
    setGlobalDispatcher(previousDispatcher);
  });

  it("posts JSON to wechat API", async () => {
    const pool = agent.get("https://api.weixin.qq.com");
    pool
      .intercept({
        path: /\/cgi-bin\/message\/subscribe\/send/,
        method: "POST",
      })
      .reply(200, { errcode: 0, errmsg: "ok" });

    const res = await sendSubscribeMessage({
      accessToken: "tok",
      touser: "openid",
      templateId: "tpl",
      page: "pages/index/index",
      data: { thing1: { value: "浇水" } },
    });
    expect(res.errcode).toBe(0);
  });
});

describe("getAccessToken", () => {
  let agent: MockAgent;
  let previousDispatcher: ReturnType<typeof getGlobalDispatcher>;

  beforeAll(() => {
    previousDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });

  afterAll(() => {
    agent.close();
    setGlobalDispatcher(previousDispatcher);
  });

  it("returns access_token from wechat API", async () => {
    const pool = agent.get("https://api.weixin.qq.com");
    pool
      .intercept({ path: /\/cgi-bin\/token/, method: "GET" })
      .reply(200, { access_token: "abc123", expires_in: 7200 });

    const token = await getAccessToken("app", "secret");
    expect(token).toBe("abc123");
  });
});
