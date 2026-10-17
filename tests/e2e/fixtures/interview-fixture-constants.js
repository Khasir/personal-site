// Two throwaway interviews for the e2e suite: a visible one (list page, feed,
// tag page) and a `hidden: true` one (must stay out of all of those but still
// be reachable by direct link). No date prefix in the filenames -- like
// notes, interviews take their date from `post_date`.
export const INTERVIEW_FIXTURE_DIR = "content/_interviews";
export const INTERVIEW_TAG = "e2e-interview-tag";

export const INTERVIEW_FIXTURE = {
  path: `${INTERVIEW_FIXTURE_DIR}/e2e-interview-fixture.md`,
  url: "/interviews/e2e-interview-fixture/",
  title: "E2E Interview Fixture",
  subtitle: "An interview subtitle.",
  linkPreview: "A short blurb about the interview.",
  body: "The unique interview answer text.",
  contents: [
    "---",
    'title: "E2E Interview Fixture"',
    'subtitle: "An interview subtitle."',
    "post_date: 2024-01-02",
    `tags: [${INTERVIEW_TAG}]`,
    'link_preview: "A short blurb about the interview."',
    "comments: false",
    "---",
    "",
    "The unique interview answer text.",
    "",
  ].join("\n"),
};

export const HIDDEN_INTERVIEW_FIXTURE = {
  path: `${INTERVIEW_FIXTURE_DIR}/e2e-hidden-interview-fixture.md`,
  url: "/interviews/e2e-hidden-interview-fixture/",
  title: "E2E Hidden Interview Fixture",
  contents: [
    "---",
    'title: "E2E Hidden Interview Fixture"',
    "post_date: 2024-01-03",
    `tags: [${INTERVIEW_TAG}]`,
    "hidden: true",
    "comments: false",
    "---",
    "",
    "Hidden interview body.",
    "",
  ].join("\n"),
};
