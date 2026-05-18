const BASE_URL = "https://YOUR_API_HOST";

function getToken() {
  return wx.getStorageSync("token") || "";
}

function request({ path, method = "GET", data }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error("http_" + res.statusCode));
      },
      fail: reject,
    });
  });
}

function setToken(token) {
  wx.setStorageSync("token", token);
}

module.exports = { request, setToken };
