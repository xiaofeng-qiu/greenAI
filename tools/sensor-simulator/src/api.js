export async function request({ path, method = "GET", data }) {
  const url = path.startsWith("/") ? path : `/${path}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw { statusCode: response.status, data: body };
    }
    return body;
  } catch (error) {
    if (error?.statusCode) throw error;
    throw {
      statusCode: 0,
      data: null,
      errMsg: error instanceof Error ? error.message : String(error),
    };
  }
}
