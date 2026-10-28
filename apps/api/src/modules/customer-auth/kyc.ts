import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type KycDocumentType = "aadhaar" | "pan";
export type KycStatus = "PENDING" | "IN_PROGRESS" | "VERIFIED" | "REJECTED";

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function isValidVerhoeff(value: string): boolean {
  let checksum = 0;
  const reversed = value.split("").reverse();
  for (let index = 0; index < reversed.length; index += 1) {
    const digit = Number(reversed[index]);
    const permuted = VERHOEFF_P[index % 8][digit];
    checksum = VERHOEFF_D[checksum][permuted];
  }
  return VERHOEFF_INV[checksum] === 0;
}

export function validateKycDocument(type: unknown, value: unknown): {
  documentType: KycDocumentType;
  documentNumber: string;
} {
  if (type !== "aadhaar" && type !== "pan") {
    throw new Error("Choose Aadhaar Card or PAN Card.");
  }
  if (typeof value !== "string") throw new Error("Enter the selected document number.");
  const documentNumber = type === "aadhaar"
    ? value.replace(/\s/g, "")
    : value.trim().toUpperCase();
  if (type === "aadhaar") {
    if (!/^[2-9]\d{11}$/.test(documentNumber) || !isValidVerhoeff(documentNumber)) {
      throw new Error("Enter a valid 12-digit Aadhaar number.");
    }
  } else if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(documentNumber)) {
    throw new Error("Enter a valid PAN number in the format ABCDE1234F.");
  }
  return { documentType: type, documentNumber };
}

function encryptionKey(): Buffer {
  const value = process.env.KYC_ENCRYPTION_KEY;
  if (!value || !/^[\da-fA-F]{64}$/.test(value)) {
    throw new Error("KYC_ENCRYPTION_KEY must be configured as 64 hexadecimal characters.");
  }
  return Buffer.from(value, "hex");
}

export function encryptKycDocument(value: string): {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptKycDocument(ciphertext: Buffer, iv: Buffer, authTag: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
