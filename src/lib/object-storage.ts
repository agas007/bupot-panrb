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

export const checkObjectStorageConnection = async () => {
  const config = readStorageConfig();
  if (!config) return null;

  const endpoint = new URL(config.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = config.forcePathStyle ? endpoint.host : `${config.bucketName}.${endpoint.host}`;
  const bucketPath = config.forcePathStyle ? `/${config.bucketName}` : "";
  const pathname = `${endpoint.pathname.replace(/\/$/, "")}${bucketPath}` || "/";
  const canonicalUri = encodePath(pathname);
  const payloadHash = hash("");
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "HEAD",
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
    method: "HEAD",
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });

  return {
    ok: response.ok,
    status: response.status,
    bucketName: config.bucketName,
  };
};
