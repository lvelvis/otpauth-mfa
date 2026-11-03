import jsQR from "jsqr";
import { parseOtpAuthUri } from "./otpauth.js";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_CANVAS_DIMENSION = 4096;

const fileInput = document.querySelector("#file-input");
const dropZone = document.querySelector("#drop-zone");
const clearButton = document.querySelector("#clear-button");
const previewPanel = document.querySelector("#preview-panel");
const imagePreview = document.querySelector("#image-preview");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const status = document.querySelector("#status");
const resultCard = document.querySelector("#result-card");
const secretOutput = document.querySelector("#secret-output");
const toggleSecretButton = document.querySelector("#toggle-secret");
const copySecretButton = document.querySelector("#copy-secret");
const copyUriButton = document.querySelector("#copy-uri");
const resultType = document.querySelector("#result-type");
const issuerOutput = document.querySelector("#issuer-output");
const accountOutput = document.querySelector("#account-output");
const algorithmOutput = document.querySelector("#algorithm-output");
const settingsLabel = document.querySelector("#settings-label");
const settingsOutput = document.querySelector("#settings-output");
const canvas = document.querySelector("#decode-canvas");

let previewUrl = "";
let decodedUri = "";
let processingId = 0;

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status";
  if (type) {
    status.classList.add(`is-${type}`);
  }
}

function revokePreviewUrl() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = "";
  }
}

function clearCanvas() {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

function resetResult() {
  decodedUri = "";
  secretOutput.value = "";
  secretOutput.type = "password";
  toggleSecretButton.textContent = "显示";
  issuerOutput.textContent = "—";
  accountOutput.textContent = "—";
  algorithmOutput.textContent = "SHA1";
  resultType.textContent = "TOTP";
  settingsLabel.textContent = "位数 / 周期";
  settingsOutput.textContent = "6 位 / 30 秒";
  resultCard.hidden = true;
}

function resetAll() {
  processingId += 1;
  fileInput.value = "";
  revokePreviewUrl();
  imagePreview.removeAttribute("src");
  fileName.textContent = "";
  fileSize.textContent = "";
  previewPanel.hidden = true;
  clearButton.hidden = true;
  dropZone.hidden = false;
  dropZone.setAttribute("aria-busy", "false");
  clearCanvas();
  resetResult();
  setStatus("等待选择图片");
}

function renderResult(result) {
  secretOutput.value = result.secret;
  decodedUri = result.uri;
  issuerOutput.textContent = result.issuer || "未提供";
  accountOutput.textContent = result.account;
  algorithmOutput.textContent = result.algorithm;
  resultType.textContent = result.type;

  if (result.type === "HOTP") {
    settingsLabel.textContent = "位数 / 计数器";
    settingsOutput.textContent = `${result.digits} 位 / ${result.counter}`;
  } else if (result.type === "TOTP") {
    settingsLabel.textContent = "位数 / 周期";
    settingsOutput.textContent = `${result.digits} 位 / ${result.period} 秒`;
  } else {
    settingsLabel.textContent = "口令位数";
    settingsOutput.textContent = `${result.digits} 位`;
  }

  resultCard.hidden = false;
}

async function copyText(value, button, successText) {
  const originalText = button.textContent;
  let temporaryInput;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      temporaryInput = document.createElement("textarea");
      temporaryInput.value = value;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.appendChild(temporaryInput);
      temporaryInput.select();

      if (!document.execCommand("copy")) {
        throw new Error("浏览器拒绝复制操作");
      }
    }

    button.textContent = successText;
  } catch {
    setStatus("复制失败，请显示密钥后手动复制", "error");
  } finally {
    temporaryInput?.remove();
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  }
}

async function decodeFile(file) {
  const currentProcessingId = ++processingId;

  resetResult();

  if (!file.type.startsWith("image/")) {
    setStatus("请选择有效的图片文件", "error");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setStatus("图片超过 15 MB，请压缩后重试", "error");
    return;
  }

  revokePreviewUrl();
  previewUrl = URL.createObjectURL(file);
  imagePreview.src = previewUrl;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  previewPanel.hidden = false;
  clearButton.hidden = false;
  dropZone.hidden = true;
  dropZone.setAttribute("aria-busy", "true");
  setStatus("正在本地读取并解析二维码…", "loading");

  let bitmap;

  try {
    bitmap = await createImageBitmap(file);
    if (currentProcessingId !== processingId) {
      return;
    }

    const scale = Math.min(
      1,
      MAX_CANVAS_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = width;
    canvas.height = height;
    context.drawImage(bitmap, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const qrCode = jsQR(imageData.data, width, height, {
      inversionAttempts: "attemptBoth",
    });

    if (!qrCode?.data) {
      throw new Error("图片中没有识别到二维码，请使用清晰、完整的原图");
    }

    const result = parseOtpAuthUri(qrCode.data);
    renderResult(result);
    setStatus("解析完成；所有处理均在当前浏览器中进行", "success");
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    if (currentProcessingId !== processingId) {
      return;
    }

    const message =
      error instanceof Error ? error.message : "解析失败，请更换图片后重试";
    setStatus(message, "error");
  } finally {
    bitmap?.close();
    clearCanvas();
    dropZone.setAttribute("aria-busy", "false");
  }
}

fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  if (file) {
    decodeFile(file);
  }
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) {
    decodeFile(file);
  }
});

clearButton.addEventListener("click", resetAll);

toggleSecretButton.addEventListener("click", () => {
  const shouldReveal = secretOutput.type === "password";
  secretOutput.type = shouldReveal ? "text" : "password";
  toggleSecretButton.textContent = shouldReveal ? "隐藏" : "显示";
});

copySecretButton.addEventListener("click", () => {
  copyText(secretOutput.value, copySecretButton, "已复制");
});

copyUriButton.addEventListener("click", () => {
  copyText(decodedUri, copyUriButton, "完整 URI 已复制");
});

window.addEventListener("beforeunload", () => {
  revokePreviewUrl();
  clearCanvas();
  resetResult();
});
