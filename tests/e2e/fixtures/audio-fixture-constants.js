// Throwaway fixtures for "Listen to this post": one post with audio + a
// description, one with audio only, one without. The WAV is generated
// (tiny, silent) so nothing binary is committed.
export const AUDIO_DIR = "content/audio";
export const AUDIO_FILE_PATH = `${AUDIO_DIR}/e2e-audio-fixture.wav`;
export const AUDIO_FILE_FRONTMATTER = "audio/e2e-audio-fixture.wav";
export const AUDIO_FILE_URL = "/content/audio/e2e-audio-fixture.wav";

const WAV_RATE = 8000;
export const WAV_SECONDS = 20;

// 8-bit mono PCM silence.
export function makeWav() {
  const dataLen = WAV_RATE * WAV_SECONDS;
  const buf = Buffer.alloc(44 + dataLen, 0x80);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(WAV_RATE, 24);
  buf.writeUInt32LE(WAV_RATE, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

function post({ name, extra }) {
  return {
    path: `content/_posts/2024-01-01-${name}.md`,
    url: `/posts/${name}/`,
    contents: [
      "---",
      `title: "E2E ${name}"`,
      "post_date: 2024-01-01",
      "hidden: true",
      "comments: false",
      ...extra,
      "---",
      "",
      "Some body text.",
      "",
    ].join("\n"),
  };
}

export const AUDIO_DESCRIBED_FIXTURE = post({
  name: "e2e-audio-described",
  extra: [
    `audio_file: ${AUDIO_FILE_FRONTMATTER}`,
    'audio_description: "Read by *the author*. Recorded in one take."',
  ],
});
export const AUDIO_PLAIN_FIXTURE = post({
  name: "e2e-audio-plain",
  extra: [`audio_file: ${AUDIO_FILE_FRONTMATTER}`],
});
export const NO_AUDIO_FIXTURE = post({ name: "e2e-audio-none", extra: [] });
