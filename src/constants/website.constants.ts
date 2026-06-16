import type { Prisma } from "@prisma/client";

export const SELECT_WEBSITE_FIELDS = {
    id: true,
    name: true,
    status: true,
    source_template_id: true,
    thumbnail_url: true,
    created_at: true,
    updated_at: true,
    owner_id: true,
    institution_id: true,
    content: true,
    settings: {
        select: {
            id: true
        }
    },
    institution: {
        select: {
            name: true
        }
    }
} satisfies Prisma.WebsiteSelect;

// 30 days in milliseconds
export const DELETED_WEBSITE_RETENTION_TIME = 30 * 24 * 60 * 60 * 1000;

export const CREATE_WEB_LIMIT = {
    LIMIT: 20,
    WINDOW_SEC: 60 * 60 // 1hr
}

export const DUPLICATE_WEB_LIMIT = {
    LIMIT: 5,
    WINDOW_SEC: 60 * 60 // 1hr
}