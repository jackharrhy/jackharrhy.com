import { visit } from 'unist-util-visit';
import path from 'path';
import { resolveWikiLink } from './garden-routing.mjs';

/**
 * Parse a ```component block body into a props object.
 * First line is the component name, remaining lines are "key: value" pairs.
 *
 * Example:
 *   Feed
 *   source: linkblog
 *   limit: 5
 *
 * Returns: { component: "Feed", source: "linkblog", limit: "5" }
 */
function parseComponentBlock(value) {
  const lines = value.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const name = lines[0];
  const props = { component: name };

  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon === -1) continue;
    const key = lines[i].slice(0, colon).trim();
    const val = lines[i].slice(colon + 1).trim();
    props[key] = val;
  }

  return props;
}

/**
 * Serialize props object to HTML attributes string.
 * Values that look numeric are emitted without quotes for cleanliness,
 * but all values are valid as HTML attributes.
 */
function propsToAttrs(props) {
  return Object.entries(props)
    .filter(([k]) => k !== 'component')
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

/**
 * Remark plugin for Obsidian-flavored markdown.
 *
 * Handles:
 * - Tab-indented continuation lines → visually indented <div class="ml-8">
 * - ```component fenced blocks → <x-componentname> custom elements
 * - YouTube image embeds ![](youtube-url) → responsive iframe
 * - Wikilinks [[page]] and [[page|text]] → <a> links
 * - Media embeds ![[file.ext|WxH]] → <img>, <video>, <audio>
 */
export function remarkObsidian(options = {}) {
  const gardenIndex = options.gardenIndex;

  return (tree, file) => {
    // Pass 1: Tab-indented continuation lines → indented divs.
    // In Obsidian, a tab-indented line under a paragraph creates visual nesting.
    // Standard markdown joins them into one paragraph. We split into parent + indented div.
    const src = String(file);
    if (src.includes('\t')) {
      const srcLines = src.split('\n');

      visit(tree, 'paragraph', (node, index, parent) => {
        if (!parent || index === null || !node.position) return;

        const startLine = node.position.start.line;
        const endLine = node.position.end.line;

        // Check if any continuation lines are tab-indented
        let hasTabLine = false;
        for (let l = startLine + 1; l <= endLine; l++) {
          if (srcLines[l - 1] && srcLines[l - 1].startsWith('\t')) {
            hasTabLine = true;
            break;
          }
        }
        if (!hasTabLine) return;

        // Build set of tab-indented lines
        const tabbedLines = new Set();
        for (let l = startLine; l <= endLine; l++) {
          if (srcLines[l - 1] && srcLines[l - 1].startsWith('\t')) {
            tabbedLines.add(l);
          }
        }

        // Split paragraph children at \n boundaries where indentation changes
        const segments = [];
        let currentTabbed = tabbedLines.has(startLine);
        let currentSegment = { tabbed: currentTabbed, children: [] };
        segments.push(currentSegment);
        let currentLine = startLine;

        for (const child of node.children) {
          if (child.type === 'text' && child.value.includes('\n')) {
            const parts = child.value.split('\n');
            for (let p = 0; p < parts.length; p++) {
              if (p > 0) {
                currentLine++;
                const nowTabbed = tabbedLines.has(currentLine);
                if (nowTabbed !== currentSegment.tabbed) {
                  currentSegment = { tabbed: nowTabbed, children: [] };
                  segments.push(currentSegment);
                }
              }
              if (parts[p].length > 0) {
                currentSegment.children.push({ type: 'text', value: parts[p] });
              }
            }
          } else {
            currentSegment.children.push(child);
            if (child.position) currentLine = child.position.end.line;
          }
        }

        if (segments.length <= 1) return;

        const replacements = [];
        for (const seg of segments) {
          if (seg.children.length === 0) continue;
          while (seg.children.length && seg.children[0].type === 'text' && !seg.children[0].value.trim()) seg.children.shift();
          while (seg.children.length && seg.children.at(-1).type === 'text' && !seg.children.at(-1).value.trim()) seg.children.pop();
          if (!seg.children.length) continue;

          if (seg.tabbed) {
            replacements.push({
              type: 'paragraph',
              data: { hName: 'div', hProperties: { className: ['ml-8', 'mb-4', 'last:mb-0'] } },
              children: seg.children,
            });
          } else {
            replacements.push({ type: 'paragraph', children: seg.children });
          }
        }

        if (replacements.length > 1) {
          parent.children.splice(index, 1, ...replacements);
          return index + replacements.length;
        }
      });
    }

    // Pass 2: ```component fenced code blocks → custom HTML elements.
    // These are later picked up by Astro's <Content components={...}> mechanism.
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || index === null) return;
      if (node.lang !== 'component') return;

      const props = parseComponentBlock(node.value);
      if (!props) return;

      const tag = `x-${props.component.toLowerCase()}`;
      const attrs = propsToAttrs(props);

      parent.children[index] = {
        type: 'html',
        value: `<${tag}${attrs}></${tag}>`,
      };
    });

    // Pass 3: YouTube image embeds → responsive iframes.
    visit(tree, (node, index, parent) => {
      if (!parent || index === null) return;
      if (node.type !== 'paragraph' && node.type !== 'listItem') return;

      // For list items, check direct children; for paragraphs, check children
      const childrenToCheck = node.type === 'listItem' ? node.children : [node];

      for (const container of childrenToCheck) {
        if (!container.children) continue;

        for (let i = 0; i < container.children.length; i++) {
          const child = container.children[i];

          if (child.type === 'image') {
            const url = child.url;
            const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
            const match = url.match(youtubeRegex);

            if (match) {
              const videoId = match[1];
              // Replace the image with a proper MDAST node that survives remarkRehype
              container.children[i] = {
                type: 'paragraph',
                data: {
                  hName: 'div',
                  hProperties: {
                    style: 'position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0;',
                  },
                  hChildren: [
                    {
                      type: 'element',
                      tagName: 'iframe',
                      properties: {
                        style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
                        src: `https://www.youtube.com/embed/${videoId}`,
                        frameborder: '0',
                        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                        allowfullscreen: true,
                      },
                      children: [],
                    },
                  ],
                },
                children: [],
              };
            }
          }
        }
      }
    });

    // Pass 4: Wikilinks [[...]] and media embeds ![[...]].
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;

      const text = node.value;
      const newNodes = [];
      let lastIndex = 0;
      let modified = false;

      // Combined regex to match both images and wikilinks
      // Images: ![[filename.ext|WxH]]
      // Wikilinks: [[Garden/page]] or [[page|custom text]]
      const obsidianRegex = /(!?)\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

      let match;
      while ((match = obsidianRegex.exec(text)) !== null) {
        const [fullMatch, exclaim, target, extra] = match;
        const matchIndex = match.index;

        // Add text before the match
        if (matchIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, matchIndex),
          });
        }

        if (exclaim === '!') {
          // This is a media embed: ![[filename.ext|WxH]]
          const filename = target;
          const dimensions = extra; // Could be "WIDTHxHEIGHT" or undefined

          // Parse dimensions if provided
          let width, height;
          if (dimensions && /^\d+x\d+$/.test(dimensions)) {
            [width, height] = dimensions.split('x');
          }

          // Check file type
          const ext = path.extname(filename).toLowerCase();
          const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.avif'];
          const videoExts = ['.mp4', '.mov', '.webm'];
          const audioExts = ['.wav', '.mp3', '.m4a', '.ogg'];

          if (imageExts.includes(ext)) {
            // Create image node
            const basename = path.basename(filename, ext);
            newNodes.push({
              type: 'image',
              url: `/asset/${filename}`,
              alt: basename,
              data: {
                hProperties: {
                  width: width || 'auto',
                  height: height || 'auto',
                  loading: 'lazy',
                },
              },
            });
            modified = true;
          } else if (videoExts.includes(ext)) {
            // Mark as media embed — will be lifted out of paragraph in a later pass
            const videoProps = {
              controls: true,
              style: 'max-width: 100%',
            };
            if (width) videoProps.width = width;
            if (height) videoProps.height = height;

            if (ext === '.mov') {
              videoProps.src = `/asset/${filename}`;
            }

            const videoChildren = ext === '.mov'
              ? [{ type: 'text', value: 'Your browser does not support the video tag.' }]
              : [
                  {
                    type: 'element',
                    tagName: 'source',
                    properties: {
                      src: `/asset/${filename}`,
                      type: `video/${ext.slice(1)}`,
                    },
                    children: [],
                  },
                  { type: 'text', value: 'Your browser does not support the video tag.' },
                ];

            newNodes.push({
              type: 'mediaEmbed',
              data: {
                hName: 'video',
                hProperties: videoProps,
                hChildren: videoChildren,
              },
            });
            modified = true;
          } else if (audioExts.includes(ext)) {
            // Mark as media embed — will be lifted out of paragraph in a later pass
            newNodes.push({
              type: 'mediaEmbed',
              data: {
                hName: 'audio',
                hProperties: {
                  controls: true,
                  style: 'max-width: 100%',
                },
                hChildren: [
                  {
                    type: 'element',
                    tagName: 'source',
                    properties: {
                      src: `/asset/${filename}`,
                      type: `audio/${ext.slice(1)}`,
                    },
                    children: [],
                  },
                  { type: 'text', value: 'Your browser does not support the audio tag.' },
                ],
              },
            });
            modified = true;
          } else {
            // Unknown file type, keep as text (likely a page embed)
            newNodes.push({
              type: 'text',
              value: fullMatch,
            });
          }
        } else {
          // This is a wikilink: [[target]] or [[target|linkText]]
          let linkText = extra;

          // If no custom link text, use the page name
          if (!linkText) {
            const parts = target.split('/');
            linkText = parts[parts.length - 1];
          }

          const resolution = gardenIndex
            ? resolveWikiLink(fullMatch, gardenIndex)
            : { ok: false, reason: 'not-found' };

          if (resolution.ok) {
            newNodes.push({
              type: 'link',
              url: resolution.url,
              children: [
                {
                  type: 'text',
                  value: resolution.label ?? linkText,
                },
              ],
            });
          } else {
            newNodes.push({
              type: 'text',
              value: linkText,
            });
          }
          modified = true;
        }

        lastIndex = matchIndex + fullMatch.length;
      }

      // Add any remaining text
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        });
      }

      // Only replace if we found matches
      if (modified && newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
        return index + newNodes.length;
      }
    });

    // Pass 5: Lift mediaEmbed nodes out of paragraphs.
    // A mediaEmbed inside a paragraph is invalid MDAST (block in inline).
    // Split the parent paragraph so the media becomes a sibling.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === null) return;

      const hasMedia = node.children.some(c => c.type === 'mediaEmbed');
      if (!hasMedia) return;

      // Split children into runs of inline content vs mediaEmbed nodes
      const replacements = [];
      let inlineBuf = [];

      const flushInline = () => {
        if (inlineBuf.length > 0) {
          // Only emit a paragraph if there's non-whitespace content
          const hasContent = inlineBuf.some(c =>
            c.type !== 'text' || c.value.trim().length > 0
          );
          if (hasContent) {
            replacements.push({
              type: 'paragraph',
              children: inlineBuf,
            });
          }
          inlineBuf = [];
        }
      };

      for (const child of node.children) {
        if (child.type === 'mediaEmbed') {
          flushInline();
          // Promote the mediaEmbed to a top-level paragraph with hName
          replacements.push({
            type: 'paragraph',
            data: child.data,
            children: [],
          });
        } else {
          inlineBuf.push(child);
        }
      }
      flushInline();

      if (replacements.length > 0) {
        parent.children.splice(index, 1, ...replacements);
        return index + replacements.length;
      }
    });
  };
}
