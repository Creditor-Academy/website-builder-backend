import crypto from 'crypto';

const DEFAULT_SITE_HOST = process.env.PUBLIC_SITE_HOST || 'buildora.app';
const SERVER_IP = process.env.SERVER_IP || '0.0.0.0';

type VersionSnapshot = {
  pages: any[];
  activePageId: string | null;
  templateId: string;
};

type WebsiteVersionRecord = {
  id: string;
  kind: 'draft' | 'published';
  label: string;
  createdAt: string;
  updatedAt?: string;
  snapshot: VersionSnapshot;
};

type WebsiteDomainRecord = {
  id: string;
  domain: string;
  type: 'subdomain' | 'custom';
  status: 'active' | 'pending' | 'error';
  sslEnabled: boolean;
  primary: boolean;
  dnsRecords?: {
    A?: string;
    CNAME?: string;
    TXT?: string[];
    verified?: boolean;
  };
  addedAt: string;
};

type WebsiteDeploymentRecord = {
  id: string;
  versionId: string;
  status: 'pending' | 'building' | 'uploading' | 'active' | 'failed' | 'rolled_back';
  url: string;
  domain: string;
  artifactPrefix: string;
  publishedAt: string;
  startedAt: string;
  finishedAt: string | null;
  deployedBy: string;
  errorMessage: string | null;
  fileCount: number;
  totalSize: number;
  sslEnabled: boolean;
  logs: string[];
};

type WebsiteBuilderMeta = {
  currentDraftVersionId: string | null;
  currentPublishedVersionId: string | null;
  publishedUrl: string | null;
  versions: WebsiteVersionRecord[];
  domains: WebsiteDomainRecord[];
  deployments: WebsiteDeploymentRecord[];
  lastSavedAt: string;
};

type WebsiteContent = {
  pages: any[];
  activePageId: string | null;
  templateId: string;
  builderMeta: WebsiteBuilderMeta;
  [key: string]: any;
};

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? {}));

const buildTemplatePage = (
  pageLike: Record<string, any>,
  fallback: {
    name: string;
    description?: string | undefined;
    navbar?: unknown;
    footer?: unknown;
    globalStyles?: unknown;
  },
) => ({
  id: crypto.randomUUID(),
  name: typeof pageLike.name === 'string' && pageLike.name.trim() ? pageLike.name : 'Home',
  slug: typeof pageLike.slug === 'string' && pageLike.slug.trim() ? pageLike.slug : '/',
  sections: Array.isArray(pageLike.sections) ? deepClone(pageLike.sections) : [],
  meta: pageLike.meta && typeof pageLike.meta === 'object'
    ? deepClone(pageLike.meta)
    : {
        title: fallback.name,
        description: fallback.description || '',
      },
  navbar: deepClone(pageLike.navbar ?? fallback.navbar ?? {}),
  footer: deepClone(pageLike.footer ?? fallback.footer ?? {}),
  globalStyles: deepClone(pageLike.globalStyles ?? pageLike.global_styles ?? fallback.globalStyles ?? {}),
});

const createSnapshot = (content: Record<string, any>): VersionSnapshot => {
  const pages = Array.isArray(content.pages) ? deepClone(content.pages) : [];
  const activePageId = content.activePageId ?? pages[0]?.id ?? null;
  const templateId = typeof content.templateId === 'string' ? content.templateId : 'blank';

  return {
    pages,
    activePageId,
    templateId,
  };
};

const createVersionRecord = (kind: 'draft' | 'published', label: string, snapshot: VersionSnapshot): WebsiteVersionRecord => ({
  id: crypto.randomUUID(),
  kind,
  label,
  createdAt: new Date().toISOString(),
  snapshot,
});

const ensureBuilderMeta = (content: Record<string, any>): WebsiteBuilderMeta => {
  const now = new Date().toISOString();
  const snapshot = createSnapshot(content);
  const existingMeta = content.builderMeta && typeof content.builderMeta === 'object'
    ? deepClone(content.builderMeta)
    : {};

  const versions = Array.isArray(existingMeta.versions) ? existingMeta.versions : [];
  const domains = Array.isArray(existingMeta.domains) ? existingMeta.domains : [];
  const deployments = Array.isArray(existingMeta.deployments) ? existingMeta.deployments : [];

  let currentDraftVersionId = typeof existingMeta.currentDraftVersionId === 'string'
    ? existingMeta.currentDraftVersionId
    : null;

  let nextVersions = versions;
  if (!currentDraftVersionId) {
    const draftVersion = createVersionRecord('draft', 'Current Draft', snapshot);
    currentDraftVersionId = draftVersion.id;
    nextVersions = [draftVersion, ...versions.filter((item: WebsiteVersionRecord) => item.kind !== 'draft')];
  }

  nextVersions = nextVersions.map((item: WebsiteVersionRecord) => {
    if (item.id !== currentDraftVersionId) {
      return item;
    }

    return {
      ...item,
      kind: 'draft',
      label: 'Current Draft',
      snapshot,
      updatedAt: now,
    };
  });

  return {
    currentDraftVersionId,
    currentPublishedVersionId: typeof existingMeta.currentPublishedVersionId === 'string'
      ? existingMeta.currentPublishedVersionId
      : null,
    publishedUrl: typeof existingMeta.publishedUrl === 'string' ? existingMeta.publishedUrl : null,
    versions: nextVersions,
    domains,
    deployments,
    lastSavedAt: now,
  };
};

export const normalizeWebsiteContent = (content: unknown): WebsiteContent => {
  const base = content && typeof content === 'object' ? deepClone(content as Record<string, any>) : {};
  const snapshot = createSnapshot(base);

  return {
    ...base,
    pages: snapshot.pages,
    activePageId: snapshot.activePageId,
    templateId: snapshot.templateId,
    builderMeta: ensureBuilderMeta({
      ...base,
      pages: snapshot.pages,
      activePageId: snapshot.activePageId,
      templateId: snapshot.templateId,
    }),
  };
};

export const duplicateWebsiteContent = (content: unknown): WebsiteContent => {
  const normalized = normalizeWebsiteContent(content);
  const snapshot = createSnapshot(normalized);
  const draftVersion = createVersionRecord('draft', 'Current Draft', snapshot);

  return {
    ...normalized,
    builderMeta: {
      currentDraftVersionId: draftVersion.id,
      currentPublishedVersionId: null,
      publishedUrl: null,
      versions: [draftVersion],
      domains: [],
      deployments: [],
      lastSavedAt: new Date().toISOString(),
    },
  };
};

export const createWebsiteContentFromTemplate = (template: {
  id: string;
  name: string;
  description?: string | null;
  global_styles?: unknown;
  navbar?: unknown;
  footer?: unknown;
  home_layout?: unknown;
}) => {
  const homeLayout = template.home_layout && typeof template.home_layout === 'object'
    ? deepClone(template.home_layout as Record<string, any>)
    : {};

  const rawPages = Array.isArray(homeLayout.pages)
    ? homeLayout.pages
    : [homeLayout];

  const pages = rawPages
    .filter((page) => page && typeof page === 'object')
    .map((page) => buildTemplatePage(page as Record<string, any>, {
      name: template.name,
      description: template.description ?? undefined,
      navbar: template.navbar,
      footer: template.footer,
      globalStyles: template.global_styles,
    }));

  const normalizedPages = pages.length > 0
    ? pages
    : [buildTemplatePage({}, {
        name: template.name,
        description: template.description ?? undefined,
        navbar: template.navbar,
        footer: template.footer,
        globalStyles: template.global_styles,
      })];

  return normalizeWebsiteContent({
    pages: normalizedPages,
    activePageId: normalizedPages[0]?.id ?? null,
    templateId: template.id,
    sourceTemplateId: template.id,
    templateName: template.name,
  });
};

export const getWebsiteVersions = (content: unknown) => normalizeWebsiteContent(content).builderMeta.versions;

export const getWebsiteDomains = (content: unknown) => normalizeWebsiteContent(content).builderMeta.domains;

const buildDefaultSubdomain = (websiteId: string, siteHost: string) => `${websiteId.slice(0, 8)}.${siteHost}`;

const upsertDomain = (domains: WebsiteDomainRecord[], domainEntry: WebsiteDomainRecord) => {
  const filtered = domains.filter((item) => item.domain !== domainEntry.domain);
  const hasPrimary = filtered.some((item) => item.primary);

  return [
    {
      ...domainEntry,
      primary: domainEntry.primary || !hasPrimary,
    },
    ...filtered.map((item) => ({
      ...item,
      primary: domainEntry.primary ? false : item.primary,
    })),
  ];
};

export const addWebsiteDomain = (content: unknown, domain: string, siteHost = DEFAULT_SITE_HOST): { content: WebsiteContent; domain: WebsiteDomainRecord } => {
  const normalized = normalizeWebsiteContent(content);
  const isSubdomain = domain.endsWith(`.${siteHost}`);

  const domainEntry: WebsiteDomainRecord = {
    id: domain,
    domain,
    type: isSubdomain ? 'subdomain' : 'custom',
    status: isSubdomain ? 'active' : 'pending',
    sslEnabled: isSubdomain,
    primary: normalized.builderMeta.domains.length === 0,
    dnsRecords: isSubdomain
      ? {}
      : {
          A: SERVER_IP,
          CNAME: siteHost,
          TXT: [`site-verification=${domain}`],
        },
    addedAt: new Date().toISOString(),
  };

  normalized.builderMeta.domains = upsertDomain(normalized.builderMeta.domains, domainEntry);
  return { content: normalized, domain: domainEntry };
};

export const removeWebsiteDomain = (content: unknown, domain: string) => {
  const normalized = normalizeWebsiteContent(content);
  const remaining = normalized.builderMeta.domains.filter((item) => item.domain !== domain);

  normalized.builderMeta.domains = remaining.map((item, index) => ({
    ...item,
    primary: index === 0,
  }));

  if (normalized.builderMeta.publishedUrl === `https://${domain}`) {
    normalized.builderMeta.publishedUrl = null;
  }

  return normalized;
};



export const publishWebsiteContent = (
  content: unknown,
  {
    websiteId,
    subdomain,
    customDomain,
    siteHost = DEFAULT_SITE_HOST,
    deploymentRecord,
  }: {
    websiteId: string;
    subdomain?: string;
    customDomain?: string;
    siteHost?: string;
    deploymentRecord?: WebsiteDeploymentRecord;
  },
) => {
  const normalized = normalizeWebsiteContent(content);
  const snapshot = createSnapshot(normalized);
  const publishedAt = new Date().toISOString();
  const hostname = customDomain || (subdomain ? `${subdomain}.${siteHost}` : buildDefaultSubdomain(websiteId, siteHost));

  const publishedVersion = createVersionRecord('published', `Published ${publishedAt}`, snapshot);
  normalized.builderMeta.currentPublishedVersionId = publishedVersion.id;
  normalized.builderMeta.versions = [publishedVersion, ...normalized.builderMeta.versions];

  const domainResult = addWebsiteDomain(normalized, hostname, siteHost);
  const primaryDomain = {
    ...domainResult.domain,
    status: 'active' as const,
    sslEnabled: true,
    primary: true,
  };

  domainResult.content.builderMeta.domains = upsertDomain(domainResult.content.builderMeta.domains, primaryDomain);

  const url = deploymentRecord?.url || `https://${hostname}`;
  domainResult.content.builderMeta.publishedUrl = url;

  if (deploymentRecord) {
    domainResult.content.builderMeta.deployments = [
      deploymentRecord,
      ...domainResult.content.builderMeta.deployments,
    ];
  } else {
    domainResult.content.builderMeta.deployments = [
      {
        id: crypto.randomUUID(),
        versionId: publishedVersion.id,
        status: 'active',
        url,
        domain: hostname,
        artifactPrefix: '',
        publishedAt,
        startedAt: publishedAt,
        finishedAt: publishedAt,
        deployedBy: 'system',
        errorMessage: null,
        fileCount: 0,
        totalSize: 0,
        sslEnabled: true,
        logs: [],
      },
      ...domainResult.content.builderMeta.deployments,
    ];
  }

  return {
    content: domainResult.content,
    publishedVersionId: publishedVersion.id,
    response: {
      success: true,
      url,
      publishedAt,
      sslEnabled: true,
      status: (deploymentRecord?.status || 'active') as 'active' | 'pending' | 'failed',
    },
  };
};