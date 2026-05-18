import { request } from "undici";

export type JsCode2SessionResult = {
  openid: string;
  session_key: string;
  unionid?: string;
};

export async function jscode2session(input: {
  appId: string;
  secret: string;
  code: string;
}): Promise<JsCode2SessionResult> {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", input.appId);
  url.searchParams.set("secret", input.secret);
  url.searchParams.set("js_code", input.code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await request(url);
  const body = (await res.body.json()) as Record<string, unknown>;
  if (body.errcode) {
    throw new Error(
      `wechat error: ${String(body.errcode)} ${String(body.errmsg ?? "")}`
    );
  }
  return body as unknown as JsCode2SessionResult;
}

export async function getAccessToken(
  appId: string,
  secret: string
): Promise<string> {
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  const res = await request(url);
  const body = (await res.body.json()) as Record<string, unknown>;
  if (body.errcode) {
    throw new Error(
      `wechat token error: ${String(body.errcode)} ${String(body.errmsg ?? "")}`
    );
  }
  return String(body.access_token);
}

export type SubscribeSendInput = {
  accessToken: string;
  touser: string;
  templateId: string;
  page: string;
  data: Record<string, { value: string }>;
};

export async function sendSubscribeMessage(
  input: SubscribeSendInput
): Promise<{ errcode: number; errmsg: string }> {
  const url = new URL(
    "https://api.weixin.qq.com/cgi-bin/message/subscribe/send"
  );
  url.searchParams.set("access_token", input.accessToken);
  const res = await request(url, {
    method: "POST",
    body: JSON.stringify({
      touser: input.touser,
      template_id: input.templateId,
      page: input.page,
      data: input.data,
      miniprogram_state: "formal",
    }),
    headers: { "content-type": "application/json" },
  });
  return (await res.body.json()) as { errcode: number; errmsg: string };
}
