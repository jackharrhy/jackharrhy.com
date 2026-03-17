import { visit } from 'unist-util-visit';
import path from 'path';

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
 * Combined remark plugin to transform Obsidian syntax
 * Handles images (![[image.jpg|WxH]]), video/audio (![[video.mp4]]), wikilinks ([[Garden/page]]),
 * YouTube embeds (![](youtube-url)), and ```component blocks.
 */
export function remarkObsidian() {
  return (tree) => {
    // Zero pass: Transform ```component fenced code blocks into custom HTML elements
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

    // First pass: Handle standard markdown images with YouTube URLs
    // Check both paragraphs and list items
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
              // Replace the image with HTML embed
              container.children[i] = {
                type: 'html',
                value: `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0;">
  <iframe
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
    src="https://www.youtube.com/embed/${videoId}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>`,
              };
            }
          }
        }
      }
    });

    // Second pass: Handle Obsidian wikilinks and ![[...]] syntax
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
            // Create video HTML node
            newNodes.push({
              type: 'html',
              value: `<video controls${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''} style="max-width: 100%;">
  <source src="/asset/${filename}" type="video/${ext.slice(1)}">
  Your browser does not support the video tag.
</video>`,
            });
            modified = true;
          } else if (audioExts.includes(ext)) {
            // Create audio HTML node
            newNodes.push({
              type: 'html',
              value: `<audio controls style="max-width: 100%;">
  <source src="/asset/${filename}" type="audio/${ext.slice(1)}">
  Your browser does not support the audio tag.
</audio>`,
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
          let linkPath = target;
          let linkText = extra;

          // Strip Garden/ prefix if present
          if (linkPath.startsWith('Garden/')) {
            linkPath = linkPath.slice(7); // Remove "Garden/"
          }

          // If no custom link text, use the page name
          if (!linkText) {
            const parts = linkPath.split('/');
            linkText = parts[parts.length - 1];
          }

          // Create link node
          newNodes.push({
            type: 'link',
            url: `/${linkPath.toLowerCase()}`,
            children: [
              {
                type: 'text',
                value: linkText,
              },
            ],
          });
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
  };
}
