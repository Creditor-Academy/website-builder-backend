import crypto from 'crypto';

type SectionContent = Record<string, any>;
type SectionStyles = Record<string, any>;

interface Section {
  id: string;
  type: string;
  name?: string;
  visible?: boolean;
  variant?: string;
  content: SectionContent;
  styles?: SectionStyles;
}

interface PageData {
  id: string;
  name: string;
  slug: string;
  sections: Section[];
  meta?: { title?: string; description?: string };
  navbar?: Record<string, any>;
  footer?: Record<string, any>;
  globalStyles?: Record<string, any>;
}

interface GeneratedFile {
  filename: string;
  html: string;
}

/* ─── Utility helpers ──────────────────────────────────────────────── */

/** Rewrite localhost asset URLs to S3 URLs for production */
const rewriteAssetUrls = (html: string): string => {
  const bucket = (process.env.S3_BUCKET || '').trim();
  const region = (process.env.S3_REGION || 'us-east-1').trim();
  if (!bucket) return html;
  const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`;
  // Replace http://localhost:XXXX/uploads/ with S3 base URL
  return html.replace(/http:\/\/localhost:\d+\/uploads\//g, `${s3Base}/`);
};

const esc = (text: unknown): string => {
  if (text == null) return '';
  return String(text)
    .replace(/&nbsp;/g, '\u00A0')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/** Preserve HTML formatting the user applied (colors, bold, italic) */
const richText = (text: unknown): string => {
  if (text == null) return '';
  return String(text).replace(/&nbsp;/g, '\u00A0');
};

const cssFromStyles = (styles: SectionStyles | undefined): string => {
  if (!styles) return '';
  const parts: string[] = [];
  if (styles.backgroundColor && styles.backgroundColor !== 'transparent') parts.push(`background-color:${styles.backgroundColor}`);
  if (styles.useGradient && styles.backgroundGradient) parts.push(`background:${styles.backgroundGradient}`);
  if (styles.padding) parts.push(`padding:${styles.padding}`);
  if (styles.minHeight) parts.push(`min-height:${styles.minHeight}`);
  return parts.join(';');
};

/** Rewrite internal page links to relative paths for static site */
const rewriteHref = (href: string, pageSlugs: Set<string>, currentSlug: string): string => {
  if (!href || href === '#' || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
  const clean = href.replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '' || clean === '/') {
    const depth = currentSlug === '' ? 0 : 1;
    return depth === 0 ? './index.html' : '../index.html';
  }
  if (pageSlugs.has(clean)) {
    const depth = currentSlug === '' ? 0 : 1;
    const prefix = depth === 0 ? './' : '../';
    return `${prefix}${clean}/index.html`;
  }
  return href;
};

/* ─── Google Fonts import (all fonts used by preview components) ──── */

const FONT_IMPORTS = `
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&family=Fraunces:ital,wght@0,300;0,700;0,900;1,400;1,700&family=Geist:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=Newsreader:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Sora:wght@300;400;500;600;700;800&family=DM+Serif+Display:ital@0;1&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Epilogue:wght@300;400;500;600&family=Outfit:wght@300;400;500;600&family=Syne:wght@400;500;700&display=swap" rel="stylesheet"/>
`;

/* ─── Accent color palette (shared across sections) ──────────────── */

const ACCENTS = ['#E11D48', '#0891B2', '#059669', '#7C3AED', '#D97706', '#0F766E'];
const TAG_COLORS = [
  { bg:'#eff6ff', border:'#bfdbfe', text:'#1e40af', dot:'#3b82f6' },
  { bg:'#f0fdf4', border:'#bbf7d0', text:'#166534', dot:'#22c55e' },
  { bg:'#faf5ff', border:'#e9d5ff', text:'#6b21a8', dot:'#a855f7' },
  { bg:'#fff7ed', border:'#fed7aa', text:'#9a3412', dot:'#f97316' },
  { bg:'#f0f9ff', border:'#bae6fd', text:'#075985', dot:'#0ea5e9' },
  { bg:'#fefce8', border:'#fde68a', text:'#854d0e', dot:'#eab308' },
];

/* ─── Component CSS (matches React preview components) ───────────── */

const NAVBAR_CSS = `
.nb-link{position:relative;font-family:'Geist',sans-serif;font-size:13px;font-weight:500;letter-spacing:.02em;text-decoration:none;transition:opacity .18s ease;padding-bottom:2px}
.nb-link::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:1.5px;background:currentColor;transform:scaleX(0);transform-origin:right;transition:transform .25s ease}
.nb-link:hover::after{transform:scaleX(1);transform-origin:left}
.nb-link:hover{opacity:.65}
.nb-cta{font-family:'Geist',sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;padding:10px 20px;border-radius:2px;transition:opacity .2s ease,transform .2s cubic-bezier(.34,1.56,.64,1);display:inline-flex;align-items:center;gap:6px}
.nb-cta:hover{opacity:.88;transform:translateY(-1px)}
.nb-inner{max-width:1240px;margin:0 auto;padding:0 40px;height:68px;display:flex;align-items:center;justify-content:space-between}
.nb-mob-link{font-family:'Geist',sans-serif;font-size:15px;font-weight:400;text-decoration:none;display:block;padding:14px 0;border-bottom:1px solid rgba(0,0,0,.07);letter-spacing:.01em;transition:padding-left .18s ease,opacity .18s ease}
.nb-mob-link:hover{padding-left:6px;opacity:.65}
.nb-mob-link:last-child{border-bottom:none}
@media(max-width:768px){.nb-inner{padding:0 20px;height:60px}.nb-desktop-links{display:none!important}}
`;

const FOOTER_CSS = `
.ft-social-btn{transition:background .22s ease,transform .22s cubic-bezier(.34,1.56,.64,1)}
.ft-social-btn:hover{background:rgba(255,255,255,.12)!important;transform:translateY(-3px)}
.ft-link{opacity:.45;transition:opacity .18s ease,padding-left .18s ease;display:inline-block;font-family:'Geist',sans-serif;font-size:14px;text-decoration:none;color:inherit}
.ft-link:hover{opacity:1;padding-left:4px}
.ft-bottom-link{opacity:.38;transition:opacity .18s ease;font-family:'Geist',sans-serif;font-size:12px;text-decoration:none;color:inherit}
.ft-bottom-link:hover{opacity:.75}
.ft-grid{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:0 56px}
@media(max-width:768px){.ft-grid{grid-template-columns:1fr;gap:48px 0}.ft-wrapper{padding-left:20px!important;padding-right:20px!important;padding-top:40px!important}}
`;

const HERO_CSS = `
.hero-section{position:relative;overflow:hidden;font-family:'DM Sans','Helvetica Neue',sans-serif}
.hero-dot-grid{position:absolute;inset:0;opacity:.35;background-image:radial-gradient(circle,rgba(0,0,0,.08) 1px,transparent 1px);background-size:28px 28px}
.hero-blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.08}
.hero-stats{display:flex;flex-wrap:wrap;gap:32px;padding-top:24px;margin-top:24px;border-top:1px solid rgba(0,0,0,.08)}
.hero-stat-val{font-size:1.8rem;font-weight:800;letter-spacing:-.02em}
.hero-stat-label{font-size:.7rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.5}
.hero-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border:1px solid rgba(0,0,0,.08);border-radius:999px;font-size:.78rem;font-weight:600;letter-spacing:.04em;margin-bottom:1.5rem;background:rgba(255,255,255,.6)}
.hero-eyebrow-dot{width:7px;height:7px;border-radius:50%;background:#10b981}
.hero-h1{font-size:clamp(2.2rem,5vw,3.8rem);font-weight:900;line-height:1.08;letter-spacing:-.03em;max-width:600px}
.hero-sub{font-size:1.05rem;line-height:1.7;opacity:.7;max-width:480px;margin-top:16px}
.hero-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:var(--radius,12px);font-weight:700;font-size:.9rem;text-decoration:none;transition:all .2s ease;border:none;cursor:pointer;box-shadow:var(--shadow,0 4px 16px rgba(0,0,0,.1))}
.hero-btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.15)}
.hero-btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:var(--radius,12px);font-weight:600;font-size:.9rem;text-decoration:none;transition:all .2s ease;cursor:pointer;border:1.5px solid rgba(0,0,0,.12);background:white}
.hero-btn-secondary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
.hero-img-wrap{position:relative}
.hero-img-shadow{position:absolute;inset:8px -8px -8px 8px;border-radius:16px;border:1px solid rgba(0,0,0,.06)}
.hero-img{width:100%;border-radius:16px;object-fit:cover;position:relative;z-index:1}
@media(max-width:768px){.hero-h1{font-size:2rem}.hero-grid{grid-template-columns:1fr!important}.hero-img-wrap{margin-top:32px}}
`;

const FEATURES_CSS = `
.fs-root *{font-family:'DM Sans','Helvetica Neue',sans-serif;box-sizing:border-box}
.fs-root h2,.fs-root h3,.fs-root h4{font-family:'Playfair Display',Georgia,serif!important}
.fs-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#374151;margin-bottom:1.25rem}
.fs-chip-dot{width:6px;height:6px;border-radius:50%;background:#111827;flex-shrink:0}
.fs-card{position:relative;overflow:hidden;padding:2rem;border:1px solid #e5e7eb;transition:transform .35s cubic-bezier(.34,1.2,.64,1),box-shadow .35s ease}
.fs-card:hover{transform:translateY(-4px);box-shadow:0 24px 48px -12px rgba(0,0,0,.1)}
.fs-card-ghost{position:absolute;top:-8px;right:-4px;font-family:'Playfair Display',serif;font-size:4rem;font-weight:900;color:#f9fafb;pointer-events:none}
.fs-card-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:18px;font-size:20px}
.fs-card-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:16px}
.fs-card-tag-dot{width:5px;height:5px;border-radius:50%}
.fs-accent-bar{position:absolute;bottom:0;left:0;right:0;height:3px;transform:scaleX(0);transform-origin:left;transition:transform .4s ease}
.fs-card:hover .fs-accent-bar{transform:scaleX(1)}
`;

const SERVICES_CSS = `
.sv-card{transition:transform .4s cubic-bezier(.34,1.2,.64,1),box-shadow .4s ease}
.sv-card:hover{transform:translateY(-8px);box-shadow:0 32px 64px -16px rgba(0,0,0,.18)}
.sv-card-img{transition:transform .6s ease;width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.sv-card:hover .sv-card-img{transform:scale(1.07)}
.sv-card-body{transform:translateY(10px);transition:transform .4s ease}
.sv-card:hover .sv-card-body{transform:translateY(0)}
.sv-card-desc{opacity:0;max-height:0;overflow:hidden;transition:opacity .35s ease,max-height .35s ease}
.sv-card:hover .sv-card-desc{opacity:1;max-height:120px}
`;

const CTA_CSS = `
.cta-section{font-family:'Sora',sans-serif}
.cta-section h2,.cta-section h3,.cta-section h4{font-family:'DM Serif Display',Georgia,serif!important}
.cta-btn-primary{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;font-weight:700;font-size:.95rem;border:none;border-radius:var(--radius,12px);cursor:pointer;transition:all .2s ease;font-family:'Sora',sans-serif;letter-spacing:-.01em;white-space:nowrap;box-shadow:var(--shadow,none)}
.cta-btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,.15)}
.cta-btn-secondary{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:rgba(255,255,255,.08);color:#fff;font-weight:600;font-size:.95rem;border:1px solid rgba(255,255,255,.2);border-radius:var(--radius,12px);cursor:pointer;transition:all .2s ease;font-family:'Sora',sans-serif;letter-spacing:-.01em;white-space:nowrap;backdrop-filter:blur(4px)}
.cta-btn-secondary:hover{background:rgba(255,255,255,.15);transform:translateY(-2px)}
.cta-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.9);margin-bottom:1.5rem;font-family:'Sora',sans-serif}
`;

const TESTIMONIALS_CSS = `
.t-card-hover{transition:transform .3s ease,box-shadow .3s ease}
.t-card-hover:hover{transform:translateY(-4px);box-shadow:0 24px 48px -12px rgba(0,0,0,.14)}
`;

const PRICING_CSS = `
.pr-sect *{box-sizing:border-box}
.pr-card{position:relative;overflow:hidden;border-radius:4px;transition:transform .35s cubic-bezier(.34,1.2,.64,1),box-shadow .35s ease}
.pr-card:hover{transform:translateY(-7px)}
.pr-card-default{background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 16px rgba(0,0,0,.04)}
.pr-card-default:hover{box-shadow:0 28px 60px rgba(0,0,0,.10)}
.pr-card-popular{background:#0f172a;box-shadow:0 20px 60px rgba(15,23,42,.38)}
.pr-card-popular:hover{box-shadow:0 32px 80px rgba(15,23,42,.48)}
.pr-cta{width:100%;padding:14px;border-radius:3px;border:none;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:opacity .2s,transform .2s;font-family:'Geist',sans-serif}
.pr-cta:hover{opacity:.88;transform:translateY(-1px)}
.pr-cta-default{background:#0f172a;color:#fff}
.pr-cta-popular{background:#fff;color:#0f172a}
`;

const CONTACT_CSS = `
.ct-input{width:100%;font-family:'Geist',sans-serif;font-size:14px;background:#fafaf9;border:1px solid rgba(0,0,0,.1);border-radius:3px;padding:13px 16px;color:#0f172a;outline:none;transition:border-color .2s ease,background .2s ease;resize:none}
.ct-input::placeholder{color:rgba(0,0,0,.25)}
.ct-input:focus{border-color:#E11D48;background:#fff}
.ct-label{font-family:'Geist',sans-serif;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:rgba(0,0,0,.38);display:block;margin-bottom:8px}
.ct-submit{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:'Geist',sans-serif;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;border:none;border-radius:3px;padding:16px 32px;cursor:pointer;width:100%;transition:opacity .2s,transform .2s}
.ct-submit:hover{opacity:.88;transform:translateY(-1px)}
.ct-info-item{display:flex;gap:18px;align-items:flex-start;padding:20px 0;border-bottom:1px solid rgba(0,0,0,.07);transition:padding-left .2s ease}
.ct-info-item:hover{padding-left:4px}
.ct-info-item:last-child{border-bottom:none}
`;

const FAQ_CSS = `
.fq-sect *{box-sizing:border-box}
.fq-acc-row{border-bottom:1px solid rgba(0,0,0,.08);transition:background .18s ease}
.fq-acc-row:first-child{border-top:1px solid rgba(0,0,0,.08)}
.fq-acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px 0;background:none;border:none;cursor:pointer;text-align:left}
.fq-acc-btn:hover{opacity:.72}
.fq-acc-icon{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.12);transition:background .2s ease}
.fq-grid-card{background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:4px;padding:32px 28px;position:relative;overflow:hidden;transition:transform .3s cubic-bezier(.34,1.2,.64,1),box-shadow .3s ease}
.fq-grid-card:hover{transform:translateY(-4px);box-shadow:0 20px 48px rgba(0,0,0,.09)}
`;

const ABOUT_CSS = `
.ab-val-item{transition:transform .3s ease,box-shadow .3s ease}
.ab-val-item:hover{transform:translateY(-4px);box-shadow:0 20px 40px -10px rgba(0,0,0,.13)}
.ab-icon-wrap{transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.ab-val-item:hover .ab-icon-wrap{transform:scale(1.15) rotate(-4deg)}
`;

const TEAM_CSS = `
.tm-card{transition:transform .35s cubic-bezier(.34,1.3,.64,1)}
.tm-card:hover{transform:translateY(-6px)}
.tm-card-img{transition:transform .55s ease}
.tm-card:hover .tm-card-img{transform:scale(1.06)}
.tm-card-overlay{opacity:0;transition:opacity .3s ease;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,transparent 100%)}
.tm-card:hover .tm-card-overlay{opacity:1}
`;

const GALLERY_CSS = `
.gl-item-img{transition:transform .65s cubic-bezier(.25,.46,.45,.94)}
.gl-item:hover .gl-item-img{transform:scale(1.07)}
.gl-overlay{opacity:0;background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.15) 55%,transparent 100%);transition:opacity .32s ease;position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:20px}
.gl-item:hover .gl-overlay{opacity:1}
.gl-overlay-content{transform:translateY(10px);transition:transform .32s ease}
.gl-item:hover .gl-overlay-content{transform:translateY(0)}
`;

/* ─── Base CSS ───────────────────────────────────────────────────── */

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:var(--theme-text,#0f172a);background:var(--theme-bg,#ffffff)}
img{max-width:100%;height:auto;display:block}
a{text-decoration:none;color:inherit}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
${NAVBAR_CSS}
${FOOTER_CSS}
${HERO_CSS}
${FEATURES_CSS}
${SERVICES_CSS}
${CTA_CSS}
${TESTIMONIALS_CSS}
${PRICING_CSS}
${CONTACT_CSS}
${FAQ_CSS}
${ABOUT_CSS}
${TEAM_CSS}
${GALLERY_CSS}
.site-section{width:100%}
.section-inner{max-width:1200px;margin:0 auto;padding:80px 24px}
.stats-grid{display:flex;justify-content:center;gap:48px;flex-wrap:wrap}
.masonry-grid{columns:2;column-gap:16px;margin-top:40px}
.masonry-item{break-inside:avoid;margin-bottom:16px}
.masonry-item img{width:100%;border-radius:8px}
.logo-grid{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:32px;margin-top:32px}
.logo-img{height:40px;width:auto;filter:grayscale(1);opacity:.5;transition:all .3s}
.logo-img:hover{filter:none;opacity:1}
.form-status{display:none;margin-top:8px;font-size:.9rem}
.form-status.success{color:#22c55e}
.form-status.error{color:#ef4444}
@media(max-width:768px){
  .section-inner{padding:48px 20px}
  .stats-grid{gap:24px}
  .masonry-grid{columns:1}
}
`;

/* ─── Section Renderers (matching React preview components) ──────── */

const sectionRenderers: Record<string, (c: SectionContent, s?: SectionStyles, idx?: number, variant?: string) => string> = {

  hero(c, s) {
    const bg = s?.backgroundColor && s.backgroundColor !== 'transparent'
      ? s.backgroundColor
      : 'var(--theme-bg, #ffffff)';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const btnPrimaryBg = s?.buttonPrimaryBg || 'var(--theme-primary, #0f172a)';
    const btnPrimaryText = s?.buttonPrimaryText || '#ffffff';
    const btnSecondaryBg = s?.buttonSecondaryBg || '#ffffff';
    const btnSecondaryText = s?.buttonSecondaryText || 'var(--theme-text, #0f172a)';
    const padding = s?.padding || '0';
    const minH = s?.minHeight || 'auto';

    return `
    <section class="hero-section" style="background:${bg};padding:${padding};min-height:${minH}">
      <div class="hero-dot-grid"></div>
      <div class="hero-blob" style="width:400px;height:400px;top:-100px;right:-100px;background:var(--theme-primary,#3b82f6)"></div>
      <div style="max-width:1200px;margin:0 auto;padding:0 24px;position:relative;z-index:10">
        <div class="hero-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;min-height:60vh">
          <div style="display:flex;flex-direction:column;gap:0">
            ${c.eyebrowText ? `<div class="hero-eyebrow"><span class="hero-eyebrow-dot"></span> ${esc(c.eyebrowText)}</div>` : ''}
            <h1 class="hero-h1" style="color:${headingColor}">${richText(c.headline)}</h1>
            <p class="hero-sub" style="color:${paraColor}">${richText(c.subheadline)}</p>
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px">
              ${c.ctaText ? `<a href="${esc(c.primaryRouteUrl || '#')}" class="hero-btn-primary" style="background:${btnPrimaryBg};color:${btnPrimaryText}">${esc(c.ctaText)} →</a>` : ''}
              ${c.ctaSecondaryText ? `<a href="${esc(c.secondaryRouteUrl || '#')}" class="hero-btn-secondary" style="background:${btnSecondaryBg};color:${btnSecondaryText}">▶ ${esc(c.ctaSecondaryText)}</a>` : ''}
            </div>
            ${Array.isArray(c.stats) && c.stats.length > 0 ? `
            <div class="hero-stats">
              ${c.stats.map((st: any) => `<div><div class="hero-stat-val" style="color:${headingColor}">${esc(st.value)}</div><div class="hero-stat-label">${esc(st.label)}</div></div>`).join('')}
            </div>` : ''}
          </div>
          ${c.imageUrl ? `
          <div class="hero-img-wrap">
            <div class="hero-img-shadow"></div>
            <img src="${esc(c.imageUrl)}" alt="" class="hero-img"/>
          </div>` : ''}
        </div>
      </div>
    </section>`;
  },

  features(c, s) {
    const items = Array.isArray(c.features) ? c.features : [];
    const bg = s?.backgroundColor && s.backgroundColor !== 'transparent' ? s.backgroundColor : 'var(--theme-bg-alt, #fafaf9)';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const cardBg = s?.cardBackgroundColor || '#ffffff';
    const radius = s?.borderRadius || 'var(--radius, 16px)';

    return `
    <section class="fs-root" style="background:${bg};padding:${s?.padding || '80px 0'}">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <div class="fs-chip"><span class="fs-chip-dot"></span> ${esc(c.chipText || 'FEATURES')}</div>
          <h2 style="font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4vw,3rem);font-weight:900;color:${headingColor};margin-bottom:16px">${richText(c.headline)}</h2>
          <p style="font-size:1rem;color:${paraColor};opacity:.7;max-width:560px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px">
          ${items.map((f: any, i: number) => {
            const tc = TAG_COLORS[i % TAG_COLORS.length]!;
            const accent = ACCENTS[i % ACCENTS.length];
            return `
            <div class="fs-card" style="background:${cardBg};border-radius:${radius}">
              <div class="fs-card-ghost">${String(i + 1).padStart(2, '0')}</div>
              <div class="fs-card-icon" style="background:${tc.bg};border:1px solid ${tc.border}">
                ${f.icon ? `<span style="font-size:20px">${f.icon}</span>` : `<span style="font-size:20px;color:${tc.dot}">★</span>`}
              </div>
              <h3 style="font-family:'Playfair Display',serif;font-size:1.15rem;font-weight:700;margin-bottom:8px;color:${headingColor}">${esc(f.title)}</h3>
              <p style="font-size:.875rem;line-height:1.6;color:${paraColor};opacity:.7">${esc(f.description)}</p>
              <div class="fs-card-tag" style="background:${tc.bg};border:1px solid ${tc.border};color:${tc.text}"><span class="fs-card-tag-dot" style="background:${tc.dot}"></span>Feature</div>
              <div class="fs-accent-bar" style="background:linear-gradient(90deg,${accent},transparent)"></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  services(c, s) {
    const items = Array.isArray(c.services) ? c.services : [];
    const bg = s?.useGradient && s?.backgroundGradient ? s.backgroundGradient : (s?.backgroundColor || '#ffffff');
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const radius = s?.borderRadius || '8px';

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Newsreader',serif;font-style:italic;font-size:clamp(2rem,4vw,3.5rem);font-weight:400;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <div style="width:48px;height:3px;background:#E11D48;margin:16px auto"></div>
          <p style="font-size:.95rem;color:${paraColor};opacity:.65;max-width:480px;margin:12px auto 0">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px">
          ${items.map((svc: any, i: number) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return `
            <div class="sv-card" style="position:relative;height:400px;overflow:hidden;border-radius:${radius};cursor:pointer">
              ${svc.imageUrl ? `<img src="${esc(svc.imageUrl)}" alt="${esc(svc.title)}" class="sv-card-img"/>` : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#1e293b,#0f172a)"></div>`}
              <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 30%,transparent 100%)"></div>
              <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
              <div class="sv-card-body" style="position:absolute;bottom:0;left:0;right:0;padding:28px;color:#fff">
                <div style="font-family:'Newsreader',serif;font-style:italic;font-size:1.25rem;font-weight:400;margin-bottom:8px">${esc(svc.title)}</div>
                <div class="sv-card-desc" style="font-size:.85rem;line-height:1.6;opacity:.72">${esc(svc.description)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  cta(c, s) {
    const bg = s?.useGradient && s?.backgroundGradient
      ? s.backgroundGradient
      : (s?.backgroundColor || 'var(--theme-primary, linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%))');
    const headingColor = s?.headingColor || 'var(--theme-bg, #ffffff)';
    const paraColor = s?.paragraphColor || 'rgba(255,255,255,.78)';
    const btnPBg = s?.buttonPrimaryBg || 'var(--theme-bg, #ffffff)';
    const btnPText = s?.buttonPrimaryText || 'var(--theme-primary, #4f46e5)';
    const btnSBg = s?.buttonSecondaryBg || 'rgba(255,255,255,.08)';
    const btnSText = s?.buttonSecondaryText || '#ffffff';

    return `
    <section class="cta-section" style="background:${bg};padding:${s?.padding || '80px 0'};position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;opacity:.06;background-image:url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E&quot;)"></div>
      <div style="position:absolute;top:-200px;left:-200px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.08),transparent 70%);filter:blur(40px)"></div>
      <div style="max-width:720px;margin:0 auto;padding:0 24px;text-align:center;position:relative;z-index:1">
        ${c.badgeText || c.chipLabel ? `<div class="cta-chip">✦ ${esc(c.badgeText || c.chipLabel)}</div>` : ''}
        <h2 style="font-family:'DM Serif Display',serif;font-size:clamp(2rem,5vw,3.2rem);font-weight:400;color:${headingColor};line-height:1.15;margin-bottom:16px">${richText(c.headline)}</h2>
        <div style="width:56px;height:3px;background:rgba(255,255,255,.3);margin:20px auto;border-radius:2px"></div>
        <p style="font-size:1.05rem;line-height:1.7;color:${paraColor};max-width:520px;margin:0 auto 32px">${richText(c.subheadline)}</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          ${c.ctaText ? `<a href="#" class="cta-btn-primary" style="background:${btnPBg};color:${btnPText}">${esc(c.ctaText)} →</a>` : ''}
          ${c.ctaSecondaryText ? `<a href="#" class="cta-btn-secondary" style="background:${btnSBg};color:${btnSText}">${esc(c.ctaSecondaryText)}</a>` : ''}
        </div>
        ${Array.isArray(c.trustCompanies) && c.trustCompanies.length > 0 ? `
        <div style="margin-top:40px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:.8rem;color:rgba(255,255,255,.45)">
          ${c.trustLabel ? `<span>${esc(c.trustLabel)}</span>` : ''}
          ${c.trustCompanies.map((co: string) => `<span style="font-weight:600;opacity:.7">${esc(co)}</span>`).join('<span style="opacity:.3"> · </span>')}
        </div>` : ''}
      </div>
    </section>`;
  },

  testimonials(c, s) {
    const items = Array.isArray(c.testimonials) ? c.testimonials : [];
    const bg = s?.backgroundColor || '#fafaf8';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const cardBg = s?.cardBackgroundColor || '#ffffff';
    const accColors = ['#d97706', '#4f46e5', '#059669'];

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,4vw,3rem);font-weight:600;font-style:italic;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.6;max-width:480px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">
          ${items.map((t: any, i: number) => `
          <div class="t-card-hover" style="background:${cardBg};border:1px solid rgba(0,0,0,.06);border-radius:8px;padding:32px;position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accColors[i % accColors.length]}"></div>
            <div style="color:${accColors[i % accColors.length]};font-size:28px;margin-bottom:12px">❝</div>
            <div style="display:flex;gap:2px;margin-bottom:12px">${'★'.repeat(t.rating || 5).split('').map(() => `<span style="color:#F59E0B;font-size:14px">★</span>`).join('')}</div>
            <p style="font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-style:italic;line-height:1.6;color:${headingColor};margin-bottom:20px">${esc(t.quote)}</p>
            <div style="display:flex;align-items:center;gap:12px">
              ${t.avatar ? `<img src="${esc(t.avatar)}" alt="${esc(t.name)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover"/>` : `<div style="width:44px;height:44px;border-radius:50%;background:#e5e7eb"></div>`}
              <div>
                <div style="font-weight:600;font-size:.9rem;color:${headingColor}">${esc(t.name)}</div>
                <div style="font-size:.8rem;opacity:.55">${esc(t.role)}</div>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </section>`;
  },

  pricing(c, s) {
    const plans = Array.isArray(c.plans) ? c.plans : [];
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const accColors = ['#0891B2', '#E11D48', '#7C3AED'];

    return `
    <section class="pr-sect" style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'Geist','DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:clamp(2rem,4vw,3rem);font-weight:400;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.55;max-width:480px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;align-items:start">
          ${plans.map((p: any, i: number) => {
            const accent = accColors[i % accColors.length];
            const isPopular = p.popular;
            return `
            <div class="pr-card ${isPopular ? 'pr-card-popular' : 'pr-card-default'}">
              <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
              <div style="padding:36px 32px">
                ${isPopular ? `<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;background:${accent};color:#fff;border-radius:999px;font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px">⚡ ${esc(p.popularLabel || 'Most Popular')}</div>` : ''}
                <div style="position:absolute;top:8px;right:12px;font-family:'Instrument Serif',serif;font-size:96px;font-weight:400;opacity:.04;line-height:1;pointer-events:none">${String(i + 1).padStart(2, '0')}</div>
                <h3 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:1.35rem;font-weight:400;margin-bottom:8px;color:${isPopular ? '#fff' : headingColor}">${esc(p.name)}</h3>
                <p style="font-size:.85rem;opacity:.55;margin-bottom:20px;color:${isPopular ? 'rgba(255,255,255,.65)' : paraColor}">${esc(p.description)}</p>
                <div style="margin-bottom:24px">
                  <span style="font-size:16px;opacity:.5;color:${isPopular ? '#fff' : headingColor}">$</span>
                  <span style="font-family:'Instrument Serif',serif;font-size:3.2rem;font-weight:700;color:${isPopular ? '#fff' : headingColor}">${esc(p.price)}</span>
                  <span style="font-size:.8rem;opacity:.45;color:${isPopular ? '#fff' : paraColor}">/${esc(p.pricePeriod || 'mo')}</span>
                </div>
                <ul style="list-style:none;margin-bottom:28px;padding:0">
                  ${(Array.isArray(p.features) ? p.features : []).map((f: string) => `
                  <li style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid ${isPopular ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'}">
                    <span style="width:20px;height:20px;border-radius:50%;background:${isPopular ? 'rgba(255,255,255,.1)' : accent + '18'};display:flex;align-items:center;justify-content:center;font-size:10px;color:${isPopular ? '#fff' : accent}">✓</span>
                    <span style="font-size:.85rem;color:${isPopular ? 'rgba(255,255,255,.8)' : paraColor}">${esc(f)}</span>
                  </li>`).join('')}
                </ul>
                <button class="pr-cta ${isPopular ? 'pr-cta-popular' : 'pr-cta-default'}">${esc(p.ctaText || 'Get Started')}</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  gallery(c, s) {
    const images = Array.isArray(c.images) ? c.images : [];
    const bg = s?.backgroundColor || '#0f0f0f';
    const headingColor = s?.headingColor || '#ffffff';
    const paraColor = s?.paragraphColor || 'rgba(255,255,255,.6)';

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:48px;flex-wrap:wrap;gap:24px">
          <div>
            <h2 style="font-family:'Cormorant',serif;font-style:italic;font-size:clamp(2rem,4vw,3rem);font-weight:600;color:${headingColor}">${richText(c.headline)}</h2>
            <div style="width:40px;height:3px;background:${ACCENTS[0]};margin-top:12px"></div>
          </div>
          <p style="font-size:.9rem;color:${paraColor};max-width:320px">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:180px;gap:12px">
          ${images.map((img: any, i: number) => {
            const isFeatured = (i + 1) % 5 === 0;
            return `
            <div class="gl-item" style="position:relative;overflow:hidden;border-radius:8px${isFeatured ? ';grid-column:span 2;grid-row:span 2' : ''}">
              <img src="${esc(img.url)}" alt="${esc(img.title || '')}" class="gl-item-img" style="width:100%;height:100%;object-fit:cover"/>
              <div class="gl-overlay">
                <div class="gl-overlay-content">
                  <div style="color:#fff;font-family:'Cormorant',serif;font-style:italic;font-size:1.1rem">${esc(img.title || '')}</div>
                  ${img.category ? `<div style="color:rgba(255,255,255,.5);font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;margin-top:4px">${esc(img.category)}</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  stats(c, s) {
    const stats = Array.isArray(c.stats) ? c.stats : [];
    const bg = s?.useGradient && s?.backgroundGradient ? s.backgroundGradient : (s?.backgroundColor || 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)');

    return `
    <section style="background:${bg};padding:${s?.padding || '60px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="display:flex;justify-content:center;gap:48px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);padding:40px 0">
          ${stats.map((st: any, i: number) => `
          <div style="text-align:center;position:relative${i > 0 ? ';padding-left:48px' : ''}">
            ${i > 0 ? '<div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:1px;height:48px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.1),transparent)"></div>' : ''}
            <div style="font-size:3.5rem;font-weight:700;color:#fff;letter-spacing:-.03em;line-height:1">${esc(st.value)}${st.suffix ? `<span style="font-size:2rem;font-weight:300;color:rgba(96,165,250,.8)">${esc(st.suffix)}</span>` : ''}</div>
            <div style="font-size:.7rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin-top:8px">${esc(st.label)}</div>
          </div>`).join('')}
        </div>
      </div>
    </section>`;
  },

  team(c, s) {
    const members = Array.isArray(c.members) ? c.members : [];
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'Outfit',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Fraunces',serif;font-size:clamp(2rem,4vw,3rem);font-weight:700;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.6;max-width:480px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px">
          ${members.map((m: any, i: number) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return `
            <div class="tm-card" style="position:relative;overflow:hidden;border-radius:8px;aspect-ratio:3/4;cursor:pointer">
              ${m.avatar ? `<img src="${esc(m.avatar)}" alt="${esc(m.name)}" class="tm-card-img" style="width:100%;height:100%;object-fit:cover"/>` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#1e293b,#334155)"></div>`}
              <div class="tm-card-overlay" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:24px">
              </div>
              <div style="position:absolute;top:12px;left:12px;width:28px;height:28px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${String(i + 1).padStart(2, '0')}</div>
              <div style="position:absolute;bottom:0;left:0;right:0;padding:20px;background:linear-gradient(to top,rgba(0,0,0,.7),transparent)">
                <div style="font-family:'Fraunces',serif;font-weight:700;font-size:1.1rem;color:#fff">${esc(m.name)}</div>
                <div style="font-size:.78rem;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:6px;margin-top:4px"><span style="display:inline-block;width:12px;height:1.5px;background:${accent}"></span>${esc(m.role)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  faq(c, s) {
    const faqs = Array.isArray(c.faqs) ? c.faqs : [];
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';

    return `
    <section class="fq-sect" style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'Geist','DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Newsreader',serif;font-style:italic;font-size:clamp(2rem,4vw,3rem);font-weight:400;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.55;max-width:480px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="max-width:780px;margin:0 auto">
          ${faqs.map((f: any, i: number) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return `
            <details class="fq-acc-row" ${i === 0 ? 'open' : ''}>
              <summary class="fq-acc-btn" style="list-style:none">
                <div style="display:flex;align-items:center;gap:16px">
                  <span style="font-family:'Newsreader',serif;font-style:italic;font-size:.95rem;color:${accent};min-width:28px">${String(i + 1).padStart(2, '0')}</span>
                  <span style="font-family:'Newsreader',serif;font-size:1.1rem;font-weight:600;color:${headingColor}">${esc(f.question)}</span>
                </div>
                <div class="fq-acc-icon">+</div>
              </summary>
              <div style="padding:0 0 24px 44px">
                <div style="display:flex;gap:16px">
                  <div style="width:3px;border-radius:2px;background:${accent};flex-shrink:0"></div>
                  <p style="font-size:.9rem;line-height:1.7;color:${paraColor};opacity:.7">${esc(f.answer)}</p>
                </div>
              </div>
            </details>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  },

  logocloud(c, s) {
    const logos = Array.isArray(c.logos) ? c.logos : [];
    const bg = s?.backgroundColor || 'var(--theme-bg-alt, #f8fafc)';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const logoH = s?.logoHeight || '40px';

    return `
    <section style="background:${bg};padding:${s?.padding || '48px 0'}">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px;text-align:center">
        <h2 style="font-size:1.25rem;font-weight:600;color:${headingColor};margin-bottom:4px">${richText(c.headline)}</h2>
        <p style="font-size:.8rem;text-transform:uppercase;letter-spacing:.1em;color:${paraColor};opacity:.5;margin-bottom:32px">${richText(c.subheadline)}</p>
        <div class="logo-grid">
          ${logos.map((l: any) => `<img src="${esc(l.url)}" alt="${esc(l.name)}" class="logo-img" style="height:${logoH}"/>`).join('')}
        </div>
      </div>
    </section>`;
  },

  contact(c, s) {
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const btnBg = s?.buttonPrimaryBg || '#0f172a';
    const btnText = s?.buttonPrimaryText || '#ffffff';

    const contactItems = Array.isArray(c.contactFields) ? c.contactFields.map((f: any) => ({
      label: f.label || f.field || '',
      value: f.value || '',
      icon: f.icon === 'Phone' ? '☎' : f.icon === 'MapPin' ? '📍' : f.icon === 'Mail' ? '✉' : f.icon === 'Clock' ? '🕐' : f.icon === 'Users' ? '👥' : f.icon === 'MessageSquare' ? '💬' : '•',
      accent: f.accent || ACCENTS[0],
    })) : [
      c.email && { label: c.labelEmailUs || 'Email Us', value: c.email, icon: '✉', accent: '#E11D48' },
      c.phone && { label: c.labelCallUs || 'Call Us', value: c.phone, icon: '☎', accent: '#0891B2' },
      c.address && { label: c.labelVisitUs || 'Visit Us', value: c.address, icon: '📍', accent: '#059669' },
    ].filter(Boolean);

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'Geist','DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="margin-bottom:48px">
          <h2 style="font-family:'Fraunces',serif;font-size:clamp(2rem,4vw,3rem);font-weight:700;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <div style="width:40px;height:3px;background:#E11D48;margin-bottom:12px"></div>
          <p style="font-size:.95rem;color:${paraColor};opacity:.55;max-width:480px">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px">
          <div>
            ${contactItems.map((item: any) => {
              const accent = item.accent || ACCENTS[0];
              return `
              <div class="ct-info-item">
                <div style="width:44px;height:44px;border-radius:4px;background:${accent}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${item.icon}</div>
                <div>
                  <div style="font-size:.65rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(0,0,0,.35);margin-bottom:4px">${esc(item.label)}</div>
                  <div style="font-size:.95rem;color:${headingColor}">${esc(item.value)}</div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:4px;padding:36px">
            <form class="contact-form" data-form-name="contact" style="display:flex;flex-direction:column;gap:16px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><label class="ct-label">${esc(c.labelFirstName || 'First Name')}</label><input type="text" name="firstName" class="ct-input" placeholder="${esc(c.labelFirstName || 'First Name')}" required/></div>
                <div><label class="ct-label">${esc(c.labelLastName || 'Last Name')}</label><input type="text" name="lastName" class="ct-input" placeholder="${esc(c.labelLastName || 'Last Name')}"/></div>
              </div>
              <div><label class="ct-label">${esc(c.labelEmail || 'Email')}</label><input type="email" name="email" class="ct-input" placeholder="${esc(c.labelEmail || 'Email')}" required/></div>
              <div><label class="ct-label">${esc(c.labelMessage || 'Message')}</label><textarea name="message" class="ct-input" rows="5" placeholder="${esc(c.labelMessage || 'Message')}" required></textarea></div>
              <button type="submit" class="ct-submit" style="background:${btnBg};color:${btnText}">${esc(c.buttonText || 'SEND MESSAGE')} →</button>
              <p class="form-status" style="display:none;margin-top:4px;font-size:.85rem"></p>
            </form>
          </div>
        </div>
      </div>
    </section>`;
  },

  about(c, s) {
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const values = Array.isArray(c.values) ? c.values : [];

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'Epilogue','DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="display:grid;grid-template-columns:${c.imagePosition === 'left' ? '1fr 1fr' : '1fr 1fr'};gap:48px;align-items:center">
          ${c.imagePosition === 'left' && c.imageUrl ? `<div style="border-radius:12px;overflow:hidden"><img src="${esc(c.imageUrl)}" alt="${esc(c.imageAlt || '')}" style="width:100%;height:100%;object-fit:cover;min-height:400px"/></div>` : ''}
          <div>
            ${c.badge ? `<div style="display:inline-flex;padding:5px 13px;background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.08);border-radius:999px;font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px">${esc(c.badge)}</div>` : ''}
            <h2 style="font-family:'Libre Baskerville',serif;font-size:clamp(1.8rem,3.5vw,2.6rem);font-weight:700;color:${headingColor};margin-bottom:16px;line-height:1.2">${richText(c.headline)}</h2>
            <p style="font-size:1rem;line-height:1.7;color:${paraColor};opacity:.7">${richText(c.description)}</p>
            ${c.storyTitle ? `<h3 style="font-family:'Libre Baskerville',serif;font-size:1.2rem;margin-top:24px;margin-bottom:8px;color:${headingColor}">${esc(c.storyTitle)}</h3>` : ''}
            ${c.storyContent ? `<p style="font-size:.95rem;line-height:1.7;color:${paraColor};opacity:.65">${esc(c.storyContent)}</p>` : ''}
          </div>
          ${c.imagePosition !== 'left' && c.imageUrl ? `<div style="border-radius:12px;overflow:hidden"><img src="${esc(c.imageUrl)}" alt="${esc(c.imageAlt || '')}" style="width:100%;height:100%;object-fit:cover;min-height:400px"/></div>` : ''}
        </div>
        ${values.length > 0 ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:48px">
          ${values.map((v: any, i: number) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return `
            <div class="ab-val-item" style="background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:8px;padding:28px;position:relative;overflow:hidden">
              <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
              <div class="ab-icon-wrap" style="width:44px;height:44px;border-radius:4px;background:${accent}15;display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:18px">${v.icon || '★'}</div>
              <h4 style="font-family:'Libre Baskerville',serif;font-weight:700;font-size:1rem;margin-bottom:6px;color:${headingColor}">${esc(v.title)}</h4>
              <p style="font-size:.85rem;line-height:1.6;color:${paraColor};opacity:.6">${esc(v.description)}</p>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>
    </section>`;
  },

  masonry(c, s) {
    const images = Array.isArray(c.images) ? c.images : [];
    const bg = s?.backgroundColor || '#0f0f0f';
    const headingColor = s?.headingColor || '#ffffff';
    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'}">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        ${c.headline ? `<h2 style="font-family:'Cormorant',serif;font-style:italic;font-size:2rem;color:${headingColor};text-align:center;margin-bottom:40px">${richText(c.headline)}</h2>` : ''}
        <div class="masonry-grid">
          ${images.map((img: any) => `
          <div class="masonry-item gl-item" style="position:relative;overflow:hidden;border-radius:8px">
            <img src="${esc(img.url || img.src)}" alt="${esc(img.title || img.alt || '')}" style="width:100%;display:block;border-radius:8px"/>
            <div class="gl-overlay"><div class="gl-overlay-content"><span style="color:#fff;font-family:'Cormorant',serif;font-style:italic">${esc(img.title || '')}</span></div></div>
          </div>`).join('')}
        </div>
      </div>
    </section>`;
  },

  bloglist(c, s) {
    const posts = Array.isArray(c.posts) ? c.posts : [];
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const cardBg = s?.cardBackgroundColor || '#ffffff';

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-size:clamp(1.8rem,3.5vw,2.5rem);font-weight:800;color:${headingColor};margin-bottom:12px">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.6;max-width:480px;margin:0 auto">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px">
          ${posts.map((p: any) => `
          <article style="background:${cardBg};border:1px solid rgba(0,0,0,.06);border-radius:12px;overflow:hidden;transition:transform .3s,box-shadow .3s">
            ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.title)}" style="width:100%;height:200px;object-fit:cover"/>` : ''}
            <div style="padding:24px">
              ${p.category ? `<span style="display:inline-block;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--theme-primary,#3b82f6);margin-bottom:8px">${esc(p.category)}</span>` : ''}
              <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;color:${headingColor}">${esc(p.title)}</h3>
              <p style="font-size:.875rem;color:${paraColor};opacity:.7;line-height:1.6">${esc(p.excerpt || p.description)}</p>
              ${p.author ? `<div style="margin-top:12px;font-size:.8rem;opacity:.5">${esc(p.author)}</div>` : ''}
            </div>
          </article>`).join('')}
        </div>
      </div>
    </section>`;
  },

  casestudies(c, s) {
    const cases = Array.isArray(c.cases) ? c.cases : [];
    const bg = s?.backgroundColor || '#ffffff';
    const headingColor = s?.headingColor || s?.color || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const accent = c.accentColor || 'var(--theme-primary, #3b82f6)';

    return `
    <section style="background:${bg};padding:${s?.padding || '80px 0'};font-family:'DM Sans',sans-serif">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px">
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-size:clamp(1.8rem,3.5vw,2.5rem);font-weight:800;color:${headingColor}">${richText(c.headline)}</h2>
          <p style="font-size:.95rem;color:${paraColor};opacity:.6;max-width:480px;margin:0 auto;margin-top:12px">${richText(c.subheadline)}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px">
          ${cases.map((cs: any) => `
          <div style="background:#fff;border:1px solid rgba(0,0,0,.06);border-radius:12px;overflow:hidden;transition:transform .3s,box-shadow .3s;position:relative">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${accent}"></div>
            <div style="padding:28px">
              ${cs.industry ? `<span style="display:inline-block;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${accent};margin-bottom:8px">${esc(cs.industry)}</span>` : ''}
              <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px;color:${headingColor}">${esc(cs.client || cs.title)}</h3>
              <p style="font-size:.875rem;color:${paraColor};opacity:.7;line-height:1.6">${esc(cs.challenge || cs.description)}</p>
              ${cs.metric ? `<div style="font-size:2rem;font-weight:800;color:${accent};margin-top:16px">${esc(cs.metric)}</div>` : ''}
              ${cs.result ? `<div style="font-size:.85rem;font-weight:600;color:${headingColor};margin-top:4px">${esc(cs.result)}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>
    </section>`;
  },

  buttonblock(c, s) {
    const btnBg = s?.buttonPrimaryBg || 'var(--theme-primary, #0f172a)';
    const btnText = s?.buttonPrimaryText || '#ffffff';
    const radius = s?.borderRadius || 'var(--radius, 12px)';
    const align = c.align || 'center';
    return `
    <section style="padding:${s?.padding || '40px 0'};min-height:${s?.minHeight || 'auto'};${cssFromStyles(s)}">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px;display:flex;gap:12px;justify-content:${align};flex-wrap:wrap">
        <a href="#" class="hero-btn-primary" style="background:${btnBg};color:${btnText};border-radius:${radius}">${esc(c.text || c.buttonText || 'Click Here')}</a>
      </div>
    </section>`;
  },

  textblock(c, s) {
    const paraColor = s?.paragraphColor || 'var(--theme-text)';
    const align = c.align || c.textAlign || 'left';
    return `
    <section style="padding:${s?.padding || '40px 0'};min-height:${s?.minHeight || 'auto'};${cssFromStyles(s)}">
      <div style="max-width:800px;margin:0 auto;padding:0 24px;text-align:${align}">
        <div style="color:${paraColor};line-height:1.8;font-size:1rem">${richText(c.text || c.body || c.content || '')}</div>
      </div>
    </section>`;
  },

  htmlblock(c, s) {
    return `<section style="padding:${s?.padding || '40px 0'};min-height:${s?.minHeight || 'auto'};${cssFromStyles(s)}"><div style="max-width:1200px;margin:0 auto;padding:0 24px">${c.html || c.code || c.content || ''}</div></section>`;
  },

  content(c, s) {
    const headingColor = s?.headingColor || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || 'var(--theme-text, #0f172a)';
    const contentSections = Array.isArray(c.sections) ? c.sections : [];
    return `
    <section style="padding:${s?.padding || '80px 0'};${cssFromStyles(s)}">
      <div style="max-width:960px;margin:0 auto;padding:0 24px">
        ${c.title ? `<h2 style="font-family:'Libre Baskerville',serif;font-size:2rem;font-weight:700;color:${headingColor};margin-bottom:32px">${richText(c.title)}</h2>` : ''}
        ${contentSections.map((sec: any) => `
        <div style="margin-bottom:32px">
          ${sec.heading ? `<h3 style="font-size:1.3rem;font-weight:700;color:${headingColor};margin-bottom:12px">${richText(sec.heading)}</h3>` : ''}
          ${sec.content ? `<div style="color:${paraColor};line-height:1.7;opacity:.8">${richText(sec.content)}</div>` : ''}
          ${Array.isArray(sec.listItems) && sec.listItems.length > 0 ? `
          <ul style="list-style:disc;padding-left:24px;margin-top:8px">
            ${sec.listItems.map((li: string) => `<li style="color:${paraColor};opacity:.75;margin-bottom:4px">${esc(li)}</li>`).join('')}
          </ul>` : ''}
        </div>`).join('')}
      </div>
    </section>`;
  },

  image(c) {
    return `
    <section style="padding:40px 0">
      <div style="max-width:1200px;margin:0 auto;padding:0 24px;text-align:center">
        ${c.imageUrl || c.src ? `<img src="${esc(c.imageUrl || c.src)}" alt="${esc(c.alt || c.caption || '')}" style="border-radius:12px;max-height:600px;margin:0 auto"/>` : ''}
        ${c.caption ? `<p style="margin-top:12px;color:#64748b;font-size:.9rem">${esc(c.caption)}</p>` : ''}
      </div>
    </section>`;
  },

  layout(c, s, _idx, variant) {
    const bg = s?.backgroundColor || s?.background || 'transparent';
    const headingColor = s?.headingColor || s?.color || 'var(--theme-text, #0f172a)';
    const paraColor = s?.paragraphColor || s?.color || 'var(--theme-text, #0f172a)';
    const btnBg = s?.buttonBackgroundColor || 'var(--theme-primary, #0f172a)';
    const btnText = s?.buttonTextColor || '#ffffff';
    const btnRadius = s?.buttonBorderRadius || 'var(--radius, 8px)';
    const v = variant || 'text-only';

    if (v === 'image-text-left' || v === 'image-text-right') {
      const imgFirst = v === 'image-text-left';
      const imgHtml = c.imageUrl ? `<div style="border-radius:12px;overflow:hidden"><img src="${esc(c.imageUrl)}" alt="${esc(c.imageAlt || '')}" style="width:100%;height:100%;object-fit:cover;min-height:300px"/></div>` : '<div></div>';
      const textHtml = `<div>${c.heading ? `<h2 style="font-size:1.6rem;font-weight:700;color:${headingColor};margin-bottom:12px">${richText(c.heading)}</h2>` : ''}<p style="color:${paraColor};opacity:.7;line-height:1.7">${richText(c.text || '')}</p></div>`;
      return `
      <section style="background:${bg};padding:${s?.padding || '60px 0'}">
        <div style="max-width:1200px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center">
          ${imgFirst ? imgHtml + textHtml : textHtml + imgHtml}
        </div>
      </section>`;
    }

    if (v === 'text-button' || v === 'heading-text-button') {
      return `
      <section style="background:${bg};padding:${s?.padding || '60px 0'}">
        <div style="max-width:800px;margin:0 auto;padding:0 24px;text-align:center">
          ${v === 'heading-text-button' && c.heading ? `<h2 style="font-size:1.8rem;font-weight:700;color:${headingColor};margin-bottom:12px">${richText(c.heading)}</h2>` : ''}
          <p style="color:${paraColor};opacity:.7;line-height:1.7;margin-bottom:24px">${richText(c.text || '')}</p>
          ${c.buttonText ? `<a href="${esc(c.buttonHref || '#')}" class="hero-btn-primary" style="background:${btnBg};color:${btnText};border-radius:${btnRadius}">${esc(c.buttonText)}</a>` : ''}
        </div>
      </section>`;
    }

    if (v === 'two-column') {
      const left = c.leftColumn || {};
      const right = c.rightColumn || {};
      return `
      <section style="background:${bg};padding:${s?.padding || '60px 0'}">
        <div style="max-width:1200px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:48px">
          <div>
            ${left.heading ? `<h3 style="font-size:1.3rem;font-weight:700;color:${headingColor};margin-bottom:8px">${richText(left.heading)}</h3>` : ''}
            <p style="color:${paraColor};opacity:.7;line-height:1.7">${richText(left.text || '')}</p>
          </div>
          <div>
            ${right.heading ? `<h3 style="font-size:1.3rem;font-weight:700;color:${headingColor};margin-bottom:8px">${richText(right.heading)}</h3>` : ''}
            <p style="color:${paraColor};opacity:.7;line-height:1.7">${richText(right.text || '')}</p>
          </div>
        </div>
      </section>`;
    }

    // text-only (default)
    return `
    <section style="background:${bg};padding:${s?.padding || '60px 0'}">
      <div style="max-width:800px;margin:0 auto;padding:0 24px">
        <div style="color:${paraColor};line-height:1.8">${richText(c.text || '')}</div>
      </div>
    </section>`;
  },
};

// Aliases: frontend uses these type names
sectionRenderers['blog'] = sectionRenderers['bloglist']!;
sectionRenderers['gallery-masonry'] = sectionRenderers['masonry']!;
sectionRenderers['text'] = sectionRenderers['textblock']!;
sectionRenderers['button'] = sectionRenderers['buttonblock']!;
sectionRenderers['html'] = sectionRenderers['htmlblock']!;

/* ─── Section wrapper ────────────────────────────────────────────── */

const renderSection = (section: Section, idx: number): string => {
  if (section.visible === false) return '';
  const renderer = sectionRenderers[section.type];
  if (renderer) return renderer(section.content || {}, section.styles, idx, section.variant);
  // Fallback for unknown types
  return `<section style="${cssFromStyles(section.styles)}"><div style="max-width:1200px;margin:0 auto;padding:64px 24px;text-align:center"><p>${esc(section.name || section.type)}</p></div></section>`;
};

/* ─── Navbar (matches NavbarPreview.tsx) ──────────────────────────── */

const renderNavbar = (navbar: Record<string, any> | undefined, pageSlugs: Set<string> = new Set(), currentSlug: string = ''): string => {
  if (!navbar) return '';

  const rawBrand = navbar.brand || navbar.logo || navbar.title || '';
  const brand = typeof rawBrand === 'object' && rawBrand !== null ? (rawBrand.text || rawBrand.name || '') : rawBrand;
  const logoUrl = navbar.logoUrl || (typeof rawBrand === 'object' ? rawBrand?.imageUrl : '') || '';
  const links = Array.isArray(navbar.links) ? navbar.links : [];
  const ns = navbar.styles || {};
  const bgColor = ns.backgroundColor || navbar.backgroundColor || 'var(--theme-bg, #0a0a0f)';
  const textColor = ns.textColor || navbar.textColor || 'var(--theme-text, #f8fafc)';
  const btnBg = ns.buttonBg || 'var(--theme-text, #f8fafc)';
  const btnText = ns.buttonText || 'var(--theme-bg, #0a0a0f)';
  const btnRadius = ns.buttonRadius || '2px';
  const isSticky = ns.sticky !== false;

  return `
  <nav style="background:${bgColor};color:${textColor};position:${isSticky ? 'sticky' : 'relative'};top:0;z-index:50;backdrop-filter:blur(12px);border-bottom:1px solid rgba(128,128,128,.08)">
    <div class="nb-inner">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(brand)}" style="height:32px;width:auto"/>` : ''}
        <span style="font-family:'Fraunces',serif;font-weight:900;font-style:italic;font-size:22px;letter-spacing:-.02em">${esc(brand)}</span>
      </div>
      <div class="nb-desktop-links" style="display:flex;align-items:center;gap:36px">
        ${links.map((l: any, i: number) => {
          const isButton = l.isButton || (i === links.length - 1 && links.length > 1);
          if (isButton) {
            return `<a href="${esc(rewriteHref(l.href || l.url || '#', pageSlugs, currentSlug))}" class="nb-cta" style="background:${btnBg};color:${btnText};border-radius:${btnRadius}">${esc(l.label || l.text)}</a>`;
          }
          return `<a href="${esc(rewriteHref(l.href || l.url || '#', pageSlugs, currentSlug))}" class="nb-link" style="color:${textColor}">${esc(l.label || l.text)}</a>`;
        }).join('')}
      </div>
    </div>
  </nav>`;
};

/* ─── Footer (matches FooterPreview.tsx) ─────────────────────────── */

const renderFooter = (footer: Record<string, any> | undefined, pageSlugs: Set<string> = new Set(), currentSlug: string = ''): string => {
  if (!footer) return '';

  const rawBrand = footer.logo || footer.brand || '';
  const footerBrand = typeof rawBrand === 'object' && rawBrand !== null ? (rawBrand.text || rawBrand.name || '') : rawBrand;
  const fs = footer.styles || {};
  const bgColor = fs.backgroundColor || footer.backgroundColor || 'var(--theme-bg, #0a0a0f)';
  const textColor = fs.textColor || footer.textColor || '#f8fafc';
  const copyright = footer.copyright || footer.text || '';
  const description = footer.description || '';
  const columns = Array.isArray(footer.columns) ? footer.columns : [];
  const links = Array.isArray(footer.links) ? footer.links : [];
  const socialLinks = Array.isArray(footer.socialLinks) ? footer.socialLinks : [];

  const socialIcons: Record<string, string> = {
    twitter: '𝕏', facebook: 'f', instagram: '📷', linkedin: 'in', github: '⌨', youtube: '▶',
  };

  return `
  <footer style="background:${bgColor};color:${textColor};position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;pointer-events:none">
      <div style="position:absolute;top:-30%;left:-20%;width:80%;height:80%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.015),transparent 70%)"></div>
    </div>
    <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(to right,transparent,rgba(255,255,255,.12),transparent)"></div>
    <div class="ft-wrapper" style="max-width:1240px;margin:0 auto;padding:48px 24px 0;position:relative">
      ${columns.length > 0 ? `
      <div class="ft-grid" style="margin-bottom:64px">
        <div style="padding-right:40px">
          <div style="font-family:'Instrument Serif',serif;font-style:italic;font-size:26px;margin-bottom:12px">${esc(footerBrand)}</div>
          <div style="width:32px;height:1px;background:rgba(255,255,255,.2);margin-bottom:16px"></div>
          ${description ? `<p style="font-family:'Geist',sans-serif;font-size:14px;line-height:1.7;opacity:.52;margin-bottom:20px">${esc(description)}</p>` : ''}
          ${socialLinks.length > 0 ? `
          <div style="display:flex;gap:8px">
            ${socialLinks.map((s: any) => `<a href="${esc(s.href || '#')}" class="ft-social-btn" style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:14px;text-decoration:none;color:${textColor}">${socialIcons[s.platform] || s.platform?.[0]?.toUpperCase() || '•'}</a>`).join('')}
          </div>` : ''}
        </div>
        ${columns.map((col: any) => `
        <div>
          <h4 style="font-family:'Geist',sans-serif;font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.38;margin-bottom:20px">${esc(col.title)}</h4>
          <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:10px">
            ${(Array.isArray(col.links) ? col.links : []).map((l: any) => `<li><a href="${esc(rewriteHref(l.href || '#', pageSlugs, currentSlug))}" class="ft-link">${esc(l.label || l.text)}</a></li>`).join('')}
          </ul>
        </div>`).join('')}
      </div>` : `
      <div style="display:flex;justify-content:center;gap:24px;margin-bottom:24px;flex-wrap:wrap">
        ${links.map((l: any) => `<a href="${esc(rewriteHref(l.href || l.url || '#', pageSlugs, currentSlug))}" class="ft-link">${esc(l.label || l.text)}</a>`).join('')}
      </div>`}
      <div style="border-top:1px solid rgba(255,255,255,.07);padding:24px 0 40px;display:flex;justify-content:center;gap:24px;flex-wrap:wrap">
        <p style="font-family:'Geist',sans-serif;font-size:12px;opacity:.35">${esc(copyright)}</p>
      </div>
    </div>
  </footer>`;
};

/* ─── Page builder ───────────────────────────────────────────────── */

const buildPageHtml = (page: PageData, siteName: string, websiteId?: string, apiBaseUrl?: string, pageSlugs: Set<string> = new Set()): string => {
  const title = page.meta?.title || page.name || siteName;
  const description = page.meta?.description || '';
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const formApiUrl = apiBaseUrl || (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}/api/v1`);
  const currentSlug = (page.slug || '/').replace(/^\/+/, '').replace(/\/+$/, '');

  // Build CSS variables matching CanvasPreview (--theme-* names)
  const gs = page.globalStyles || {};
  const themeVars = [
    `--theme-primary:${gs.primaryColor || '#3b82f6'}`,
    `--theme-secondary:${gs.secondaryColor || '#8b5cf6'}`,
    `--theme-accent:${gs.accentColor || '#06b6d4'}`,
    `--theme-bg:${gs.backgroundColor || '#ffffff'}`,
    `--theme-text:${gs.textColor || '#0f172a'}`,
    `--theme-bg-alt:${gs.alternateBackground || '#f8fafc'}`,
    `--theme-text-alt:${gs.alternateTextColor || '#0f172a'}`,
    `--radius:${gs.borderRadius || '12px'}`,
    `--shadow:${gs.shadows === 'pronounced' ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : gs.shadows === 'subtle' ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' : 'none'}`,
    `--animation-speed:${gs.animations ? '0.3s' : '0s'}`,
  ].join(';');

  const globalStyleBlock = `:root{${themeVars}} body{background:var(--theme-bg);color:var(--theme-text)${gs.fontFamily ? `;font-family:${gs.fontFamily}` : ''}} .global-radius{border-radius:var(--radius)!important} .global-shadow{box-shadow:var(--shadow)!important} .global-transition{transition:all var(--animation-speed) ease!important}`;

  const formScript = `
<script>
document.querySelectorAll('.contact-form').forEach(function(form){
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=form.querySelector('button[type=submit]');
    var status=form.querySelector('.form-status');
    var fd={};
    new FormData(form).forEach(function(v,k){fd[k]=v});
    var fullName=((fd.firstName||'')+(fd.lastName?' '+fd.lastName:'')).trim()||fd.name||'Anonymous';
    btn.disabled=true;btn.textContent='Sending...';
    if(status){status.style.display='none';}
    fetch('${formApiUrl}/forms/submit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({website_id:'${websiteId || ''}',form_name:'contact',data:{name:fullName,email:fd.email||'',subject:fd.subject||'',message:fd.message||''}})
    }).then(function(r){
      if(!r.ok)throw new Error('Failed');
      form.reset();
      btn.textContent='Sent!';
      if(status){status.textContent='Thank you! Your message has been sent.';status.className='form-status success';status.style.display='block';}
      setTimeout(function(){btn.disabled=false;btn.textContent='SEND MESSAGE';},3000);
    }).catch(function(){
      btn.disabled=false;btn.textContent='SEND MESSAGE';
      if(status){status.textContent='Something went wrong. Please try again.';status.className='form-status error';status.style.display='block';}
    });
  });
});
</script>`;

  // FAQ toggle script
  const faqScript = `
<script>
document.querySelectorAll('.fq-acc-row summary').forEach(function(s){
  s.addEventListener('click',function(e){
    var icon=s.querySelector('.fq-acc-icon');
    if(icon){var p=s.closest('details');icon.textContent=p&&p.open?'+':'−';}
  });
});
</script>`;

  const hasContactForm = sections.some(sec => sec.type === 'contact' && sec.visible !== false);
  const hasFaq = sections.some(sec => sec.type === 'faq' && sec.visible !== false);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}"/>` : ''}
<meta property="og:title" content="${esc(title)}"/>
${description ? `<meta property="og:description" content="${esc(description)}"/>` : ''}
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
${description ? `<meta name="twitter:description" content="${esc(description)}"/>` : ''}
<link rel="canonical" href="/"/>
${FONT_IMPORTS}
<style>${globalStyleBlock}${BASE_CSS}</style>
</head>
<body>
${renderNavbar(page.navbar, pageSlugs, currentSlug)}
<main>
${sections.map((sec, idx) => renderSection(sec, idx)).join('\n')}
</main>
${renderFooter(page.footer, pageSlugs, currentSlug)}
${hasContactForm ? formScript : ''}
${hasFaq ? faqScript : ''}
${websiteId ? `<script>
(function(){var d={websiteId:"${websiteId}",path:location.pathname,referrer:document.referrer};
fetch("${formApiUrl}/analytics/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),keepalive:true}).catch(function(){});})();
</script>` : ''}
</body>
</html>`;
};

/* ─── Public API ─────────────────────────────────────────────────── */

export const generateStaticSite = (content: Record<string, any>, siteName: string, websiteId?: string): GeneratedFile[] => {
  const pages: PageData[] = Array.isArray(content.pages) ? content.pages : [];

  if (pages.length === 0) {
    return [{ filename: 'index.html', html: buildPageHtml({ id: 'default', name: siteName, slug: '/', sections: [], navbar: content.navbar, footer: content.footer, globalStyles: content.globalStyles }, siteName, websiteId) }];
  }

  // Use first page's globalStyles as a site-wide fallback for pages that don't have them
  const siteGlobalStyles = pages[0]?.globalStyles || content.globalStyles || {};
  // Use first page's navbar/footer as fallback for pages missing them
  const siteNavbar = pages[0]?.navbar || content.navbar;
  const siteFooter = pages[0]?.footer || content.footer;

  const pageSlugs = new Set<string>();
  for (const page of pages) {
    const slug = (page.slug || '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (slug && slug !== '/') pageSlugs.add(slug);
  }

  const files: GeneratedFile[] = pages.map((page) => {
    const slug = (page.slug || '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const filename = slug === '' || slug === '/' ? 'index.html' : `${slug}/index.html`;
    // Merge page-level overrides on top of site-wide defaults
    const mergedPage: PageData = {
      ...page,
      globalStyles: { ...siteGlobalStyles, ...(page.globalStyles || {}) },
      navbar: page.navbar || siteNavbar,
      footer: page.footer || siteFooter,
    };
    return { filename, html: buildPageHtml(mergedPage, siteName, websiteId, undefined, pageSlugs) };
  });

  const baseUrl = (process.env.PUBLISHED_SITES_BASE_URL || 'http://localhost:5000/sites') + '/sites/' + (websiteId || 'site') + '/latest';
  const sitemapEntries = pages.map((page) => {
    const slug = (page.slug || '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const loc = slug === '' || slug === '/' ? baseUrl + '/' : `${baseUrl}/${slug}/`;
    return `  <url><loc>${esc(loc)}</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod></url>`;
  });
  files.push({
    filename: 'sitemap.xml',
    html: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>`,
  });
  files.push({
    filename: 'robots.txt',
    html: `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
  });

  // Rewrite any localhost asset URLs to S3 in the final HTML
  return files.map(f => ({
    ...f,
    html: f.filename.endsWith('.html') ? rewriteAssetUrls(f.html) : f.html,
  }));
};
