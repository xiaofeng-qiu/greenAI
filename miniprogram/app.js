const { setToken } = require("./utils/api.js");

App({
  onLaunch() {
    wx.login({
      success: (res) => {
        wx.request({
          url: "https://YOUR_API_HOST/auth/wechat",
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
