const { BASE_URL, setToken } = require("./utils/api.js");

App({
  onLaunch() {
    wx.login({
      success: (res) => {
        wx.request({
          url: `${BASE_URL}/auth/wechat`,
          method: "POST",
          data: { code: res.code },
          header: { "Content-Type": "application/json" },
          success: (r) => {
            if (r.statusCode === 200 && r.data && r.data.token) {
              setToken(r.data.token);
            } else {
              console.error("auth failed", r.statusCode);
            }
          },
          fail: console.error,
        });
      },
    });
  },
});
