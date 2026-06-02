function readFileAsBase64(path: string): Promise<string> {
  return fetch(path)
    .then((r) => r.blob())
    .then((blob) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("file_read_failed"));
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => { throw new Error("file_read_failed"); });
}

export function chooseImageBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sourceType: ["album", "camera"],
      success: (res) => {
        const path = res.tempFilePaths[0];
        if (!path) {
          reject(new Error("no_image_selected"));
          return;
        }
        // compress to avoid 413 Request Entity Too Large (not available on H5)
        if (typeof uni.compressImage === "function") {
          uni.compressImage({
            src: path,
            quality: 90,
            success: (cres) => {
              readFileAsBase64(cres.tempFilePath).then(resolve).catch(reject);
            },
            fail: () => {
              readFileAsBase64(path).then(resolve).catch(reject);
            },
          });
        } else {
          readFileAsBase64(path).then(resolve).catch(reject);
        }
      },
      fail: () => reject(new Error("cancel")),
    });
  });
}
