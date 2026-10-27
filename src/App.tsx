import { useEffect, useMemo, useRef, useState } from "react";
import { portfolioAssets, type PortfolioAsset } from "./data/assets";
import { dairyImages } from "./data/dairy";
import { translateToZh } from "./i18n";

type Route = { path: string; collection?: string };

const collections = Array.from(new Set(portfolioAssets.map((item) => item.collection)));
const byKind = (kind: string) => portfolioAssets.filter((item) => item.kind === kind);
const coverFor = (name: string) => portfolioAssets.find((item) => item.collection === name)!;
const cleanTitle = (title: string) => title.replace(/[-_]/g, " ").replace(/\s+copy$/i, "");

function currentRoute(): Route {
  const path = window.location.pathname;
  if (path.startsWith("/project/")) return { path: "/project", collection: decodeURIComponent(path.slice(9)) };
  if (path.startsWith("/folder/")) return { path: "/folder", collection: decodeURIComponent(path.slice(8)) };
  return { path };
}

type LogoVariant = "signature" | "compact" | "oval" | "flower";

function FlowerLogo({ variant = "compact" }: { variant?: LogoVariant }) {
  const logoSources: Record<LogoVariant, string> = {
    signature: "/portfolio/brand/christy-ch-signature.png",
    compact: "/portfolio/brand/christy-ch-compact.png",
    oval: "/portfolio/brand/christy-ch-oval.png",
    flower: "/portfolio/brand/christy-flower-badge.png",
  };
  return (
    <svg className={`flower-logo logo-${variant}`} viewBox="0 0 64 64" aria-hidden="true">
      <image href={logoSources[variant]} x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}

type Locale = "en" | "zh-TW";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem("portfolio-locale") === "zh-TW" ? "zh-TW" : "en");

  useEffect(() => {
    localStorage.setItem("portfolio-locale", locale);
    document.documentElement.lang = locale;
    const translateRoot = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = root.nodeType === Node.TEXT_NODE ? [root as Text] : [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      nodes.forEach((node) => {
        if ((node.parentElement?.closest("[data-no-translate]"))) return;
        const current = node.nodeValue ?? "";
        const previousSource = originalText.get(node);
        const previousLeading = previousSource?.match(/^\s*/)?.[0] ?? "";
        const previousTrailing = previousSource?.match(/\s*$/)?.[0] ?? "";
        const previousTranslation = previousSource ? `${previousLeading}${translateToZh(previousSource.trim())}${previousTrailing}` : "";
        if (!previousSource || (current !== previousSource && current !== previousTranslation)) {
          originalText.set(node, current);
        }
        const source = originalText.get(node) ?? "";
        const trimmed = source.trim();
        if (!trimmed) return;
        const leading = source.match(/^\s*/)?.[0] ?? "";
        const trailing = source.match(/\s*$/)?.[0] ?? "";
        const nextValue = locale === "zh-TW" ? `${leading}${translateToZh(trimmed)}${trailing}` : source;
        if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
      });
      const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(document.querySelectorAll("*"));
      elements.forEach((element) => {
        if (element.closest("[data-no-translate]")) return;
        ["aria-label", "alt", "title", "placeholder"].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) return;
          if (!originalAttributes.has(element)) originalAttributes.set(element, new Map());
          const stored = originalAttributes.get(element)!;
          if (!stored.has(attribute)) stored.set(attribute, value);
          const source = stored.get(attribute)!;
          element.setAttribute(attribute, locale === "zh-TW" ? translateToZh(source) : source);
        });
      });
    };
    translateRoot(document.documentElement);
    const observer = new MutationObserver((records) => records.forEach((record) => {
      if (record.type === "characterData") translateRoot(record.target);
      record.addedNodes.forEach(translateRoot);
    }));
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return <div className="language-switcher" data-no-translate>
    <button className={`language-toggle ${locale === "zh-TW" ? "is-zh" : "is-en"}`} type="button" role="switch" aria-checked={locale === "zh-TW"} aria-label={locale === "en" ? "Switch to Traditional Chinese" : "Switch to English"} onClick={() => setLocale((value) => value === "en" ? "zh-TW" : "en")}>
      <span>EN</span><span className="language-toggle-zh">繁中</span>
    </button>
  </div>;
}

function Link({ to, children, className = "", onNavigate }: { to: string; children: React.ReactNode; className?: string; onNavigate: (to: string) => void }) {
  const childText = Array.isArray(children) ? children.filter((child) => typeof child === "string" || typeof child === "number").join("") : typeof children === "string" || typeof children === "number" ? String(children) : "";
  const isBackLink = childText.trim().startsWith("←");
  const destinationLabel = isBackLink ? to === "/design" ? "Back to Graphic Design" : to === "/photography" ? "Back to Photography" : to === "/tech" ? "Back to Creative Tech" : null : null;
  if (isBackLink && !destinationLabel) return null;
  const linkClassName = [className, destinationLabel ? "context-back-link" : ""].filter(Boolean).join(" ");
  return <a className={linkClassName} href={to} onClick={(event) => { event.preventDefault(); onNavigate(to); }}>{destinationLabel ? <><span className="context-back-arrow" aria-hidden="true">←</span><span>{destinationLabel}</span></> : children}</a>;
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 420);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <button className={`scroll-to-top${visible ? " is-visible" : ""}`} type="button" onClick={scrollToTop} aria-label="Scroll back to the top"><span aria-hidden="true">↑</span></button>;
}

function Navbar({ onNavigate }: { onNavigate: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" to="/" onNavigate={onNavigate} aria-label="Christy Ho — home"><FlowerLogo variant="compact" /></Link>
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}><span /><span /><span /><b className="sr-only">Menu</b></button>
      <nav id="main-nav" className={open ? "nav-open" : ""} aria-label="Main navigation">
        <LanguageSwitcher />
        <Link to="/" onNavigate={(to) => { onNavigate(to); setOpen(false); setWorkOpen(false); }}>Home</Link>
        <div className="work-menu">
          <button type="button" aria-haspopup="true" aria-expanded={workOpen} onClick={() => setWorkOpen((value) => !value)}>Work <span aria-hidden="true">↓</span></button>
          <div className={`work-dropdown ${workOpen ? "is-open" : ""}`}>
            <Link to="/photography" onNavigate={(to) => { onNavigate(to); setOpen(false); setWorkOpen(false); }}>Photography</Link>
            <Link to="/design" onNavigate={(to) => { onNavigate(to); setOpen(false); setWorkOpen(false); }}>Graphic Design</Link>
            <Link to="/tech" onNavigate={(to) => { onNavigate(to); setOpen(false); setWorkOpen(false); }}>Creative Tech</Link>
          </div>
        </div>
        <Link to="/contact" onNavigate={(to) => { onNavigate(to); setOpen(false); setWorkOpen(false); }}>About</Link>
      </nav>
    </header>
  );
}

function CursorTrail() {
  const items = dairyImages;
  const [points, setPoints] = useState<{ x: number; y: number; asset: (typeof dairyImages)[number]; id: number }[]>([]);
  const last = useRef({ x: 0, y: 0, index: 0 });
  function move(event: React.PointerEvent<HTMLElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (Math.hypot(x - last.current.x, y - last.current.y) < 110) return;
    const next = { x, y, asset: items[last.current.index % items.length], id: Date.now() };
    last.current = { x, y, index: last.current.index + 1 };
    setPoints((old) => [...old.slice(-4), next]);
  }
  return <div className="trail-zone" onPointerMove={move} aria-hidden="true">{points.map((point) => <img key={point.id} src={point.asset.src} style={{ left: point.x, top: point.y }} alt="" />)}</div>;
}

function Hero({ onNavigate }: { onNavigate: (to: string) => void }) {
  const [tapPhotos, setTapPhotos] = useState<{ x: number; y: number; src: string; id: number }[]>([]);
  const tapPhotoIndex = useRef(0);
  const tapPhotoTimers = useRef<number[]>([]);

  useEffect(() => () => tapPhotoTimers.current.forEach(window.clearTimeout), []);

  const revealPhoto = (event: React.MouseEvent<HTMLElement>) => {
    if (!window.matchMedia("(hover: none), (pointer: coarse)").matches && window.innerWidth > 850) return;
    if ((event.target as HTMLElement).closest("a, button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const image = dairyImages[tapPhotoIndex.current % dairyImages.length];
    tapPhotoIndex.current += 1;
    const id = Date.now() + tapPhotoIndex.current;
    setTapPhotos((current) => [...current.slice(-6), { x: event.clientX - bounds.left, y: event.clientY - bounds.top, src: image.src, id }]);
    const timer = window.setTimeout(() => {
      setTapPhotos((current) => current.filter((photo) => photo.id !== id));
      tapPhotoTimers.current = tapPhotoTimers.current.filter((item) => item !== timer);
    }, 1700);
    tapPhotoTimers.current.push(timer);
  };
  return (
    <section className="home-intro" onClick={revealPhoto}>
      <CursorTrail />
      <div className="mobile-tap-photos" aria-hidden="true">{tapPhotos.map((photo, index) => <img src={photo.src} alt="" key={photo.id} style={{ left: photo.x, top: photo.y, "--tap-index": index } as React.CSSProperties} />)}</div>
      <p className="eyebrow reveal">D E S I G N · C R E A T E · C A P T U R E</p>
      <h1 className="reveal delay-one">Christy Ho</h1>
      <p className="home-subhead reveal delay-one">Making things worth seeing and moments worth keeping.</p>
      <Link className="intro-scroll" to="#work-preview" onNavigate={() => document.querySelector("#work-preview")?.scrollIntoView({ behavior: "smooth" })}>Discover my work <span>↓</span></Link>
      <p className="home-trail-note">move around<br />leave a little trail</p>
      <p className="mobile-tap-note">tap anywhere to reveal a photo ✦</p>
    </section>
  );
}

function ProjectCard({ name, index, onNavigate }: { name: string; index: number; onNavigate: (to: string) => void }) {
  const cover = coverFor(name);
  const count = portfolioAssets.filter((item) => item.collection === name).length;
  return (
    <Link className="project-card" to={`/project/${encodeURIComponent(name)}`} onNavigate={onNavigate}>
      <div className="card-image"><img src={cover.src} alt={`${name} project cover`} loading="lazy" /><span>{String(index + 1).padStart(2, "0")}</span></div>
      <div className="card-meta"><h3>{name.replace(/ — /g, " / ")}</h3><p>{cover.kind} · {count} {count === 1 ? "piece" : "pieces"}</p><b aria-hidden="true">↗</b></div>
    </Link>
  );
}

function FilmStrip({ onNavigate }: { onNavigate: (to: string) => void }) {
  const film = byKind("Photography").filter((item) => item.collection.startsWith("Film")).slice(0, 8);
  return (
    <section className="film-section">
      <div className="section-heading"><div><p className="eyebrow">35mm observations</p><h2>Life, left a little<br /><em>unpolished.</em></h2></div><Link className="round-link" to="/photography" onNavigate={onNavigate}>View photography <span>↗</span></Link></div>
      <div className="film-strip">{film.map((asset) => <figure key={asset.id}><img src={asset.src} alt={cleanTitle(asset.title)} loading="lazy" /></figure>)}</div>
    </section>
  );
}

function ClickyKeeb() {
  const keys = [
    { label: "C", title: "C — Create ✦", message: "I love playing with colors, trying different ideas, and making things that feel like me.", tone: "sage", pitch: 176 },
    { label: "H", title: "H — Hi, It's Me! ♡", message: "Hey, I'm Christy! Just someone who loves being creative and making a little bit of everything.", tone: "cream", pitch: 208 },
    { label: "✿", title: "✿ — Little Moments", message: "I love taking photos, exploring new places, and capturing memories I can look back on.", tone: "brown", pitch: 246 },
    { label: "♥", title: "♥ — Things I Love", message: "Dancing, photography, spending time with my favorite people, and all the little things that make me happy.", tone: "forest", pitch: 294 },
  ];
  const [active, setActive] = useState<number | null>(null);
  const [message, setMessage] = useState("Press a key and say hello.");
  const timer = useRef<number | null>(null);

  const pressKey = (index: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    setActive(index);
    setMessage(`${keys[index].title}\n"${keys[index].message}"`);
    timer.current = window.setTimeout(() => setActive(null), 150);

    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(keys[index].pitch, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(72, audio.currentTime + .055);
    gain.gain.setValueAtTime(.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .075);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .08);
    oscillator.addEventListener("ended", () => audio.close());
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return <section className="clicky-keeb-section">
    <div className="clicky-keeb-copy"><p className="eyebrow">A tiny interactive hello</p><h2>Click into my<br /><em>creative world.</em></h2><p>Hi, I'm Christy! I love bringing ideas to life through graphic design, UI/UX, and creative projects. I enjoy playing with colors, typography, and interactive elements to create designs that feel fun, thoughtful, and full of personality.</p></div>
    <div className="clicky-keeb-stage">
      <span className="keeb-tape" aria-hidden="true" />
      <div className="keeb-cable" aria-hidden="true"><i /></div>
      <div className="keeb-shell" aria-label="Christy's interactive keyboard">
        <div className="keeb-keys">{keys.map((key, index) => <button className={`keeb-key keeb-key-${key.tone}${active === index ? " is-pressed" : ""}`} type="button" onClick={() => pressKey(index)} aria-label={`Press ${key.title}: ${key.message}`} key={key.label}><span>{key.label}</span></button>)}</div>
        <p className="keeb-signature">click · create · care</p>
      </div>
      <p className="keeb-message" aria-live="polite">{message}</p>
      <span className="keeb-doodle" aria-hidden="true">✦</span>
    </div>
  </section>;
}

function Home({ onNavigate }: { onNavigate: (to: string) => void }) {
  const portrait = { src: "/portfolio/about-museum.JPG" };
  const portals = [
    { title: "Photography", note: "Portraits · Digital · Film", path: "/photography", tone: "green" },
    { title: "Graphic Design", note: "Identity · Editorial · Lettering", path: "/design", tone: "brown" },
    { title: "Creative Tech", note: "Creative code · Experiments", path: "/tech", tone: "blue" },
  ];
  return <main id="main"><Hero onNavigate={onNavigate} />
    <section id="work-preview" className="work-preview"><div className="work-preview-heading"><p className="eyebrow">Made along the way · 2024—2026</p><h2>Made in <em>Many Ways.</em></h2><p>A collection of my favorite projects across graphic design, photography, and interactive experiences. Different creative paths, all connected by my love for making and exploring new ideas.</p></div><div className="portal-grid">{portals.map((portal) => <Link className={`work-portal portal-${portal.tone}`} to={portal.path} onNavigate={onNavigate} key={portal.title}><div className="apple-folder" aria-hidden="true"><div className="folder-back" /><div className="folder-paper"><strong>{portal.title}</strong></div><div className="folder-front" /></div><div className="portal-copy"><p>{portal.note}</p><span>Open {portal.title} ↗</span></div></Link>)}</div></section>
    <ClickyKeeb />
    <section className="home-about"><figure className="about-photo"><img src={portrait.src} alt="Portrait of Christy Ho" loading="lazy" /><figcaption>hello, it’s me ♡</figcaption></figure><div className="about-copy"><p className="eyebrow">A little about me</p><h2>More than just design.<br /><em>A little bit of everything.</em></h2><p>When I'm not designing, you'll probably find me taking photos, dancing, hanging out with friends, or exploring new places. I love capturing memories, appreciating the little things, and spending time doing what makes me happy.</p><Link className="text-link" to="/contact" onNavigate={onNavigate}>More about me <span>↗</span></Link></div></section>
  </main>;
}

function PhotoCollectionNav() {
  const [active, setActive] = useState<"digital" | "film">("digital");
  useEffect(() => {
    const sections = ["digital-album", "film-album"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id === "film-album" ? "film" : "digital");
    }, { rootMargin: "-25% 0px -55%", threshold: [0, .2, .5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const jumpTo = (section: "digital" | "film") => {
    setActive(section);
    document.getElementById(`${section}-album`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return <nav className="photo-collection-nav" aria-label="Photography collections">
    <button className={active === "digital" ? "is-active" : ""} type="button" aria-pressed={active === "digital"} onClick={() => jumpTo("digital")}><span aria-hidden="true">01</span>Digital</button>
    <button className={active === "film" ? "is-active" : ""} type="button" aria-pressed={active === "film"} onClick={() => jumpTo("film")}><span aria-hidden="true">02</span>Film</button>
  </nav>;
}

function WorkIndex({ kind, title, intro, onNavigate }: { kind: string; title: string; intro: string; onNavigate: (to: string) => void }) {
  const names = collections.filter((name) => portfolioAssets.some((item) => item.collection === name && item.kind === kind));
  const kindClass = kind.toLowerCase().replace(/[^a-z]+/g, "-");
  if (kind === "Photography") {
    const album = (label: "Digital" | "Film", note: string) => {
      const albumNames = names.filter((name) => name.startsWith(label));
      const entries = label === "Film"
        ? ["Film — B&W Photobooth", "Film — Color"]
        : albumNames.map((name) => name === "Digital — Noelle" ? "Digital — Sam" : name === "Digital — Sam" ? "Digital — Noelle" : name);
      return <section className={`photo-album photo-album-${label.toLowerCase()}`}><header className="album-header"><div><p className="eyebrow">{String(entries.length).padStart(2, "0")} collections · {label}</p><h2>{label === "Digital" ? "People, light & little stories." : "Slow frames, happy accidents."}</h2><p>{note}</p></div></header><div className="album-grid">{entries.map((name, index) => { const isColorFolder = name === "Film — Color"; const related = isColorFolder ? albumNames.filter((item) => item.startsWith("Film — Color — ")) : [name]; const assets = portfolioAssets.filter((item) => related.includes(item.collection)); const path = isColorFolder ? `/folder/${encodeURIComponent(name)}` : `/project/${encodeURIComponent(name)}`; return <Link className="album-card" to={path} onNavigate={onNavigate} key={name} aria-label={`Open ${name.replace(`${label} — `, "")} photography project`}><div className="album-image"><img src={assets[0].src} alt={`${name} collection cover`} loading={index < 3 ? "eager" : "lazy"} /></div></Link>; })}</div></section>;
    };
    return <main id="main" className="inner-page photography-page"><header className="page-hero"><h1>{title}</h1><p>{intro}</p></header><PhotoCollectionNav /><div id="digital-album">{album("Digital", "Portrait sessions and personal studies shaped with color, movement, and a close attention to character.")}</div><div className="album-divider"><span>✿</span><span>✿</span><span>✿</span><span>✿</span><span>✿</span></div><div id="film-album">{album("Film", "Black-and-white booths and color rolls where grain, chance, and ordinary moments get to stay imperfect.")}</div></main>;
  }
  if (kind === "Design") {
    const projects = [
      { key: "Climate Change Poster 2026", label: "This Isn’t: Climate Crisis Posters", collections: names.filter((name) => name.startsWith("Climate Change Poster 2026 — ")), destination: "/folder/Climate%20Change%20Poster%202026", year: "2026" },
      { key: "Y2K Magazine", label: "IDLE: Y2K Magazine", collections: ["Y2K Magazine"], destination: "/folder/Y2K%20Magazine", year: "2026" },
      { key: "CSUF Business Web Icons and Silhouettes", label: "Icons & Silhouettes", collections: ["CSUF Business Web Icons and Silhouettes — Icons", "CSUF Business Web Icons and Silhouettes"], destination: "/folder/CSUF%20Business%20Web%20Icons%20and%20Silhouettes", year: "2026" },
      { key: "CSUF Taiwanese Student Association", label: "Photobooth & Stamp Cards", collections: ["CSUF Taiwanese Student Association"], destination: "/project/CSUF%20Taiwanese%20Student%20Association", year: "2026" },
      { key: "CSUF Taiwanese Student Association — T-Shirt", label: "Cultural T-Shirt Design", collections: ["CSUF Taiwanese Student Association — T-Shirt"], destination: "/project/CSUF%20Taiwanese%20Student%20Association%20%E2%80%94%20T-Shirt", year: "2025" },
      { key: "CSUF Taiwanese Student Association — Stickers", label: "Cultural Stickers Design", collections: ["CSUF Taiwanese Student Association — Stickers"], destination: "/project/CSUF%20Taiwanese%20Student%20Association%20%E2%80%94%20Stickers", year: "2024" },
      { key: "Event Branding", label: "Lunar New Year Event Branding", collections: ["Event Branding"], destination: "/project/Event%20Branding", year: "2025" },
      { key: "Lettering", label: "Shego: Villain Lettering", collections: ["Lettering"], destination: "/project/Lettering", year: "2025" },
      { key: "Typography Brochure", label: "Typography 101 Brochure", collections: ["Typography Brochure"], destination: "/project/Typography%20Brochure", year: "2024" },
    ];
    const coverIds: Record<string, string> = {
      "CSUF Business Web Icons and Silhouettes — Icons": "design-000-accounting-technology-and-data-analytics",
      "CSUF Business Web Icons and Silhouettes": "design-005-silhouette-design-men-400x300png",
      "CSUF Taiwanese Student Association — Stickers": "design-stickers-img-1665",
      "CSUF Taiwanese Student Association — T-Shirt": "design-017-tsa25-26-copy",
      "CSUF Taiwanese Student Association": "design-020a-csuf-tsa-logo",
      "Climate Change Poster 2026": "design-024-poster-project-1-07",
      "Event Branding": "design-event-branding-social-2027",
      "Lettering": "design-034-shegoo",
      "Y2K Magazine": "design-036-final-magazine",
      "Typography Brochure": "design-041-brochure-front",
    };
    const simpleCoverSources: Record<string, string> = {
      "Climate Change Poster 2026": "/portfolio/design/stop-climate-change-transparent.png",
      "Y2K Magazine": "/portfolio/design/y2k-magazine/idle-masthead-transparent.png",
      "CSUF Taiwanese Student Association": "/portfolio/design/tsa-photobooth-lettering-transparent.png",
      "CSUF Taiwanese Student Association — T-Shirt": "/portfolio/design/tsa-shirt-logo-transparent-v2.png",
      "CSUF Taiwanese Student Association — Stickers": "/portfolio/design/sticker-boba-transparent.png",
      "Event Branding": "/portfolio/design/event-branding/lunar-new-year-logo-transparent.png",
      "Typography Brochure": "/portfolio/design/typography-101-mark-dark-brown-transparent.png",
    };
    return <main id="main" className="inner-page work-index work-index-design"><header className="page-hero"><h1>{title}</h1><p>{intro}</p></header><div className="design-project-grid">{projects.map((project, index) => {
      const assets = portfolioAssets.filter((item) => project.collections.includes(item.collection));
      const cover = portfolioAssets.find((item) => item.id === coverIds[project.key]) ?? assets[0];
      const coverSrc = simpleCoverSources[project.key] ?? cover.src;
      const isSimpleCover = Boolean(simpleCoverSources[project.key]) || ["CSUF Business Web Icons and Silhouettes", "CSUF Taiwanese Student Association", "CSUF Taiwanese Student Association — T-Shirt", "CSUF Taiwanese Student Association — Stickers", "Lettering"].includes(project.key);
      const isBusinessCover = project.key === "CSUF Business Web Icons and Silhouettes";
      const isPhotoboothCover = project.key === "CSUF Taiwanese Student Association";
      const isTshirtCover = project.key === "CSUF Taiwanese Student Association — T-Shirt";
      const isEventCover = project.key === "Event Branding";
      const isStickerCover = project.key === "CSUF Taiwanese Student Association — Stickers";
      const isY2kCover = project.key === "Y2K Magazine";
      const isTypographyCover = project.key === "Typography Brochure";
      const isClimateCover = project.key === "Climate Change Poster 2026";
      return <Link className={`design-direct-project direct-color-${index % 4}${isSimpleCover ? " design-simple-cover" : ""}${isBusinessCover ? " design-business-cover" : ""}${isPhotoboothCover ? " design-photobooth-cover" : ""}${isTshirtCover ? " design-tshirt-cover" : ""}${isEventCover ? " design-event-cover" : ""}${isStickerCover ? " design-sticker-cover" : ""}${isY2kCover ? " design-y2k-cover" : ""}${isTypographyCover ? " design-typography-cover" : ""}${isClimateCover ? " design-climate-cover" : ""}`} to={project.destination} onNavigate={onNavigate} key={project.key} aria-label={`Open ${project.label}`}><div className="design-direct-image"><img className={isPhotoboothCover ? "photobooth-cover-color" : undefined} src={coverSrc} alt={`${project.label} project preview`} loading={index < 3 ? "eager" : "lazy"} />{isPhotoboothCover && <img className="photobooth-cover-black" src={coverSrc} alt="" aria-hidden="true" />}</div><div className="design-direct-copy"><small className="design-card-kicker">Graphic Design</small><strong>{project.label}</strong><small className="design-card-meta">{project.year}<span aria-hidden="true">View project ↗</span></small></div></Link>;
    })}</div></main>;
  }
  if (kind === "Tech") {
    const folderYears: Record<string, string> = { "Kiosk Design": "2025", "Vinyl Front:Back Cover using Processing ": "2026" };
    const folderTitles: Record<string, string> = { "Kiosk Design": "MILK+T: Boba Kiosk Design", "Vinyl Front:Back Cover using Processing ": "Generative Vinyl Design", "Drink (Shot) Dispenser": "Drink (Shot) Dispenser" };
    return <main id="main" className="inner-page work-index work-index-tech"><header className="page-hero"><h1>{title}</h1><p>{intro}</p></header><div className="keepsake-project-grid">{names.map((folder, index) => { const assets = portfolioAssets.filter((item) => item.collection === folder); const folderTitle = folderTitles[folder] ?? folder.trim(); return <Link className={`exact-keepsake keepsake-color-${index % 4}`} to={`/project/${encodeURIComponent(folder)}`} onNavigate={onNavigate} key={folder} aria-label={`Open ${folderTitle}`}><div className="exact-keepsake-photos" aria-hidden="true">{assets.slice(0, 3).map((asset, assetIndex) => <img className={`exact-photo exact-photo-${assetIndex + 1}`} src={asset.src} alt="" loading="eager" key={asset.id} />)}</div><div className="exact-keepsake-front"><div className="exact-stickers" aria-hidden="true"><FlowerLogo variant="flower" /><span>✿</span></div><div className="exact-label"><strong>{folderTitle}</strong><small>{folderYears[folder] ?? "2026"}</small></div></div></Link>; })}</div></main>;
  }
  return <main id="main" className={`inner-page work-index work-index-${kindClass}`}><header className="page-hero"><h1>{title}</h1><p>{intro}</p></header><div className="showcase-grid">{names.map((name, index) => { const cover = coverFor(name); const count = portfolioAssets.filter((item) => item.collection === name).length; const displayName = name === "Digital — FUFU" ? "UC San Diego Graduation Portraits" : name === "Digital — Noelle" ? "CSUF Graduation Portraits" : name === "Digital — Sam" ? "UCLA Graduation Portraits" : name === "Digital — Self-Portrait" ? "Petals & Identity" : name === "Film — B&W Photobooth" ? "Behind the Curtain" : name === "Film — Color" ? "Same Place, Different Moments" : name === "Kiosk Design" ? "MILK+T: Boba Kiosk Design" : name.startsWith("Vinyl Front:Back Cover") ? "Generative Vinyl Design" : name.replace(/ — /g, " / "); return <Link className={`showcase-card${name === "Kiosk Design" ? " kiosk-showcase-card" : ""}`} to={`/project/${encodeURIComponent(name)}`} onNavigate={onNavigate} key={name}><div className="showcase-image"><img src={cover.src} alt={`${displayName} collection cover`} loading={index < 3 ? "eager" : "lazy"} /><span className="showcase-index">{String(index + 1).padStart(2, "0")}</span><span className="showcase-open">Open collection ↗</span></div><div className="showcase-copy"><p>{cover.kind} · {count} {count === 1 ? "piece" : "pieces"}</p><h2>{displayName}</h2><span aria-hidden="true">↗</span></div></Link>; })}</div></main>;
}

const projectStories: Record<string, { title: string; category: string; description: string; approach?: string }> = {
  "Digital — FUFU": { title: "UC San Diego Graduation Portraits", category: "2026 | Portrait Photography · Graduation", description: "A graduation portrait session at UC San Diego celebrating an important milestone. Through natural lighting, thoughtful composition, and a mix of candid and posed portraits, I focused on capturing the graduate’s personality and the excitement of this special moment.", approach: "I used the campus architecture, concrete textures, and natural light to create a clean, timeless look. By exploring different angles and compositions, I aimed to balance the graduate with her surroundings while keeping the photographs natural and personal." },
  "Digital — Noelle": { title: "CSUF Graduation Portraits", category: "2025 | Portrait Photography · Graduation", description: "A graduation photography session at California State University, Fullerton, celebrating the Class of 2025. I focused on capturing the graduate’s personality, happiness, and memorable moments through a combination of individual portraits and photographs with family.", approach: "I used natural sunlight and the campus surroundings to create warm, bright portraits. By experimenting with different angles, poses, and compositions, I aimed to capture both the excitement of graduation and the meaningful moments shared with loved ones." },
  "Digital — Sam": { title: "UCLA Graduation Portraits", category: "2026 | Portrait Photography · Graduation", description: "A graduation portrait session at the University of California, Los Angeles, celebrating the Class of 2026. I focused on capturing the graduate’s personality and this special milestone through a mix of natural, relaxed poses and thoughtfully composed portraits.", approach: "I used UCLA’s historic architecture, surrounding greenery, and natural sunlight to create a warm, timeless atmosphere. By experimenting with different angles, lighting, and framing, I aimed to highlight the graduate while incorporating the campus’s architectural details into each photograph." },
  "Digital — Self-Portrait": { title: "Petals & Identity", category: "2025 | Self-Portrait Photography · Cultural Identity", description: "A self-portrait photography series exploring my Taiwanese cultural identity through color, lighting, fashion, and personal expression. Using vibrant red, pink, and purple lighting, delicate orchid flowers, and a vintage plaid dress, I created portraits that reflect my cultural background and personal style.", approach: "I experimented with colorful lighting, soft shadows, and different compositions to create a dreamy yet expressive atmosphere. The orchid flowers introduce a delicate, symbolic element, while the vintage plaid dress adds a nostalgic touch. Through close-up details and expressive poses, I explored how photography can communicate identity, emotion, and personal storytelling." },
  "Film — B&W Photobooth": { title: "Behind the Curtain", category: "Film Photography | Black & White · Ilford HP5 Plus", description: "Photobooths have always been something I enjoy because they capture little moments and emotions that feel natural and personal. Through this photography series, I wanted to tell the story of the photobooth experience from my own point of view—not just the final photos, but also the moments before, during, and after stepping inside.", approach: "I wanted to capture the change in my emotions throughout the experience, starting with a serious expression, slowly becoming more comfortable, and eventually showing my playful and silly side. I explored different expressions, movement, reflections, and lighting to create a nostalgic feeling. The series represents how a small, ordinary experience like taking photobooth pictures can become a meaningful memory filled with different sides of myself." },
  "Film — Color": { title: "Same Place, Different Moments", category: "Color Film Photography | Kodak Gold 200", description: "This photography series explores how natural light, color, and human presence can transform the same location throughout the day. From bright daylight and warm golden hour to the soft blue and purple tones of twilight, each photograph captures a different atmosphere within the same coastal landscape.", approach: "I wanted to capture how a familiar place can feel completely different depending on the time of day and what is happening within the frame. By keeping the same composition, I focused on the changing colors of the sky, reflections on the water, and the movement of people passing through the scene. I also photographed each setting without people to create a quieter version of the same environment. Presented together, the contrast between movement and stillness shows how the same place can tell different stories from the exact same perspective." },
  "CSUF Taiwanese Student Association — Stickers": { title: "Stickers", category: "Illustration / Cultural identity", description: "A set of illustrated stickers designed for CSUF TSA, featuring playful characters inspired by culture and Taiwanese identity. The project focuses on building a cohesive visual style through consistent shapes, colors, and expressive details." },
  "CSUF Taiwanese Student Association — T-Shirt": { title: "T-Shirt Design", category: "Apparel / Visual identity", description: "A stamp-inspired T-shirt design that represents the CSUF Taiwanese Student Association through cultural elements. The layout combines typography and illustration to create a cohesive and adaptable apparel graphic." },
  "Lettering": { title: "Villains Lettering", category: "Custom lettering / Applications", description: "Custom lettering inspired by the character Shego, designed to reflect a bold and edgy personality. The project explores how typography can communicate mood and identity across different applications." },
  "Event Branding": { title: "Amusement Park Events", category: "Brand identity / Environmental design", description: "A branding system developed and mocked up for a Lunar New Year theme park event, translating cultural elements into a contemporary visual language. The project extends across merchandise, packaging, and environmental applications, creating a cohesive and immersive brand experience across multiple touchpoints." },
  "Kiosk Design": { title: "MILK+T: Boba Kiosk Design", category: "UI/UX Design / Interface Design / Visual Identity", description: "A clean, welcoming self-service ordering experience for a fictional bubble tea shop." },
  "Vinyl Front:Back Cover using Processing ": { title: "Generative Vinyl Design", category: "Generative Art / Packaging Design / Creative Coding", description: "A code-generated vinyl record package inspired by the song BOMB by ILLIT." },
  "Typography Brochure": { title: "Brochure", category: "Editorial / Typography", description: "A visually driven brochure that explores typography through layout, scale, and hierarchy. Instead of simply explaining concepts, the design uses composition and spacing to demonstrate how type functions in practice." },
  "Y2K Magazine": { title: "Magazine", category: "Editorial / Y2K visual culture", description: "A magazine design titled Idle, inspired by Y2K aesthetics and exploring themes of nostalgia and digital culture. The layouts combine expressive typography and layered imagery to create dynamic spreads." },
};

function PhotographyStory({ story }: { story: { description: string; approach?: string } }) {
  if (!story.approach) return null;
  return <section className="photography-project-story"><article><p className="eyebrow">Overview</p><p>{story.description}</p></article><article><p className="eyebrow">Concept &amp; Photography Approach</p><p>{story.approach}</p></article></section>;
}

function Y2KFlipbook() {
  const flipbookUrl = "https://online.fliphtml5.com/christyHo/Final_Magazine/";
  return <section className="y2k-flipbook-feature"><header><p className="eyebrow">Turn the pages, zoom into the layouts, or view the magazine in fullscreen.</p></header><div className="fliphtml5-frame"><iframe src={flipbookUrl} title="IDLE Y2K Magazine interactive flipbook" loading="eager" allow="fullscreen" allowFullScreen /></div></section>;
}

function Y2KMockupGallery({ mockups }: { mockups: { src: string; alt: string }[] }) {
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + mockups.length) % mockups.length);
  return <section className="y2k-mockup-showcase"><header><p className="eyebrow">Magazine in context</p><p>Select a spread to explore the publication.</p></header><div className="y2k-showcase-stage"><button type="button" className="y2k-showcase-arrow y2k-showcase-prev" onClick={() => move(-1)} aria-label="Show previous magazine mockup">←</button><figure><img src={mockups[active].src} alt={mockups[active].alt} /><figcaption><span>{String(active + 1).padStart(2, "0")} / {String(mockups.length).padStart(2, "0")}</span><span>{mockups[active].alt}</span></figcaption></figure><button type="button" className="y2k-showcase-arrow y2k-showcase-next" onClick={() => move(1)} aria-label="Show next magazine mockup">→</button></div><div className="y2k-showcase-thumbnails" aria-label="Choose a magazine mockup">{mockups.map((mockup, index) => <button type="button" className={index === active ? "is-active" : ""} onClick={() => setActive(index)} aria-label={`Show mockup ${index + 1}`} aria-pressed={index === active} key={mockup.src}><img src={mockup.src} alt="" loading="lazy" /><span>{String(index + 1).padStart(2, "0")}</span></button>)}</div></section>;
}

function BusinessProfileMockup({ silhouettes }: { silhouettes: PortfolioAsset[] }) {
  const [activeProfile, setActiveProfile] = useState(0);
  const profiles = [
    { name: "Ethan Alvarez", type: "Men", concentration: "Accounting & Finance", aspiration: "Financial Analyst", year: "Class of 2026" },
    { name: "Jordan Chen", type: "Gender-inclusive", concentration: "Business Analytics", aspiration: "Strategy Consultant", year: "Class of 2027" },
    { name: "Maya Patel", type: "Women", concentration: "Corporate Accounting", aspiration: "CPA", year: "Class of 2026" },
  ];
  return <div className="business-profile-demo"><div className="business-profile-toolbar"><div><span className="profile-status-dot" />Live directory preview</div><p>Select a profile</p></div><div className="business-profile-grid">{silhouettes.map((item, index) => { const profile = profiles[index] ?? profiles[0]; const isActive = activeProfile === index; return <button className={`business-profile-card${isActive ? " is-active" : ""}`} type="button" key={item.id} onClick={() => setActiveProfile(index)} aria-pressed={isActive}><span className="profile-image-wrap"><img src={item.src} alt={`${profile.type} profile placeholder`} loading="lazy" /><span className="profile-availability" aria-label="Available" /></span><span className="profile-card-copy"><span className="profile-year">{profile.year}</span><strong>{profile.name}</strong><span>{profile.concentration}</span></span><span className="profile-open-label">{isActive ? "Selected" : "Select profile"} <span aria-hidden="true">↗</span></span></button>; })}</div></div>;
}

function FolderPage({ folder, onNavigate }: { folder: string; onNavigate: (to: string) => void }) {
  const folderCollections = collections.filter((name) => name === folder || name.startsWith(`${folder} — `));
  if (!folderCollections.length) return <NotFound onNavigate={onNavigate} />;
  if (folder === "Y2K Magazine") {
    const magazineMockups = [
      { src: "/portfolio/design/y2k-magazine/cover-open-mockup.jpg", alt: "IDLE magazine front and back covers displayed as an open publication" },
      { src: "/portfolio/design/y2k-magazine/cover-table-mockup.jpg", alt: "IDLE magazine covers arranged on a woven table" },
      { src: "/portfolio/design/y2k-magazine/feature-article-mockup.jpg", alt: "IDLE Y2K feature article editorial spread mockup" },
      { src: "/portfolio/design/y2k-magazine/department-real-time-spread.jpg", alt: "IDLE magazine Real Time editorial department spread mockup" },
      { src: "/portfolio/design/y2k-magazine/department-mode-spread.jpg", alt: "IDLE magazine Mode editorial department spread mockup" },
      { src: "/portfolio/design/y2k-magazine/feature-capturing-real-spread.jpg", alt: "IDLE magazine Capturing What Feels Real photography feature opening spread" },
      { src: "/portfolio/design/y2k-magazine/feature-camera-story-spread.jpg", alt: "IDLE magazine photography feature spread about digital cameras and memory" },
    ];
    return <main id="main" className="y2k-case-study">
      <header className="y2k-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <h1><em>IDLE:</em> Y2K Magazine</h1>
        <div className="y2k-project-meta"><div><span>Category</span><strong>Editorial Design / Typography</strong></div><div><span>Year</span><strong>2026</strong></div></div>
      </header>
      <section className="y2k-centered-story y2k-overview-section">
        <header><p className="y2k-section-number">01</p><p className="eyebrow">Overview</p></header>
        <p>IDLE is a Y2K-inspired editorial magazine exploring the relationship between early 2000s culture, technology, fashion, and identity. Rather than treating Y2K as simply a nostalgic aesthetic, the magazine examines how the era’s optimism, uncertainty, and evolving digital culture continue to influence contemporary visual trends.</p>
      </section>
      <section className="y2k-story-section y2k-concept-section">
        <p className="y2k-section-number">02</p><div className="y2k-concept-visual"><p className="eyebrow">Concept &amp; Design Approach</p><figure className="y2k-concept-masthead"><img src="/portfolio/design/y2k-magazine/idle-masthead-transparent.png" alt="IDLE magazine title design" loading="lazy" /></figure></div>
        <div className="y2k-story-copy"><p>The magazine combines nostalgic digital aesthetics with a contemporary editorial approach. Its visual direction draws inspiration from early internet culture through layered photography, glossy textures, subtle gradients, and experimental typography.</p><p>A distinctive title treatment establishes the magazine’s identity, while a balance of expressive display type and readable body typography supports both visual personality and editorial clarity. The design aims to capture the energy of the Y2K era without compromising readability.</p></div>
      </section>
      <section className="y2k-centered-story y2k-editorial-section">
        <header><p className="y2k-section-number">03</p><p className="eyebrow">Editorial Direction</p></header>
        <div className="y2k-story-copy"><p>A central focus of IDLE is the contrast between Western and Asian interpretations of Y2K culture. Through topics such as fashion, music, technology, and media, the magazine explores how different cultural perspectives shaped ideas about the future.</p><p>This editorial direction informed a visual identity that balances nostalgia with thoughtful storytelling, creating a publication intended to feel both culturally relevant and visually engaging.</p></div>
      </section>
      <Y2KMockupGallery mockups={magazineMockups} />
      <Y2KFlipbook />
    </main>;
  }
  if (folder === "Film — Color") {
    const colorPhotos = portfolioAssets.filter((item) => folderCollections.includes(item.collection));
    const colorStory = projectStories[folder];
    return <main id="main" className="color-folder-page photography-story-page"><header className="color-folder-hero"><Link to="/photography" onNavigate={onNavigate}>← All photography</Link><p className="eyebrow">{colorStory.category}</p><h1>{colorStory.title}</h1></header><PhotographyStory story={colorStory} /><PhotographyGallery items={colorPhotos} variant="color-film-gallery" /></main>;
  }
  if (folder === "Climate Change Poster 2026") {
    const finalPosters = portfolioAssets.filter((item) => item.collection === "Climate Change Poster 2026 — Final Verson");
    const explorationPosters = portfolioAssets.filter((item) => item.collection === "Climate Change Poster 2026 — Ver.1");
    const mockups = [
      { src: "/portfolio/design/climate-change/climate-trash-mockup.png", alt: "This Isn't Trash climate poster displayed at an airport terminal" },
      { src: "/portfolio/design/climate-change/climate-series-mockup.png", alt: "Complete This Isn't Climate Crisis poster campaign displayed along an escalator" },
      { src: "/portfolio/design/climate-change/climate-forest-mockup.png", alt: "This Isn't Forest climate poster displayed near an airport security checkpoint" },
    ];
    return <main id="main" className="climate-case-study">
      <header className="climate-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <h1>This Isn’t: <em>Climate Crisis Posters</em></h1>
        <div className="climate-project-meta"><div><span>Category</span><strong>Poster Design / Visual Communication</strong></div><div><span>Year</span><strong>2026</strong></div></div>
      </header>
      <section className="climate-story-section climate-overview">
        <p className="climate-section-number">01</p><div><p className="eyebrow">Overview</p></div>
        <p><em>This Isn’t: Climate Crisis</em> is a three-part poster campaign addressing the environmental consequences of pollution, plastic waste, and deforestation. Through bold typography, expressive illustrations, and thought-provoking wordplay, the series challenges familiar perceptions of environmental issues and encourages viewers to reconsider their impact on the planet.</p>
      </section>
      <section className="climate-poster-section">
        <header><p className="eyebrow">Final direction / Three-part series</p></header>
        <div className="climate-poster-grid climate-final-grid">{finalPosters.map((poster, index) => <figure key={poster.id}><img src={poster.src} alt={`This Isn't Climate Crisis final poster ${index + 1}`} loading={index < 3 ? "eager" : "lazy"} /></figure>)}</div>
      </section>
      <section className="climate-story-section climate-concept">
        <p className="climate-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p></div>
        <div className="climate-story-copy"><p>The campaign is built around the repeated phrase “This Isn’t,” creating a consistent narrative across three distinct environmental messages. Each poster combines metaphorical illustrations with unexpected statements to communicate the urgency of climate change without relying on conventional environmental imagery.</p><p>Distressed typography, hand-drawn illustrations, and high-contrast compositions establish a bold visual identity. The consistent placement of text and imagery creates a cohesive series while allowing each poster to communicate its own message.</p></div>
      </section>
      <section className="climate-exploration-section">
        <div className="climate-exploration-copy"><p className="climate-section-number">03</p><p className="eyebrow">Design Exploration</p><p>I explored two visual directions during the design process: a vibrant, colorful approach and a darker, more dramatic composition. After comparing both, I selected the black-background series to emphasize the illustrated details and strengthen the overall visual impact.</p><p>The final direction incorporates glowing illustrations, selective red accents, and textured lettering to create a sense of urgency while maintaining visual consistency across all three posters.</p></div>
        <div className="climate-exploration-grid">{explorationPosters.map((poster, index) => <figure key={poster.id}><img src={poster.src} alt={`Early colorful climate poster exploration ${index + 1}`} loading="lazy" /></figure>)}</div>
      </section>
      <section className="climate-mockup-section">
        <header><p className="eyebrow">Campaign in context</p></header>
        <div className="climate-mockup-grid">{mockups.map((mockup, index) => <figure className={`climate-mockup climate-mockup-${index + 1}`} key={mockup.src}><img src={mockup.src} alt={mockup.alt} loading="lazy" /></figure>)}</div>
      </section>
    </main>;
  }
  if (folder === "CSUF Business Web Icons and Silhouettes") {
    const icons = portfolioAssets.filter((item) => item.collection === "CSUF Business Web Icons and Silhouettes — Icons");
    const silhouettes = portfolioAssets.filter((item) => item.collection === "CSUF Business Web Icons and Silhouettes");
    return <main id="main" className="business-case-study">
      <header className="business-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <h1>Icons &amp; Silhouettes</h1>
        <div className="business-project-meta"><div><span>Category</span><strong>Icon Design / Digital Illustration / Web Design</strong></div><div><span>Year</span><strong>2026</strong></div></div>
      </header>
      <section className="business-story-section">
        <p className="business-section-number">01</p><div><p className="eyebrow">Overview</p></div>
        <p><em>Icons &amp; Silhouettes</em> is a collection of digital graphics I created as a Creative Assistant for the CSUF College of Business and Economics. The project focuses on creating clear and consistent visuals for the college’s website, helping organize academic information and improve the appearance of student and faculty profiles.</p>
      </section>
      <section className="business-visual-section business-icon-section">
        <header><p className="eyebrow">Accounting icon system</p></header>
        <div className="business-icon-grid">{icons.map((item, index) => <figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index < 3 ? "eager" : "lazy"} /><figcaption>{cleanTitle(item.title).replace("Financial Reporting", "Financial\u00a0Reporting")}</figcaption></figure>)}</div>
      </section>
      <section className="business-story-section">
        <p className="business-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p></div>
        <div className="business-story-copy"><p>The project includes two sets of designs: accounting icons and profile silhouettes. I created five icons representing different accounting areas using simple illustrations, clean lines, and matching circular layouts. The navy, orange, and white colors follow the college’s branding while making each icon easy to recognize.</p><p>For the student and faculty directory, I designed three profile silhouettes: a man, a woman, and a gender-neutral person. These illustrations can be used as placeholder images when students or faculty members don’t have a personal photo on the website. This helps keep the directory looking complete and consistent.</p></div>
      </section>
      <section className="business-visual-section business-profile-section">
        <header><p className="eyebrow">Profile silhouettes / Website application</p></header>
        <BusinessProfileMockup silhouettes={silhouettes} />
      </section>
      <section className="business-story-section business-integration-section">
        <p className="business-section-number">03</p><div><p className="eyebrow">Web Design Integration</p></div>
        <div className="business-story-copy"><p>Both sets of graphics were designed to work with the college’s existing website. The accounting icons help visitors identify different academic areas, while the silhouettes provide a simple solution for profiles without photos.</p><p>This project shows how I use illustration and visual design to create graphics that are both useful and consistent with an existing brand.</p></div>
      </section>
    </main>;
  }
  return <main id="main" className={`folder-page${folder === "CSUF Business Web Icons and Silhouettes" ? " folder-page-business-assets" : ""}`}><header className="folder-hero"><Link to="/design" onNavigate={onNavigate}>← All graphic design</Link><p className="eyebrow">Graphic Design / Folder</p><h1>{folder}</h1><p>Open a section below to explore the work inside.</p></header><div className="folder-sections">{folderCollections.map((name, index) => { const items = portfolioAssets.filter((item) => item.collection === name); const isTsaShirtFolder = name === "CSUF Taiwanese Student Association — T-Shirt"; const isTsaMainFolder = name === "CSUF Taiwanese Student Association"; const cover = isTsaShirtFolder ? items.find((item) => item.title === "TSA25-261 copy") ?? items[0] : items[0]; const label = name === folder ? "Main project" : name.replace(`${folder} — `, ""); return <Link className={`folder-section-card${isTsaShirtFolder ? " folder-section-card-shirt" : ""}${isTsaMainFolder ? " folder-section-card-tsa-main" : ""}`} to={`/project/${encodeURIComponent(name)}`} onNavigate={onNavigate} key={name}><div className="folder-section-image"><img src={cover.src} alt={`${label} preview`} /><span>0{index + 1}</span></div><div><p>{items.length} {items.length === 1 ? "piece" : "pieces"}</p><h2>{label}</h2><span>View section ↗</span></div></Link>; })}</div></main>;
}

function PhotographyGallery({ items, variant = "" }: { items: PortfolioAsset[]; variant?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const close = () => setActive(null);
  const move = (step: number) => setActive((current) => current === null ? null : (current + step + items.length) % items.length);
  useEffect(() => {
    if (active === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keys); };
  }, [active, items.length]);
  return <><div className={`ok-gallery${variant ? ` ${variant}` : ""}`}>{items.map((item, index) => <button className="ok-gallery-item" type="button" onClick={() => setActive(index)} style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }} key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index < 4 ? "eager" : "lazy"} onLoad={(event) => { const ratio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight; event.currentTarget.parentElement?.style.setProperty("--photo-ratio", ratio.toFixed(3)); }} /></button>)}</div>{active !== null && <div className="ok-lightbox" role="dialog" aria-modal="true" aria-label="Photography lightbox" onClick={close}><button className="ok-close" type="button" onClick={close} aria-label="Close lightbox">×</button><button className="ok-prev" type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="Previous photograph">←</button><figure onClick={(event) => event.stopPropagation()}><img src={items[active].src} alt={cleanTitle(items[active].title)} /><figcaption>{active + 1} / {items.length}</figcaption></figure><button className="ok-next" type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="Next photograph">→</button></div>}</>;
}

function FilmNegativeGallery({ items }: { items: PortfolioAsset[] }) {
  const [active, setActive] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const move = (step: number) => setActive((current) => current === null ? null : (current + step + items.length) % items.length);
  useEffect(() => {
    if (active === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keys); };
  }, [active, items.length]);
  return <section className="negative-gallery" aria-label="Black and white photobooth film strip"><div className="negative-guide"><span>Scroll the film</span><span aria-hidden="true">← drag →</span></div><div className="negative-scroller" ref={strip} onWheel={(event) => { if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && strip.current) strip.current.scrollLeft += event.deltaY; }}><div className="negative-track">{items.map((item, index) => <button type="button" className="negative-frame" onClick={() => setActive(index)} key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index < 4 ? "eager" : "lazy"} /></button>)}</div></div>{active !== null && <div className="ok-lightbox" role="dialog" aria-modal="true" aria-label="Photobooth lightbox" onClick={() => setActive(null)}><button className="ok-close" type="button" onClick={() => setActive(null)} aria-label="Close lightbox">×</button><button className="ok-prev" type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="Previous photograph">←</button><figure onClick={(event) => event.stopPropagation()}><img src={items[active].src} alt={cleanTitle(items[active].title)} /><figcaption>{active + 1} / {items.length}</figcaption></figure><button className="ok-next" type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="Next photograph">→</button></div>}</section>;
}

function VinylRecordShowcase({ items }: { items: PortfolioAsset[] }) {
  const [revealed, setRevealed] = useState(false);
  return <section className="vinyl-showcase"><button className={`vinyl-component${revealed ? " vinyl-revealed" : ""}`} type="button" onClick={() => setRevealed((value) => !value)} aria-pressed={revealed} aria-label={revealed ? "Slide record back into its cover" : "Reveal the vinyl record"}><div className="vinyl-disc" aria-hidden="true"><div className="vinyl-grooves" /><div className="vinyl-label"><img src="/portfolio/tech/vinyl-record-label-cropped.png" alt="" /></div></div><div className="vinyl-sleeve"><img src="/portfolio/tech/vinyl-cover-full-bleed.jpg" alt="Vinyl cover artwork" /><span className="vinyl-light" /></div><span className="vinyl-hint">{revealed ? "Close" : "Reveal"} ↗</span></button></section>;
}

function TsaPhotoBooth() {
  const [phase, setPhase] = useState<"idle" | "countdown" | "flash" | "printing" | "done">("idle");
  const [countdown, setCountdown] = useState(3);
  const [shot, setShot] = useState(0);
  const [runIndex, setRunIndex] = useState(0);
  const [prints, setPrints] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  const examples = ["/portfolio/design/tsa-end-of-year-example-group.jpg", "/portfolio/design/tsa-end-of-year-example-duo.jpg"];
  const example = examples[runIndex % examples.length];
  const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);
  const later = (callback: () => void, delay: number) => { timers.current.push(window.setTimeout(callback, delay)); };
  const takeShot = (index: number, activeRun: number) => {
    setShot(index);
    setPhase("countdown");
    setCountdown(3);
    later(() => setCountdown(2), 500);
    later(() => setCountdown(1), 1000);
    later(() => {
      setPhase("flash");
      later(() => {
        if (index < 2) takeShot(index + 1, activeRun);
        else {
          setPhase("printing");
          setPrints((current) => current.includes(examples[activeRun]) ? current : [...current, examples[activeRun]]);
          later(() => setPhase("done"), 1800);
        }
      }, 360);
    }, 1500);
  };
  const start = () => { const activeRun = phase === "done" ? (runIndex + 1) % examples.length : runIndex; clearTimers(); setRunIndex(activeRun); takeShot(0, activeRun); };
  const reset = () => { clearTimers(); setPhase("idle"); setShot(0); setCountdown(3); setRunIndex(0); setPrints([]); };
  const positions = ["center 4%", "center 31%", "center 58%"];
  return <section className={`tsa-photo-booth is-${phase}`} aria-label="Interactive TSA photo booth">
    <div className="tsa-booth-camera">
      <div className="tsa-booth-lens" aria-hidden="true" />
      <div className="tsa-booth-screen" style={{ backgroundImage: `url(${example})`, backgroundPosition: positions[shot] }}>
        {phase === "idle" && <p>Ready for three photos?</p>}
        {phase === "countdown" && <strong>{countdown}</strong>}
        {phase === "flash" && <span className="tsa-camera-flash" />}
        {(phase === "printing" || phase === "done") && <p>Printing your strip…</p>}
      </div>
      <div className="tsa-shot-dots" aria-label={`${Math.min(shot + (phase === "flash" || phase === "printing" || phase === "done" ? 1 : 0), 3)} of 3 photos taken`}><i className={shot > 0 || phase === "flash" || phase === "printing" || phase === "done" ? "is-filled" : ""} /><i className={shot > 1 || (shot === 1 && phase === "flash") || phase === "printing" || phase === "done" ? "is-filled" : ""} /><i className={shot > 2 || (shot === 2 && phase === "flash") || phase === "printing" || phase === "done" ? "is-filled" : ""} /></div>
      <button type="button" onClick={phase === "idle" || phase === "done" ? start : undefined} disabled={phase !== "idle" && phase !== "done"}>{phase === "done" ? "Take another" : phase === "idle" ? "Start photo booth" : "Taking photos…"}</button>
      <div className="tsa-printer-slot" aria-hidden="true" />
    </div>
    <div className="tsa-print-area" aria-live="polite">
      {prints.map((print, index) => <figure className={`tsa-printed-strip${index === prints.length - 1 && phase === "printing" ? " is-printing" : ""}`} key={print}><img src={print} alt={`Finished TSA photo-booth strip example ${index + 1}`} /></figure>)}
      {phase === "done" && prints.length === examples.length && <button type="button" className="tsa-print-reset" onClick={reset}>Put both strips away</button>}
    </div>
  </section>;
}

function InteractiveStickerBoard() {
  const stickers = [
    { src: "/portfolio/design/sticker-boba-transparent.png", alt: "Bubble tea, Taiwan flag, heart, and island cultural sticker" },
    { src: "/portfolio/design/sticker-tsa-bear-transparent.png", alt: "TSA bear character cultural sticker" },
    { src: "/portfolio/design/sticker-elephant-bear-transparent.png", alt: "CSUF TSA elephant-costume bear cultural sticker" },
  ];
  const [offsets, setOffsets] = useState([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  const drag = useRef<{ index: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const move = (index: number, x: number, y: number) => setOffsets((current) => current.map((item, itemIndex) => itemIndex === index ? { x, y } : item));
  return <div className="interactive-sticker-board" aria-label="Interactive sticker board">
    <p>Drag the stickers to arrange them.</p>
    {stickers.map((sticker, index) => <button className={`interactive-sticker interactive-sticker-${index + 1}`} type="button" key={sticker.src} style={{ transform: `translate(${offsets[index].x}px, ${offsets[index].y}px) rotate(${[-7, 6, -2][index]}deg)` }} onPointerDown={(event) => { drag.current = { index, startX: event.clientX, startY: event.clientY, originX: offsets[index].x, originY: offsets[index].y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const active = drag.current; if (!active || active.index !== index) return; move(index, active.originX + event.clientX - active.startX, active.originY + event.clientY - active.startY); }} onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }} onDoubleClick={() => move(index, 0, 0)} onKeyDown={(event) => { const step = event.shiftKey ? 20 : 8; if (event.key === "ArrowLeft") move(index, offsets[index].x - step, offsets[index].y); if (event.key === "ArrowRight") move(index, offsets[index].x + step, offsets[index].y); if (event.key === "ArrowUp") move(index, offsets[index].x, offsets[index].y - step); if (event.key === "ArrowDown") move(index, offsets[index].x, offsets[index].y + step); }} aria-label={`Move ${sticker.alt}. Drag, use arrow keys, or double click to reset.`}><img src={sticker.src} alt={sticker.alt} draggable="false" /></button>)}
  </div>;
}

function StickerMockupSlider({ items }: { items: PortfolioAsset[] }) {
  const [active, setActive] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const count = items.length;
  const go = (next: number) => setActive((next + count) % count);
  if (!count) return null;
  return <div className="sticker-slider" role="region" aria-roledescription="carousel" aria-label="Sticker lifestyle mockups" onKeyDown={(event) => { if (event.key === "ArrowLeft") go(active - 1); if (event.key === "ArrowRight") go(active + 1); }} tabIndex={0}>
    <div className="sticker-slider-viewport" onPointerDown={(event) => { swipeStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { if (swipeStart.current !== null) { const distance = event.clientX - swipeStart.current; if (Math.abs(distance) > 45) go(active + (distance < 0 ? 1 : -1)); } swipeStart.current = null; }} onPointerCancel={() => { swipeStart.current = null; }}>
      <div className="sticker-slider-track" style={{ transform: `translateX(calc(11% - ${active * 78}%))` }}>{items.map((item,index)=><figure className={index===active?"is-active":""} aria-hidden={index!==active} key={item.id}><img src={item.src} alt={cleanTitle(item.title)} draggable="false" loading={index<2?"eager":"lazy"}/></figure>)}</div>
    </div>
    <div className="sticker-slider-controls"><div><button type="button" onClick={()=>go(active-1)} aria-label="Previous mockup">←</button><button type="button" onClick={()=>go(active+1)} aria-label="Next mockup">→</button></div><p aria-live="polite">{String(active+1).padStart(2,"0")} / {String(count).padStart(2,"0")}</p><div className="sticker-slider-dots" aria-label="Choose a mockup">{items.map((item,index)=><button type="button" className={index===active?"is-active":""} onClick={()=>go(index)} aria-label={`Show mockup ${index+1}`} aria-current={index===active?"true":undefined} key={item.id}/>)}</div></div>
  </div>;
}

function ShirtPhotoSlider({ items }: { items: PortfolioAsset[] }) {
  const [active, setActive] = useState(0);
  const swipeStart = useRef<number | null>(null);
  const count = items.length;
  const go = (next: number) => setActive((next + count) % count);
  if (!count) return null;
  return <div className="shirt-lookbook" role="region" aria-roledescription="carousel" aria-label="T-shirt community lookbook" tabIndex={0} onKeyDown={(event)=>{if(event.key==="ArrowLeft")go(active-1);if(event.key==="ArrowRight")go(active+1)}}>
    <div className="shirt-lookbook-stage" onPointerDown={(event)=>{swipeStart.current=event.clientX;event.currentTarget.setPointerCapture(event.pointerId)}} onPointerUp={(event)=>{if(swipeStart.current!==null){const distance=event.clientX-swipeStart.current;if(Math.abs(distance)>45)go(active+(distance<0?1:-1))}swipeStart.current=null}} onPointerCancel={()=>{swipeStart.current=null}}>
      {items.map((item,index)=><figure className={index===active?"is-active":""} aria-hidden={index!==active} key={item.id}><img src={item.src} alt={cleanTitle(item.title)} draggable="false" loading={index<2?"eager":"lazy"}/></figure>)}
      <p><span>{String(active+1).padStart(2,"0")}</span> / {String(count).padStart(2,"0")}</p>
    </div>
    <div className="shirt-lookbook-thumbs" aria-label="Choose a T-shirt photo">{items.map((item,index)=><button type="button" className={index===active?"is-active":""} onClick={()=>go(index)} aria-label={`Show T-shirt photo ${index+1}`} aria-current={index===active?"true":undefined} key={item.id}><img src={item.src} alt="" draggable="false"/><span>{String(index+1).padStart(2,"0")}</span></button>)}</div>
  </div>;
}

function LetteringInteractiveCaseStudy() {
  return <section className="lettering-final-showcase">
    <figure className="lettering-final-mark">
      <img src="/portfolio/design/shego-lettering-transparent-v2.png" alt="Final Shego custom lettering design on a transparent background" />
    </figure>
    <div className="lettering-final-mockups">
      <figure><img src="/portfolio/design/lettering/shego-hoodie-mockup.png" alt="Shego lettering applied to a white hoodie" /></figure>
      <figure><img src="/portfolio/design/lettering/shego-mug-mockup.png" alt="Shego lettering applied to a white mug" /></figure>
    </div>
  </section>;
}

function DispenserPrototypeGallery({ items }: { items: PortfolioAsset[] }) {
  const [active, setActive] = useState<number | null>(null);
  const move = (step: number) => setActive((current) => current === null ? null : (current + step + items.length) % items.length);

  useEffect(() => {
    if (active === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, items.length]);

  return <>
    <div className="dispenser-prototype-grid">
      {items.map((item, index) => <button className="dispenser-prototype-card" type="button" onClick={() => setActive(index)} aria-label={`View ${cleanTitle(item.title)} in detail`} key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index < 2 ? "eager" : "lazy"} /></button>)}
    </div>
    {active !== null && <div className="dispenser-lightbox" role="dialog" aria-modal="true" aria-label="Prototype image viewer" onClick={() => setActive(null)}>
      <button className="dispenser-lightbox-close" type="button" onClick={() => setActive(null)} aria-label="Close image viewer">×</button>
      <button className="dispenser-lightbox-previous" type="button" onClick={(event) => { event.stopPropagation(); move(-1); }} aria-label="Previous prototype image">←</button>
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={items[active].src} alt={cleanTitle(items[active].title)} />
        <figcaption>{String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</figcaption>
      </figure>
      <button className="dispenser-lightbox-next" type="button" onClick={(event) => { event.stopPropagation(); move(1); }} aria-label="Next prototype image">→</button>
    </div>}
  </>;
}

function ProjectDetail({ collection, onNavigate }: { collection: string; onNavigate: (to: string) => void }) {
  const items = portfolioAssets.filter((item) => item.collection === collection);
  if (!items.length) return <NotFound onNavigate={onNavigate} />;
  const kind = items[0].kind;
  const back = kind === "Photography" ? "/photography" : kind === "Design" ? "/design" : "/tech";
  const photographyGallery = collection === "Film — B&W Photobooth" ? <FilmNegativeGallery items={items} /> : <PhotographyGallery items={items} />;
  const isVinyl = kind === "Tech" && collection.startsWith("Vinyl Front:Back Cover");
  const isTsaShirt = collection === "CSUF Taiwanese Student Association — T-Shirt";
  const isTsaMain = collection === "CSUF Taiwanese Student Association";
  const isBrochure = collection === "Typography Brochure";
  const isTsaStickers = collection === "CSUF Taiwanese Student Association — Stickers";
  const isEventBranding = collection === "Event Branding";
  const isLettering = collection === "Lettering";
  const isBusinessIcons = collection === "CSUF Business Web Icons and Silhouettes — Icons";
  const isBusinessSilhouettes = collection === "CSUF Business Web Icons and Silhouettes";
  const isKiosk = collection === "Kiosk Design";
  const isDispenser = collection === "Drink (Shot) Dispenser";
  const isFufuGraduation = collection === "Digital — FUFU";
  const isNoelleGraduation = collection === "Digital — Noelle";
  const isSamGraduation = collection === "Digital — Sam";
  const isSelfPortraitStory = collection === "Digital — Self-Portrait";
  const isBwPhotoboothStory = collection === "Film — B&W Photobooth";
  const isColorFilmStory = collection === "Film — Color";
  const story = projectStories[collection];
  const vinylDesigns = isVinyl ? items.filter((item) => /final.vinyl.design.0[1-3]/i.test(item.title)) : [];
  const vinylMockups = isVinyl ? items.filter((item) => /vinyl.mockup/i.test(item.title)) : [];
  const tsaDesignOrder = ["TSA25-261 copy", "TSA25-26 copy", "Untitled design (1)"];
  const tsaDesigns = isTsaShirt ? tsaDesignOrder.map((title) => items.find((item) => item.title === title)).filter((item): item is PortfolioAsset => Boolean(item)) : [];
  const tsaPhotos = isTsaShirt ? items.filter((item) => !tsaDesigns.includes(item)) : [];
  const tsaStampCard = isTsaMain ? items.find((item) => item.id === "design-020-tsa-spring-26-banquet-stamp-card") : undefined;
  if (isDispenser) {
    const dispenserGalleryItems = items.filter((item) => item.id !== "tech-drink-shot-dispenser-angle-top");
    return <main id="main" className="dispenser-case-study">
      <header className="dispenser-case-hero"><Link to="/tech" onNavigate={onNavigate}>← All tech / UI UX</Link><h1>Drink (Shot) Dispenser</h1><div className="dispenser-project-meta"><div><span>Category</span><strong>Interactive Design / Physical Computing</strong></div><div><span>Software</span><strong>Arduino</strong></div><div><span>Year</span><strong>2026</strong></div></div></header>
      <section className="dispenser-story-section"><p className="dispenser-section-number">01</p><div><p className="eyebrow">Project Overview</p><p>An interactive drink dispenser built using Arduino that allows users to choose their preferred shot size and dispense liquid with the press of a button. The project combines electronics, programming, and hands-on construction to create a functional, user-friendly experience.</p></div></section>
      <section className="dispenser-story-section"><p className="dispenser-section-number">02</p><div><p className="eyebrow">Design &amp; Development</p><p>I designed and built the dispenser using an Arduino Uno, a potentiometer knob, a push button, an RGB LED, and a peristaltic pump. The electronic components are housed inside a custom cardboard enclosure with a bright orange and yellow design.</p><p>I kept the controls simple and easy to access so users could interact with the dispenser without needing instructions.</p></div></section>
      <section className="dispenser-gallery-section"><header><p className="eyebrow">Prototype views</p><h2>The physical build from every angle.</h2></header><DispenserPrototypeGallery items={dispenserGalleryItems} /></section>
      <section className="dispenser-code-section"><header><p className="eyebrow">Behind the Code</p><h2>The logic behind every pour.</h2><p>The Arduino program connects the physical controls to the pump and RGB feedback. It reads the knob position, checks each button press, calculates the pour duration, and lets a second press stop the dispenser early.</p></header><div className="dispenser-code-grid"><figure><img src="/portfolio/tech/drink-shot-dispenser/behind-code-setup.png" alt="Arduino code defining the dispenser inputs, pump, RGB LED, and setup" loading="lazy" /></figure><figure className="dispenser-hardware-photo"><img src="/portfolio/tech/drink-shot-dispenser/internal-components.jpg" alt="Arduino, wiring, tubing, and liquid container inside the drink dispenser prototype" loading="lazy" /></figure><figure><img src="/portfolio/tech/drink-shot-dispenser/behind-code-loop.png" alt="Arduino code controlling button input and the timed pump amounts" loading="lazy" /></figure></div></section>
      <section className="dispenser-story-section dispenser-final-story"><p className="dispenser-section-number">03</p><div><p className="eyebrow">How It Works</p><p>Users turn the knob to select their preferred shot size, and the LED changes color to show their selection: <strong>blue for a full shot, yellow for a 3/4 shot, and red for a half shot.</strong></p><p>After placing a cup beneath the nozzle, users press the button to start dispensing. The LED turns green while the pump is running, and the dispenser automatically stops once the selected amount has been poured. Users can also press the button again to stop dispensing early.</p></div></section>
      <section className="dispenser-video-section"><header><p className="eyebrow">Interactive demonstration</p><h2>See the dispenser in action.</h2><p>Press play to watch the working prototype.</p></header><div className="dispenser-video-frame"><video controls preload="metadata" poster="/portfolio/tech/drink-shot-dispenser/front.jpg"><source src="/portfolio/tech/drink-shot-dispenser/demo.mp4" type="video/mp4"/>Your browser does not support embedded video.</video></div></section>
    </main>;
  }
  if (isKiosk) {
    const logo = items.find((item) => item.id === "kiosk-milk-t-logo");
    const englishMenu = items.find((item) => item.id === "kiosk-menu-english");
    const chineseMenu = items.find((item) => item.id === "kiosk-menu-chinese");
    const featureScreens = ["kiosk-customization", "kiosk-cart", "kiosk-checkout"].map((id) => items.find((item) => item.id === id)).filter((item): item is PortfolioAsset => Boolean(item));
    return <main id="main" className="kiosk-case-study">
      <header className="kiosk-case-hero"><Link to="/tech" onNavigate={onNavigate}>← All UI/UX design</Link><div className="kiosk-hero-layout"><div><h1><span>MILK+T:</span> Boba Kiosk Design</h1><div className="kiosk-project-meta"><div><span>Category</span><strong>UI/UX Design / Interface Design / Visual Identity</strong></div><div><span>Software</span><strong>Figma</strong></div><div><span>Year</span><strong>2025</strong></div><div><span>Project Type</span><strong>Conceptual Design</strong></div></div></div>{logo&&<figure><img src={logo.src} alt="MILK+T bubble tea shop logo"/></figure>}</div></header>
      <section className="kiosk-story-section"><p className="kiosk-section-number">01</p><div><p className="eyebrow">Overview</p><p><em>MILK+T</em> is a self-service ordering kiosk concept designed for a fictional bubble tea shop. The goal was to create a clean, welcoming, and easy-to-use interface that allows customers to browse drinks, customize their orders, and complete the ordering process with ease.</p></div></section>
      <section className="kiosk-menu-section"><header><p className="eyebrow">Bilingual interface</p><h2>One welcoming menu, two languages.</h2></header><div>{englishMenu&&<figure><img src={englishMenu.src} alt="MILK+T kiosk drink menu in English"/></figure>}{chineseMenu&&<figure><img src={chineseMenu.src} alt="MILK+T kiosk drink menu in Traditional Chinese"/></figure>}</div></section>
      <section className="kiosk-story-section"><p className="kiosk-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>I created a modern, minimal design using soft beige and muted brown tones to reflect the warm and inviting atmosphere of a boba shop. The interface features organized drink categories, product images, clear pricing, and simple navigation to help customers find their favorite drinks.</p><p>I also designed the MILK+T logo using a bubble tea cup illustration to give the fictional brand a recognizable identity. One of the key features is the ability to switch between English and Traditional Chinese, making the ordering experience more accessible to customers who prefer different languages.</p></div></section>
      <section className="kiosk-feature-section"><header><p className="eyebrow">Ordering flow</p><h2>Customize, review, and check out with ease.</h2></header><div>{featureScreens.map((item,index)=><figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index===0?"eager":"lazy"}/></figure>)}</div><a href="https://www.figma.com/proto/UJSaAiWDkTUd4WQKT9gLi6/Boba-Kiosk?node-id=0-1&scaling=scale-down&content-scaling=fixed&page-id=0%3A1" target="_blank" rel="noreferrer"><small>Interactive prototype</small><strong>Try the kiosk</strong><span>↗</span></a></section>
      <section className="kiosk-story-section kiosk-final-story"><p className="kiosk-section-number">03</p><div><p className="eyebrow">User Experience &amp; Features</p><p>The kiosk allows customers to customize their drinks by selecting sweetness levels, ice levels, toppings, and quantities before adding items to their cart. A product detail window keeps these options organized, while the shopping cart displays selected drinks, customization details, and prices for easy review.</p><p>This project highlights my approach to creating user-friendly interfaces that balance visual design, accessibility, and practical ordering features.</p></div></section>
    </main>;
  }
  if (isVinyl) {
    const designSource = (item: PortfolioAsset) => item.id.includes("design-01") ? "/portfolio/tech/vinyl-cover-full-bleed.jpg" : item.id.includes("design-02") ? "/portfolio/tech/vinyl-design-02-cropped.jpg" : "/portfolio/tech/vinyl-design-03-cropped.jpg";
    return <main id="main" className="vinyl-case-study">
      <header className="vinyl-case-hero"><Link to="/tech" onNavigate={onNavigate}>← All creative technology</Link><h1>Generative Vinyl Design</h1><div className="vinyl-project-meta"><div><span>Category</span><strong>Generative Art / Packaging Design / Creative Coding</strong></div><div><span>Software</span><strong>Processing</strong></div><div><span>Year</span><strong>2026</strong></div></div></header>
      <VinylRecordShowcase items={items}/>
      <section className="vinyl-story-section"><p className="vinyl-section-number">01</p><div><p className="eyebrow">Overview</p><p><em>Generative Vinyl Design</em> explores the connection between creative coding and graphic design through a custom vinyl record package inspired by the song “BOMB” by ILLIT. The goal was to use code-generated visuals to create a cohesive design across the front cover, back cover, and record labels while experimenting with patterns, movement, and composition.</p></div></section>
      <section className="vinyl-code-section"><header><p className="eyebrow">Behind the code</p><h2>From Processing parameters to a generative star.</h2></header><figure><img src="/portfolio/tech/vinyl-processing-code.png" alt="Processing code beside the generated radiating star artwork"/></figure></section>
      <section className="vinyl-story-section"><p className="vinyl-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>Using Processing, I developed a generative visual inspired by soft, flowing star shapes and radiating lines. By experimenting with repetition, rotation, and variation, I created a pattern that feels energetic and playful.</p><p>A pastel yellow and pink color palette gives the design a dreamy appearance, while bold black typography adds contrast and keeps the album information easy to read. I carried the star-inspired shapes across the front and back covers, using a simpler version of the pattern for the record labels to maintain a consistent visual identity.</p></div></section>
      <section className="vinyl-design-section"><header><p className="eyebrow">Packaging system</p><h2>One generated language across every surface.</h2></header><div>{vinylDesigns.map((item,index)=><figure key={item.id}><img src={designSource(item)} alt={cleanTitle(item.title)} loading={index===0?"eager":"lazy"}/></figure>)}</div></section>
      <section className="vinyl-mockup-section"><header><p className="eyebrow">Physical application</p><h2>The artwork becomes an album object.</h2></header><div>{vinylMockups.map((item,index)=><figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index===0?"eager":"lazy"}/></figure>)}</div></section>
      <section className="vinyl-story-section vinyl-final-story"><p className="vinyl-section-number">03</p><div><p className="eyebrow">Creative Coding &amp; Application</p><p>The artwork was developed through a code-based design process, allowing me to explore how changing visual parameters can produce different compositions. I refined the generated graphics into a vinyl packaging layout, balancing the experimental patterns with typography and track information.</p><p>The final designs were presented through vinyl record mockups to show how the artwork could work as a physical music product.</p></div></section>
    </main>;
  }
  if (isTsaMain) {
    return <main id="main" className="tsa-case-study">
      <header className="tsa-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <h1>Photobooth &amp; Stamp Cards</h1>
        <div className="tsa-project-meta"><div><span>Category</span><strong>Event Design / Print Design / Illustration</strong></div><div><span>Year</span><strong>2026</strong></div></div>
      </header>
      <section className="tsa-story-section">
        <p className="tsa-section-number">01</p><div><p className="eyebrow">Overview</p><p>This project includes a photobooth frame and stamp cards created for the California State University, Fullerton Taiwanese Student Association (TSA) End-of-Year Banquet. Both designs were printed and used during the event, creating a fun and interactive experience for attendees while celebrating Taiwanese culture.</p></div>
      </section>
      <section className="tsa-interactive-section">
        <header><p className="eyebrow">Photobooth experience</p></header>
        <TsaPhotoBooth />
      </section>
      <section className="tsa-story-section">
        <p className="tsa-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><div className="tsa-story-copy"><p>Inspired by Taiwanese night markets and traditional cultural elements, I created a playful, hand-drawn visual style using textured illustrations, warm colors, and expressive typography. Red lanterns, bubble tea, flowers, and mahjong tiles bring a familiar cultural touch to the designs while maintaining a consistent theme.</p><p>The photobooth frame was designed to give attendees a decorative setting for taking pictures and capturing memories. Its open layout leaves plenty of space for people, while the illustrations add personality without overwhelming the design.</p></div></div>
      </section>
      <section className="tsa-print-showcase">
        <header><p className="eyebrow">Printed event pieces</p></header>
        <div className="tsa-frame-card-row"><figure className="tsa-frame-only"><img src="/portfolio/design/tsa-end-of-year-frame-transparent.png" alt="TSA End of Year Dinner Night photobooth frame" /></figure>{tsaStampCard && <figure className="tsa-main-stamp-card"><img src={tsaStampCard.src} alt={cleanTitle(tsaStampCard.title)} /></figure>}</div>
      </section>
      <section className="tsa-story-section tsa-print-story">
        <p className="tsa-section-number">03</p><div><p className="eyebrow">Interactive Print Design</p><div className="tsa-story-copy"><p>The stamp cards were designed to encourage attendees to participate in food and game activities throughout the banquet. Each card includes illustrated icons, designated stamp spaces, and a name section to help participants track their activities.</p><p>Together, these printed materials created a consistent visual experience that connected cultural illustrations with interactive activities at the event.</p></div></div>
      </section>
    </main>;
  }
  if (isTsaShirt) {
    return <main id="main" className="shirt-case-study">
      <header className="shirt-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <div className="shirt-hero-grid"><div><h1>Cultural T-Shirt Design</h1><div className="shirt-project-meta"><div><span>Category</span><strong>Apparel Design / Graphic Design / Illustration</strong></div><div><span>Year</span><strong>2025</strong></div></div></div>{tsaDesigns[0] && <figure><img src={tsaDesigns[0].src} alt="Colorful Taiwanese postage-stamp T-shirt illustration" /></figure>}</div>
      </header>
      <section className="shirt-story-section"><p className="shirt-section-number">01</p><div><p className="eyebrow">Overview</p><p>This T-shirt was designed for the California State University, Fullerton Taiwanese Student Association (TSA) for the 2025–2026 academic year. The goal was to create a wearable design that represents Taiwanese culture while giving the organization a fun, recognizable identity that members could proudly wear.</p></div></section>
      <section className="shirt-design-section"><header><p className="eyebrow">Cultural details</p><h2>A collection of Taiwan-inspired stamps.</h2></header><div className="shirt-design-gallery">{tsaDesigns.map((item, index) => <figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index === 0 ? "eager" : "lazy"} /></figure>)}</div></section>
      <section className="shirt-story-section"><p className="shirt-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>Inspired by Taiwanese culture and everyday life, I developed a playful design based on a collection of colorful postage stamps. Each stamp features familiar elements such as Taipei 101, bubble tea, mahjong tiles, traditional lanterns, and cherry blossoms. The illustrations combine bright colors, bold lettering, and a slightly textured style to create a nostalgic yet modern appearance.</p><p>The stamp-inspired layout brings the different cultural elements together into one cohesive design while allowing each illustration to stand out.</p></div></section>
      <section className="shirt-photo-section"><header><p className="eyebrow">Worn by the community</p><h2>From illustration to shared identity.</h2></header><ShirtPhotoSlider items={tsaPhotos}/></section>
      <section className="shirt-story-section shirt-application-story"><p className="shirt-section-number">03</p><div><p className="eyebrow">Apparel Design &amp; Application</p><p>The T-shirt features a small TSA graphic on the front and a larger illustrated composition on the back. This creates a balance between a simple everyday look and a more expressive design that celebrates the organization’s identity.</p><p>The shirts were produced and worn by TSA members, bringing the illustrations into a real-world setting and creating a shared visual identity for the organization.</p></div></section>
    </main>;
  }
  if (isLettering) {
    return <main id="main" className="shego-case-study">
      <header className="shego-case-hero"><Link to="/design" onNavigate={onNavigate}>← All graphic design</Link><h1><span>Shego:</span> Villain Lettering</h1><div className="shego-project-meta"><div><span>Category</span><strong>Custom Lettering / Typography</strong></div><div><span>Year</span><strong>2025</strong></div></div></header>
      <section className="shego-story-section"><p className="shego-section-number">01</p><div><p className="eyebrow">Overview</p><p>This custom lettering project was inspired by Shego, the villain from Disney’s animated series <em>Kim Possible</em>. The goal was to create an original lettering design that captures her bold personality, recognizable appearance, and signature green-and-black color scheme through expressive typography.</p></div></section>
      <section className="shego-final-section"><header><p className="eyebrow">Final lettering</p><h2>Character translated into type.</h2></header><figure><img src="/portfolio/design/shego-lettering-transparent-v2.png" alt="Final Shego villain custom lettering on a transparent background"/></figure></section>
      <section className="shego-story-section"><p className="shego-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>I explored different lettering styles before developing a bold, angular design inspired by Shego’s confident and powerful personality. Sharp edges and tall letterforms create a strong visual impact, while subtle curves reference the shape of her hair.</p><p>A bright green diagonal element cuts across the lettering, drawing inspiration from her costume and glowing green energy. The contrast between black and green helps connect the design to the character while keeping the lettering recognizable.</p></div></section>
      <section className="shego-application-section"><header><p className="eyebrow">Applied lettering</p><h2>Designed beyond the page.</h2></header><div><figure><img src="/portfolio/design/lettering/shego-hoodie-mockup.png" alt="Shego lettering applied to a white hoodie"/></figure><figure><img src="/portfolio/design/lettering/shego-mug-mockup.png" alt="Shego lettering applied to a white mug"/></figure></div></section>
      <section className="shego-story-section shego-final-story"><p className="shego-section-number">03</p><div><p className="eyebrow">Design Process &amp; Application</p><p>I began with hand-drawn sketches, experimenting with letter shapes, spacing, and composition before refining the final design into vector artwork. I then added texture and depth to give the lettering a stronger visual presence.</p><p>The finished design was presented on hoodie and mug mockups to explore how the typography could work across different products. This project highlights my approach to custom lettering, character-inspired design, and translating visual references into original typography.</p></div></section>
    </main>;
  }
  if (isBrochure) {
    const exterior = items.find((item) => item.id === "design-041-brochure-front");
    const interior = items.find((item) => item.id === "design-042-brochure-inside");
    const mockups = items.filter((item) => item.id.includes("mockup"));
    return <main id="main" className="brochure-case-study">
      <header className="brochure-case-hero"><Link to="/design" onNavigate={onNavigate}>← All graphic design</Link><h1>Typography 101 Brochure</h1><div className="brochure-project-meta"><div><span>Category</span><strong>Typography / Editorial Design / Print Design</strong></div><div><span>Year</span><strong>2024</strong></div></div></header>
      <section className="brochure-story-section"><p className="brochure-section-number">01</p><div><p className="eyebrow">Overview</p><p>Typography 101 is an educational tri-fold brochure designed to introduce the basic principles of typography. The goal was to make typography easier to understand through clear explanations, visual examples, and an organized layout that helps readers explore different type styles and techniques.</p></div></section>
      <section className="brochure-flat-section"><header><p className="eyebrow">Six-panel system</p><h2>Designed to unfold as a visual lesson.</h2></header><div className="brochure-flat-grid">{exterior&&<figure><div><img src={exterior.src} alt="Typography 101 tri-fold brochure exterior"/></div><figcaption>Exterior / three panels</figcaption></figure>}{interior&&<figure><div><img src={interior.src} alt="Typography 101 tri-fold brochure interior"/></div><figcaption>Interior / three panels</figcaption></figure>}</div></section>
      <section className="brochure-story-section"><p className="brochure-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>I created a vintage-inspired design using warm cream, dusty pink, and brown tones to give the brochure a classic editorial appearance. Bold serif headings, decorative banners, and structured columns create a consistent visual style while making the information easy to follow.</p><p>The brochure introduces different font categories, kerning, tracking, leading, and the anatomy of type. Each section combines explanations with visual examples to help readers understand how typography works. I also experimented with font sizes, spacing, and visual hierarchy to create a layout that is both informative and visually engaging.</p></div></section>
      <section className="brochure-mockup-section"><header><p className="eyebrow">Printed application</p><h2>Typography made tangible.</h2></header><div>{mockups.map((item,index)=><figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index===0?"eager":"lazy"}/></figure>)}</div></section>
      <section className="brochure-story-section brochure-final-story"><p className="brochure-section-number">03</p><div><p className="eyebrow">Print Design &amp; Application</p><p>The brochure features a six-panel, tri-fold layout with carefully organized information across the exterior and interior sections. I focused on balancing text and visual examples while maintaining consistent spacing and alignment.</p><p>The final design was printed and folded into a physical brochure, showing how thoughtful typography and layout can turn educational information into an accessible and engaging printed piece.</p></div></section>
    </main>;
  }
  const stickerDesigns = isTsaStickers ? items.filter((item) => /sticker design/i.test(item.title)) : [];
  const stickerMockups = isTsaStickers ? items.filter((item) => !stickerDesigns.includes(item)) : [];
  if (isTsaStickers) {
    return <main id="main" className="sticker-case-study">
      <header className="sticker-case-hero">
        <Link to="/design" onNavigate={onNavigate}>← All graphic design</Link>
        <h1>Cultural Stickers Design</h1><div className="sticker-project-meta"><div><span>Category</span><strong>Stickers Design / Digital Illustration / Graphic Design</strong></div><div><span>Year</span><strong>2024</strong></div></div>
      </header>
      <section className="sticker-story-section"><p className="sticker-section-number">01</p><div><p className="eyebrow">Overview</p><p>This sticker collection was designed for the California State University, Fullerton Taiwanese Student Association (TSA). The goal was to create a series of fun, recognizable illustrations that celebrate Taiwanese culture and represent the organization’s identity through designs that members can use on everyday items.</p></div></section>
      <section className="sticker-design-section"><header><p className="eyebrow">The collection</p><h2>Three characters, one playful visual family.</h2></header><InteractiveStickerBoard /></section>
      <section className="sticker-story-section"><p className="sticker-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>Inspired by Taiwanese culture and cute character illustrations, I created three sticker designs featuring bubble tea and playful bear characters. The first design combines bubble tea with the Taiwanese flag and island silhouette, highlighting the connection between Taiwanese culture and the student community.</p><p>The other two designs feature a bear character wearing a graduation cap and a bear dressed in an elephant costume, adding a fun and friendly personality to the collection. Soft colors, hand-drawn outlines, and simple details give each sticker its own character while keeping the overall style consistent.</p></div></section>
      <section className="sticker-mockup-section"><header><p className="eyebrow">Everyday application</p><h2>Small illustrations with real personality.</h2></header><StickerMockupSlider items={stickerMockups}/></section>
      <section className="sticker-story-section sticker-application-story"><p className="sticker-section-number">03</p><div><p className="eyebrow">Sticker Design &amp; Application</p><p>Each illustration was designed with a clear silhouette and recognizable details to work well as an individual sticker. The collection was also presented through lifestyle photography and mockups on laptops and other personal items, showing how the designs can add personality to everyday objects while representing TSA.</p></div></section>
    </main>;
  }
  const eventSocial = isEventBranding ? items.find((item) => item.id === "design-event-branding-social-2027") : undefined;
  const eventGallery = isEventBranding ? [items[0], eventSocial, ...items.slice(1).filter((item) => item !== eventSocial && item.id !== "design-030-event-advertising-social-recovered")].filter((item): item is PortfolioAsset => Boolean(item)) : [];
  if (isEventBranding) {
    return <main id="main" className="lunar-case-study">
      <header className="lunar-case-hero"><Link to="/design" onNavigate={onNavigate}>← All graphic design</Link><h1>Lunar New Year Event Branding</h1><div className="lunar-project-meta"><div><span>Category</span><strong>Event Branding / Visual Identity / Graphic Design</strong></div><div><span>Year</span><strong>2025</strong></div><div><span>Project Type</span><strong>Conceptual Design</strong></div></div></header>
      <section className="lunar-story-section"><p className="lunar-section-number">01</p><div><p className="eyebrow">Overview</p><p>This conceptual branding project reimagines the visual identity for a 2027 Lunar New Year celebration at Disney California Adventure. The goal was to create a festive and recognizable design system that celebrates Lunar New Year traditions while bringing a playful, modern style to the event experience.</p></div></section>
      <section className="lunar-identity-section"><div className="lunar-logo-stage"><img src="/portfolio/design/event-branding/lunar-new-year-logo-transparent.png" alt="2027 Lunar New Year Year of the Goat event logo"/></div><div className="lunar-identity-copy"><p className="eyebrow">Primary identity</p><h2>A playful celebration built from cultural symbols.</h2><p>The logo combines expressive lettering, a goat-horn flourish, floral details, cloud curls, and a playful character silhouette. Red and gold create festive energy, while mint green and cream introduce a fresh contemporary contrast.</p></div><figure className="lunar-brand-board"><img src="/portfolio/design/event-branding/brand-system.jpg" alt="Lunar New Year event logo variations typography colors and supporting graphic elements"/><figcaption>Logo variations, typography, palette, and supporting elements</figcaption></figure></section>
      <section className="lunar-story-section"><p className="lunar-section-number">02</p><div><p className="eyebrow">Concept &amp; Design Approach</p><p>Inspired by traditional Lunar New Year decorations and the Year of the Goat, I developed a visual identity combining expressive typography, bright colors, and cultural illustrations. The custom-style lettering uses bold shapes and playful arrangements to give the event a lively personality.</p><p>A palette of red, gold, mint green, and cream brings together traditional festive colors with a fresh, contemporary feel. Decorative elements such as flowers, cloud patterns, geometric borders, and wave illustrations help create a consistent visual theme.</p></div></section>
      <section className="lunar-applications-section"><header><p className="eyebrow">Branding in application</p><h2>One identity across every event touchpoint.</h2></header><div className="lunar-applications-grid">{eventGallery.map((item,index)=><figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} loading={index<2?"eager":"lazy"}/></figure>)}</div></section>
      <section className="lunar-story-section lunar-final-story"><p className="lunar-section-number">03</p><div><p className="eyebrow">Branding &amp; Applications</p><p>I created a visual identity system that includes logo variations, typography, a color palette, and supporting graphic elements. The designs were then applied to promotional posters and themed drink cup mockups to demonstrate how the branding could work across different event materials.</p><p>Together, these applications show how a consistent design system can create a recognizable and engaging event experience.</p></div></section>
    </main>;
  }
  const kioskOrder = ["kiosk-milk-t-logo", "kiosk-menu-english", "kiosk-menu-chinese", "kiosk-customization", "kiosk-cart", "kiosk-checkout"];
  const kioskGallery = isKiosk ? kioskOrder.map((id) => items.find((item) => item.id === id)).filter((item): item is PortfolioAsset => Boolean(item)) : [];
  const galleryItems = isTsaMain || isLettering ? [] : isBusinessSilhouettes ? [] : isKiosk ? kioskGallery : isVinyl ? items.filter((item) => !vinylDesigns.includes(item) && !vinylMockups.includes(item)) : isTsaShirt ? [] : isTsaStickers ? [...stickerDesigns, ...stickerMockups] : isEventBranding ? eventGallery : items;
  const vinylDesignSource = (item: PortfolioAsset) => item.id.includes("design-01") ? "/portfolio/tech/vinyl-cover-full-bleed.jpg" : item.id.includes("design-02") ? "/portfolio/tech/vinyl-design-02-cropped.jpg" : "/portfolio/tech/vinyl-design-03-cropped.jpg";
  return <main id="main" className={`project-detail project-detail-${kind.toLowerCase()}${isBrochure ? " project-detail-brochure" : ""}${isTsaStickers ? " project-detail-stickers" : ""}${isEventBranding ? " project-detail-event" : ""}${isLettering ? " project-detail-lettering" : ""}${isBusinessIcons ? " project-detail-business-icons" : ""}${isBusinessSilhouettes ? " project-detail-business-profiles" : ""}${isKiosk ? " project-detail-kiosk" : ""}${isFufuGraduation || isNoelleGraduation || isSamGraduation || isSelfPortraitStory || isBwPhotoboothStory || isColorFilmStory ? " project-detail-fufu" : ""}`}>
    <header className="detail-hero"><Link to={back} onNavigate={onNavigate}>← Back to {kind}</Link><p className="eyebrow">{story?.category ?? `${kind} / Project archive`}</p><h1>{story?.title ?? collection.replace(/ — /g, " / ")}</h1>{!story?.approach && <p>{story?.description ?? `${items.length} selected ${items.length === 1 ? "piece" : "pieces"} from the original project folder.`}</p>}</header>
    {kind === "Photography" && story?.approach && <PhotographyStory story={story} />}
    {isLettering && <LetteringInteractiveCaseStudy />}
    {kind === "Photography" ? photographyGallery : <>{isBusinessSilhouettes && <section className="profile-use-case"><header><p className="eyebrow">Website application</p><h2>Designed for profiles without a photo.</h2><p>The silhouettes give directory profiles a consistent, professional fallback while keeping each person’s presentation welcoming and complete.</p></header><div className="profile-demo-grid">{items.map((item, index) => { const profiles = [{ name: "Student Name", focus: "Accounting & Finance" }, { name: "Faculty Name", focus: "Business Administration" }, { name: "Alumni Name", focus: "Professional Accounting" }]; const profile = profiles[index] ?? profiles[0]; return <article className="profile-demo-card" tabIndex={0} key={item.id}><div className="profile-avatar"><img src={item.src} alt="Profile silhouette placeholder" /></div><div className="profile-demo-copy"><p className="eyebrow">Profile placeholder</p><h3>{profile.name}</h3><p>Concentration: {profile.focus}</p><span>View profile <b>↗</b></span></div></article>; })}</div></section>}{isEventBranding && <section className="event-brand-story"><div className="event-logo-stage"><img src="/portfolio/design/event-branding/lunar-new-year-logo-transparent.png" alt="2027 Lunar New Year, Year of the Goat primary event logo" /></div><div className="event-brand-copy"><p className="eyebrow">Primary identity</p><h2>A joyful mark built from cultural symbols.</h2><p>The stacked logo combines bold, playful lettering with a goat-horn flourish, plum blossom, cloud curl, and Mickey-inspired silhouette. Warm red and golden yellow bring celebratory energy, while mint adds a welcoming contrast.</p><dl><div><dt>Concept</dt><dd>Friendliness, warmth, creativity</dd></div><div><dt>Type system</dt><dd>DoubleBass, Halcom Black, Agency FB</dd></div><div><dt>Supporting motifs</dt><dd>Lattice corners, clouds, waves, florals</dd></div></dl><a href="/portfolio/documents/event-branding-final.pdf" target="_blank" rel="noreferrer">View the complete brand presentation ↗</a></div><figure className="event-brand-board"><img src="/portfolio/design/event-branding/brand-system.jpg" alt="Event branding logo variations, typefaces, color palette, and supporting symbols" /><figcaption>Logo variations, typography, palette, and graphic language</figcaption></figure></section>}{isLettering && <section className="lettering-story"><figure className="lettering-cover"><img src="/portfolio/design/lettering/villains-lettering-01-cover.png" alt="Villains Lettering presentation cover" /></figure><div className="lettering-story-copy"><p className="eyebrow">Character-driven lettering</p><h2>Sharp, energetic forms inspired by Shego.</h2><p>The identity translates Shego’s confidence, angular costume details, and bright green plasma energy into a bold custom wordmark. The system develops from character research through hand sketches, refinement, and final applications.</p><dl><div><dt>Course</dt><dd>ART 323A</dd></div><div><dt>Process</dt><dd>Research, sketching, vector lettering</dd></div><div><dt>Applications</dt><dd>Apparel and merchandise</dd></div></dl><a href="/portfolio/documents/villains-lettering-final.pdf" target="_blank" rel="noreferrer">View the complete presentation ↗</a></div><div className="lettering-process-grid">{[{src:"/portfolio/design/lettering/villains-lettering-02-research.png",label:"Research and visual references"},{src:"/portfolio/design/lettering/villains-lettering-03-sketches.png",label:"Frameworks and concept sketches"},{src:"/portfolio/design/lettering/villains-lettering-04-final-drawing.png",label:"Final hand-drawn construction"},{src:"/portfolio/design/lettering/villains-lettering-05-vector-development.png",label:"Vector development and final lettering"}].map((page,index)=><figure key={page.src}><img src={page.src} alt={page.label} loading={index<2?"eager":"lazy"}/><figcaption>{page.label}</figcaption></figure>)}</div><figure className="lettering-mockup-board"><img src="/portfolio/design/lettering/villains-lettering-06-mockups.png" alt="Final Shego lettering applied to a hoodie and mug"/><figcaption>Final digital applications from the presentation</figcaption></figure></section>}{isVinyl && <VinylRecordShowcase items={items} />}{vinylDesigns.length > 0 && <div className="vinyl-design-row">{vinylDesigns.map((item) => <figure key={item.id}><img src={vinylDesignSource(item)} alt={cleanTitle(item.title)} /><figcaption>{cleanTitle(item.title)}</figcaption></figure>)}</div>}{vinylMockups.length > 0 && <div className="vinyl-mockup-row">{vinylMockups.map((item) => <figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} /><figcaption>{cleanTitle(item.title)}</figcaption></figure>)}</div>}{isTsaMain && <><TsaPhotoBooth /><div className="tsa-frame-card-row"><figure className="tsa-frame-only"><img src="/portfolio/design/tsa-end-of-year-frame-transparent.png" alt="TSA End of Year Dinner Night empty photo-booth frame" /></figure>{tsaStampCard && <figure className="tsa-main-stamp-card"><img src={tsaStampCard.src} alt={cleanTitle(tsaStampCard.title)} /></figure>}</div></>}{!isTsaMain && tsaStampCard && <figure className="tsa-main-stamp-card"><img src={tsaStampCard.src} alt={cleanTitle(tsaStampCard.title)} /></figure>}{tsaDesigns.length > 0 && <div className="tsa-shirt-row tsa-shirt-designs">{tsaDesigns.map((item) => <figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} /><figcaption>{cleanTitle(item.title)}</figcaption></figure>)}</div>}{tsaPhotos.length > 0 && <div className="tsa-shirt-row tsa-shirt-photos">{tsaPhotos.map((item) => <figure key={item.id}><img src={item.src} alt={cleanTitle(item.title)} /><figcaption>{cleanTitle(item.title)}</figcaption></figure>)}</div>}<div className="gallery">{galleryItems.map((item, index) => <figure key={item.id} tabIndex={isBusinessIcons ? 0 : undefined}><img src={item.src} alt={cleanTitle(item.title)} loading={index < 4 ? "eager" : "lazy"} /><figcaption><span>{cleanTitle(item.title)}</span>{item.document && <a href={item.document} target="_blank" rel="noreferrer">Open full PDF ↗</a>}</figcaption></figure>)}</div></>}
    {isKiosk && <section className="kiosk-figma-cta"><a href="https://www.figma.com/proto/UJSaAiWDkTUd4WQKT9gLi6/Boba-Kiosk?node-id=0-1&scaling=scale-down&content-scaling=fixed&page-id=0%3A1" target="_blank" rel="noreferrer"><small>Prototype</small><strong>Try the kiosk</strong><span>↗</span></a></section>}
  </main>;
}

function Contact({ onNavigate }: { onNavigate: (to: string) => void }) {
  const portrait = { src: "/portfolio/about-museum.JPG" };
  return <main id="main" className="scrapbook-contact"><header className="scrapbook-contact-heading"><p className="eyebrow">Contact / About me</p><h1>Let’s make something<br /><em>good together.</em></h1></header><section className="scrapbook-card"><div className="scrapbook-paper"><p className="scrapbook-title">A little about me ♡</p><ul><li>Designer, photographer &amp; creative thinker.</li><li>Love experimenting with colors, typography, and new ideas.</li><li>Enjoy dancing, photography, and exploring new places.</li><li>Always curious and finding inspiration in little things.</li></ul><p className="scrapbook-signoff">and still making</p></div>{portrait && <figure className="scrapbook-photo"><span className="paperclip" aria-hidden="true" /><img src={portrait.src} alt="Portrait of Christy Ho" /><figcaption>hello, it’s me ✿</figcaption></figure>}</section><section className="contact-links-section"><nav className="contact-bubbles" aria-label="Contact links"><a className="contact-bubble bubble-email" href="mailto:szuhua.christyho@gmail.com"><span>Email me</span></a><a className="contact-bubble bubble-linkedin" href="https://www.linkedin.com/in/szuhua-christy-ho" target="_blank" rel="noreferrer"><span>LinkedIn</span></a><a className="contact-bubble bubble-instagram" href="https://www.instagram.com/c.pho_tos?utm_source=ig_web_button_share_sheet&mdxt=ZDNlZDc0MzIxNw==" target="_blank" rel="noreferrer"><span>Instagram</span></a><Link className="contact-bubble bubble-resume" to="/resume" onNavigate={onNavigate}><span>Resume</span></Link></nav></section></main>;
}

function Resume() {
  return <main id="main" className="resume-pdf-page"><header><div><p className="eyebrow">Résumé / curriculum vitae</p><h1>Christy Ho</h1></div><a href="/portfolio/documents/christy-ho-resume.pdf" target="_blank" rel="noreferrer">Open or download PDF ↗</a></header><iframe src="/portfolio/documents/christy-ho-resume.pdf" title="Christy Ho résumé" /></main>;
}

function NotFound({ onNavigate }: { onNavigate: (to: string) => void }) { return <main id="main" className="not-found"><FlowerLogo variant="flower" /><h1>That page wandered off.</h1><Link to="/" onNavigate={onNavigate}>Return home →</Link></main>; }

function Footer({ onNavigate }: { onNavigate: (to: string) => void }) {
  const footerRef = useRef<HTMLElement>(null);
  const flowers = [
    [4, 47, "var(--pastel)"], [11, 64, "var(--blue)"], [18, 42, "var(--sage)"], [25, 71, "#d8b7a5"],
    [32, 52, "var(--pastel)"], [39, 66, "var(--blue)"], [47, 45, "#d8b7a5"], [54, 73, "var(--sage)"],
    [62, 54, "var(--pastel)"], [69, 68, "#d8b7a5"], [77, 44, "var(--blue)"], [84, 70, "var(--pastel)"],
    [91, 51, "var(--sage)"], [97, 63, "#d8b7a5"],
  ] as const;
  const moveGarden = (event: React.PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const wind = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    const lift = Math.max(0, Math.min(1, 1 - (event.clientY - bounds.top) / bounds.height));
    footerRef.current?.style.setProperty("--garden-wind", wind.toFixed(2));
    footerRef.current?.style.setProperty("--garden-lift", lift.toFixed(2));
  };
  return <footer className="interactive-footer" ref={footerRef} onPointerMove={moveGarden} onPointerLeave={() => { footerRef.current?.style.setProperty("--garden-wind", "0"); footerRef.current?.style.setProperty("--garden-lift", "0"); }}><div className="footer-cta-wrap"><p className="eyebrow">Have something in mind?</p><Link className="footer-cta" to="/contact" onNavigate={onNavigate}>Let’s make something good <span>↗</span></Link></div><div className="footer-info"><div className="footer-intro"><Link className="brand" to="/" onNavigate={onNavigate}><FlowerLogo variant="compact" /><span>Christy Ho</span></Link><p>I make things, try things, change things, and sometimes surprise myself.</p><small>© {new Date().getFullYear()} Christy Ho</small></div><nav aria-label="Footer navigation"><div><h2>Explore</h2><Link to="/photography" onNavigate={onNavigate}>Photography</Link><Link to="/design" onNavigate={onNavigate}>Graphic design</Link><Link to="/tech" onNavigate={onNavigate}>Creative Tech</Link></div><div><h2>Say hello</h2><Link to="/contact" onNavigate={onNavigate}>Contact</Link><a href="mailto:szuhua.christyho@gmail.com">Email</a><a href="https://www.linkedin.com/in/christy-ho" target="_blank" rel="noreferrer">LinkedIn</a></div></nav></div><div className="footer-garden" aria-hidden="true">{flowers.map(([left, height, color], index) => <span className="garden-flower" key={left} style={{ left: `${left}%`, height: `${height}%`, color, "--flower-index": index } as React.CSSProperties}><i className="garden-stem" /><FlowerLogo variant="flower" /><i className="garden-leaf garden-leaf-left" /><i className="garden-leaf garden-leaf-right" /></span>)}</div></footer>;
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const navigate = (to: string) => { window.history.pushState({ portfolioNavigation: true }, "", to); setRoute(currentRoute()); window.scrollTo({ top: 0 }); };
  useEffect(() => { const pop = () => setRoute(currentRoute()); window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop); }, []);
  useEffect(() => { document.title = `${route.collection ?? (route.path === "/" ? "Portfolio" : route.path.slice(1))} — Christy Ho`; }, [route]);
  const page = useMemo(() => {
    if (route.path === "/") return <Home onNavigate={navigate} />;
    if (route.path === "/photography") return <WorkIndex kind="Photography" title="Photography" intro="Portraits, film, and quiet visual notes made with patience, play, and attention to the in-between." onNavigate={navigate} />;
    if (route.path === "/design") return <WorkIndex kind="Design" title="Graphic Design" intro="Identity systems, editorial work, lettering, campaigns, and objects designed to be held onto." onNavigate={navigate} />;
    if (route.path === "/tech") return <WorkIndex kind="Tech" title="Creative Tech" intro="Creative code and interactive work where systems become expressive, tactile, and a little unexpected." onNavigate={navigate} />;
    if (route.path === "/contact") return <Contact onNavigate={navigate} />;
    if (route.path === "/resume") return <Resume />;
    if (route.path === "/folder" && route.collection) return <FolderPage folder={route.collection} onNavigate={navigate} />;
    if (route.path === "/project" && route.collection) return <ProjectDetail collection={route.collection} onNavigate={navigate} />;
    return <NotFound onNavigate={navigate} />;
  }, [route]);
  return <><Navbar onNavigate={navigate} />{page}<ScrollToTopButton /><Footer onNavigate={navigate} /></>;
}
