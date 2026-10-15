/** Exported for both server validation and client upload hints. */
export const KYC_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_IMAGE_MAX_MB = 5;
export const KYC_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const KYC_FILE_MAX_MB = 10;
export const KYC_CUSTOMER_MAX_FILES = 40;
export const KYC_CUSTOMER_MAX_BYTES = 50 * 1024 * 1024;
export const kycFileMaxBytes=(type:string)=>type.startsWith('image/')?KYC_IMAGE_MAX_BYTES:KYC_FILE_MAX_BYTES;
