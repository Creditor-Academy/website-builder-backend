export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const MAX_FILES_COUNT = 10;

export const ALLOWED_FILE_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/mov", "video/webm"
];

// 30 days in milliseconds
export const DELETED_ASSET_RETENTION_TIME = 30 * 24 * 60 * 60 * 1000;

export const UPLOAD_SINGLE_LIMIT = {
  LIMIT: 20,
  WINDOW_SEC: 24 * 60 * 60 // 1 day
}

export const UPLOAD_MULTIPLE_LIMIT = {
  LIMIT: 5,
  WINDOW_SEC: 24 * 60 * 60 // 1 day
}