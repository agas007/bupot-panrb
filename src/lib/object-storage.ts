import { createHash, createHmac } from "node:crypto";

type ObjectStorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  forcePathStyle: boolean;
};

const requiredStorageEnv = [
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
] as const;

const readStorageConfig = (): ObjectStorageConfig | null => {
  const values = Object.fromEntries(
    requiredStorageEnv.map((key) => [key, process.env[key]?.trim() || ""]),
  ) as Record<(typeof requiredStorageEnv)[number], string>;

  const configured = requiredStorageEnv.filter((key) => values[key]);
  if (configured.length === 0) return null;

  const missing = requiredStorageEnv.filter((key) => !values[key]);
  if (missing.length > 0) {
    throw new Error(`Incomplete object storage configuration: missing ${missing.join(", ")}`);
  }

  return {
    endpoint: `${/^[a-z][a-z\d+.-]*:\/\//i.test(values.S3_ENDPOINT) ? "" : "http://"}${values.S3_ENDPOINT.replace(/\/$/, "")}`,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    accessKeyId: values.S3_ACCESS_KEY,
    secretAccessKey: values.S3_SECRET_KEY,
    bucketName: values.S3_BUCKET_NAME,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() !== "false",
  };
};

export const getObjectStorageConfig = () => readStorageConfig();

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const hmac = (key: string | Buffer, value: string) =>
  createHmac("sha256", key).update(value).digest();

const encodePath = (value: string) =>
  value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const getObjectStorageRequest = async (
  method: "HEAD" | "GET" | "PUT" | "DELETE",
  objectKey?: string,
  body = "",
) => {
  const config = readStorageConfig();
  if (!config) return null;

  const endpoint = new URL(config.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = config.forcePathStyle ? endpoint.host : `${config.bucketName}.${endpoint.host}`;
  const bucketPath = config.forcePathStyle ? `/${config.bucketName}` : "";
  const objectPath = objectKey ? `/${objectKey}` : "";
  const pathname = `${endpoint.pathname.replace(/\/$/, "")}${bucketPath}${objectPath}` || "/";
  const canonicalUri = encodePath(pathname);
  const payloadHash = hash(body);
  const contentType = method === "PUT" ? "text/plain; charset=utf-8" : undefined;
  const canonicalHeaderEntries = [
    ["host", host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
    ...(contentType ? [["content-type", contentType]] : []),
  ].sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = canonicalHeaderEntries.map(([name, value]) => `${name}:${value}`).join("\n");
  const signedHeaders = canonicalHeaderEntries.map(([name]) => name).join(";");
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const url = new URL(endpoint);
  url.host = host;
  url.pathname = pathname;

  const response = await fetch(url, {
    method,
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...(contentType ? { "content-type": contentType } : {}),
      Authorization: authorization,
    },
    body: method === "PUT" ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  return { response, bucketName: config.bucketName };
};

export const checkObjectStorageConnection = async () => {
  const result = await getObjectStorageRequest("HEAD");
  if (!result) return null;

  return {
    ok: result.response.ok,
    status: result.response.status,
    bucketName: result.bucketName,
  };
};

export const runObjectStorageSmokeTest = async () => {
  const config = readStorageConfig();
  if (!config) return null;

  const objectKey = `__healthcheck/bupot-${Date.now()}.txt`;
  const expectedBody = `bupot-minio-healthcheck:${new Date().toISOString()}`;
  let uploaded = false;

  try {
    const put = await getObjectStorageRequest("PUT", objectKey, expectedBody);
    if (!put || !put.response.ok) {
      throw new Error(`MinIO upload failed with status ${put?.response.status ?? "unknown"}`);
    }
    uploaded = true;

    const get = await getObjectStorageRequest("GET", objectKey);
    if (!get || !get.response.ok) {
      throw new Error(`MinIO download failed with status ${get?.response.status ?? "unknown"}`);
    }
    const actualBody = await get.response.text();
    if (actualBody !== expectedBody) {
      throw new Error("MinIO download content did not match the uploaded test object");
    }

    return { bucketName: config.bucketName, objectKey, uploaded: true, downloaded: true, deleted: true };
  } finally {
    if (uploaded) {
      const deletion = await getObjectStorageRequest("DELETE", objectKey).catch(() => null);
      if (!deletion?.response.ok && deletion?.response.status !== 404) {
        console.error("[Object storage] Failed to delete smoke-test object:", deletion?.response.status);
      }
    }
  }
};
