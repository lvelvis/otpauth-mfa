const BASE32_PATTERN = /^[A-Z2-7]+=*$/;
const SUPPORTED_ALGORITHMS = new Set(["SHA1", "SHA256", "SHA512"]);

function decodeLabel(pathname) {
  const encodedLabel = pathname.replace(/^\/+/, "");

  try {
    return decodeURIComponent(encodedLabel);
  } catch {
    throw new Error("二维码中的账户标签编码无效");
  }
}

function readPositiveInteger(value, fallback, fieldName) {
  if (value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${fieldName} 参数无效`);
  }

  return number;
}

function readNonNegativeInteger(value, fallback, fieldName) {
  if (value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${fieldName} 参数无效`);
  }

  return number;
}

export function parseOtpAuthUri(value) {
  const rawUri = value.trim();
  let uri;

  try {
    uri = new URL(rawUri);
  } catch {
    throw new Error("二维码内容不是有效的 URI");
  }

  if (uri.protocol.toLowerCase() !== "otpauth:") {
    throw new Error("二维码不是 otpauth MFA 二维码");
  }

  let type = uri.hostname.toLowerCase();
  let labelPath = uri.pathname;

  if (!["totp", "hotp"].includes(type)) {
    const pathTypeMatch = labelPath.match(/^\/+(totp|hotp)(?:\/|$)/i);
    const queryType = uri.searchParams.get("type")?.toLowerCase();

    if (pathTypeMatch) {
      type = pathTypeMatch[1].toLowerCase();
      labelPath = labelPath.slice(pathTypeMatch[0].length);
    } else if (queryType && ["totp", "hotp"].includes(queryType)) {
      type = queryType;
    } else {
      type = "otp";
    }
  }

  const rawSecret = uri.searchParams.get("secret");
  if (!rawSecret) {
    throw new Error("二维码中缺少 secret 密钥");
  }

  const secret = rawSecret.replace(/[\s-]/g, "").toUpperCase();
  if (!BASE32_PATTERN.test(secret)) {
    throw new Error("secret 不是有效的 Base32 密钥");
  }

  const label = decodeLabel(labelPath);
  const separatorIndex = label.indexOf(":");
  const labelIssuer =
    separatorIndex >= 0 ? label.slice(0, separatorIndex).trim() : "";
  const account =
    separatorIndex >= 0
      ? label.slice(separatorIndex + 1).trim()
      : label.trim();

  const issuer = uri.searchParams.get("issuer")?.trim() || labelIssuer;
  const algorithm = (
    uri.searchParams.get("algorithm") || "SHA1"
  ).toUpperCase();

  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new Error(`不支持的 TOTP 算法：${algorithm}`);
  }

  const digits = readPositiveInteger(
    uri.searchParams.get("digits"),
    6,
    "digits",
  );
  if (![6, 7, 8].includes(digits)) {
    throw new Error("仅支持 6、7 或 8 位 OTP 口令");
  }

  const result = {
    account: account || "未提供",
    algorithm,
    digits,
    issuer,
    secret,
    type: type.toUpperCase(),
    uri: rawUri,
  };

  if (type === "totp") {
    result.period = readPositiveInteger(
      uri.searchParams.get("period"),
      30,
      "period",
    );
  } else if (type === "hotp") {
    result.counter = readNonNegativeInteger(
      uri.searchParams.get("counter"),
      0,
      "counter",
    );
  }

  return result;
}
