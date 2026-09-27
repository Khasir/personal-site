// Inline SVGs (wider than tall, to check the grid crops them square), so the
// fixture doesn't depend on anything in content/images/.
function svg(fill) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20'%3E%3Crect width='40' height='20' fill='${fill}'/%3E%3C/svg%3E`;
}

export const GALLERY_IMAGES = [
  { src: svg("red"), alt: "A red rectangle", caption: "The red one" },
  { src: svg("green"), alt: "A green rectangle", caption: "The *green* one" },
  { src: svg("blue"), alt: "A blue rectangle", caption: "The blue one" },
];
export const STANDALONE_IMAGE = { src: svg("gray"), alt: "A gray rectangle", caption: "A standalone figure" };

function include({ src, alt, caption }, extra = "") {
  return `{% include figure.html src="${src}" alt="${alt}" caption="${caption}"${extra} %}`;
}

export const GALLERY_FIXTURE_CONTENTS = [
  "---",
  'title: "E2E Gallery Fixture"',
  "post_date: 2024-01-01",
  "hidden: true",
  "comments: false",
  "---",
  "",
  "Some intro text.",
  "",
  '{% gallery caption="Three *test* images.[^g]" columns=3 %}',
  include(GALLERY_IMAGES[0]),
  // align/width should be ignored inside a gallery.
  include(GALLERY_IMAGES[1], ' align="right" width="100px"'),
  include(GALLERY_IMAGES[2]),
  "{% endgallery %}",
  "",
  include(STANDALONE_IMAGE),
  "",
  "[^g]: A footnote on the gallery caption.",
  "",
].join("\n");
export const GALLERY_FIXTURE_PATH = "content/_posts/2024-01-01-e2e-gallery-fixture.md";
export const GALLERY_FIXTURE_URL = "/posts/e2e-gallery-fixture/";
