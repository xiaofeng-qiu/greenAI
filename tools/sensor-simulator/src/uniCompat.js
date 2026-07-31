let toastTimer;

function showToast({ title = "" }) {
  let toast = document.querySelector("#sensor-simulator-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sensor-simulator-toast";
    Object.assign(toast.style, {
      position: "fixed",
      left: "50%",
      bottom: "36px",
      zIndex: "2000",
      maxWidth: "min(420px, calc(100vw - 40px))",
      padding: "10px 16px",
      borderRadius: "8px",
      color: "#fff",
      background: "rgba(20, 32, 25, 0.9)",
      boxShadow: "0 8px 24px rgba(15, 35, 23, 0.2)",
      font: '13px/1.4 Inter, "Segoe UI", sans-serif',
      transform: "translateX(-50%)",
    });
    document.body.appendChild(toast);
  }
  toast.textContent = title;
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 2200);
}

function showModal({ title = "", content = "", showCancel = true, success }) {
  const message = title ? `${title}\n\n${content}` : content;
  if (!showCancel) {
    window.alert(message);
    success?.({ confirm: true, cancel: false });
    return;
  }
  const confirmed = window.confirm(message);
  success?.({ confirm: confirmed, cancel: !confirmed });
}

globalThis.uni = {
  showModal,
  showToast,
};
