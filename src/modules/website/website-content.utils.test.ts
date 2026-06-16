import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addWebsiteDomain,
  duplicateWebsiteContent,
  normalizeWebsiteContent,
  publishWebsiteContent,
  verifyWebsiteDomain,
} from './website-content.utils.js';

test('normalizeWebsiteContent seeds builder metadata and draft version', () => {
  const content = normalizeWebsiteContent({
    pages: [{ id: 'home', name: 'Home' }],
    activePageId: 'home',
    templateId: 'blank',
  });

  assert.equal(content.builderMeta.versions.length, 1);
  assert.equal(content.builderMeta.versions[0]?.kind, 'draft');
  assert.equal(content.builderMeta.currentDraftVersionId, content.builderMeta.versions[0]?.id ?? null);
});

test('publishWebsiteContent creates published version, domain and deployment', () => {
  const result = publishWebsiteContent({
    pages: [{ id: 'home', name: 'Home' }],
    activePageId: 'home',
    templateId: 'business',
  }, {
    websiteId: 'cktestsiteid',
    subdomain: 'alpha-site',
    siteHost: 'buildora.app',
  });

  assert.equal(result.response.success, true);
  assert.equal(result.content.builderMeta.currentPublishedVersionId !== null, true);
  assert.equal(result.content.builderMeta.domains[0]?.domain, 'alpha-site.buildora.app');
  assert.equal(result.content.builderMeta.deployments.length, 1);
});

test('duplicateWebsiteContent resets publish metadata and keeps pages', () => {
  const published = publishWebsiteContent({
    pages: [{ id: 'home', name: 'Home' }],
    activePageId: 'home',
  }, {
    websiteId: 'cksourceid',
    customDomain: 'example.com',
  }).content;

  const duplicate = duplicateWebsiteContent(published);

  assert.equal(duplicate.pages.length, 1);
  assert.equal(duplicate.builderMeta.currentPublishedVersionId, null);
  assert.equal(duplicate.builderMeta.domains.length, 0);
  assert.equal(duplicate.builderMeta.deployments.length, 0);
});

test('custom domain verification activates the pending domain', async () => {
  const withDomain = addWebsiteDomain({ pages: [] }, 'example.com', 'buildora.app');
  const verified = await verifyWebsiteDomain(withDomain.content, 'example.com');

  assert.equal(verified.domain?.status, 'active');
  assert.equal(verified.domain?.sslEnabled, true);
});