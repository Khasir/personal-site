// Two floating sections, padded with enough filler to scroll through, written
// the way a post would be: a single newline between each tag and the
// paragraphs around it.
const FILLER =
  "The quick brown fox jumps over the lazy dog while the afternoon light slowly " +
  "crosses the floor, and nobody in the room says anything for a long while. " +
  "A second sentence keeps the paragraph tall enough to wrap onto several lines.";

function paragraphs(label, count) {
  return Array.from({ length: count }, (_, i) => `${label} paragraph ${i + 1}. ${FILLER}`).join("\n\n");
}

export const FLOATING_FIXTURE_CONTENTS = [
  "---",
  'title: "E2E Floating Fixture"',
  "post_date: 2024-01-01",
  "hidden: true",
  "comments: false",
  "---",
  "",
  // Enough text above the first section that it can be scrolled to start
  // below the middle of the viewport.
  paragraphs("Opening", 5),
  "",
  "Intro paragraph before the first section.",
  '{% floating title="First *note*" text="Its smaller text." %}',
  paragraphs("Section one", 8),
  "{% endfloating %}",
  "Between the sections.",
  '{% floating title="Second note" %}',
  paragraphs("Section two", 8),
  "{% endfloating %}",
  "Closing paragraph after the last section.",
  "",
  paragraphs("Filler", 8),
  "",
].join("\n");
export const FLOATING_FIXTURE_PATH = "content/_posts/2024-01-01-e2e-floating-fixture.md";
export const FLOATING_FIXTURE_URL = "/posts/e2e-floating-fixture/";
