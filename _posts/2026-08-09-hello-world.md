---
title: "hello, world"
subtitle: "Mostly here to exercise images, footnotes, and comments."
post_date: 2026-08-09
modified_date: 2026-08-09
tags: [meta]
---

This is the first post on the site, mostly here to make sure images, footnotes,
and comments all work end to end before any real writing happens.

Here's a centered image with a caption:

{% include figure.html src="/assets/images/sample-center.svg" alt="Placeholder illustration" caption="A centered figure, caption included." %}

And here's some text wrapping around a left-aligned image[^1]. The idea is that
paragraphs fill the space to the right of it rather than the image sitting on
its own line. This paragraph is padded out a bit longer specifically so there's
enough text to actually wrap around the image instead of just sitting below it,
which would rather defeat the point of the whole exercise.

Here's a [link](https://example.com/) to test that out.

{% include figure.html src="/assets/images/sample-left.svg" alt="Placeholder illustration" caption="Left-aligned, text wraps to the right." align="left" width="240px" %}

More text continues here to keep wrapping alongside the image. Footnotes[^2]
should show a small hover preview when you rest the cursor over the marker, and
clicking the marker should jump down to the full note at the bottom of the post.

And a quoted section, styled distinctly from the surrounding text:

> Individually, our contributions may be small — but by each person
> contributing something, we construct something larger than any of us
> could do alone.

Now a right-aligned image, with text wrapping to its left:

{% include figure.html src="/assets/images/sample-right.svg" alt="Placeholder illustration" caption="Right-aligned, text wraps to the left." align="right" width="240px" %}

Same idea, mirrored. Once there's enough text here the paragraph should wrap
around the left side of the image rather than falling below it. Try
highlighting any sentence in this post — a "Comment" button should pop up,
letting you leave a comment with just a name, no account required.

[^1]: This is the first footnote — kramdown handles the numbering and the
    back-link automatically.

[^2]: A second footnote, to make sure multiple footnotes and their hover
    previews behave correctly.
