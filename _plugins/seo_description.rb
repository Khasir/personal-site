module Jekyll
  module SeoDescription
    # A sentence-ending punctuation mark followed by whitespace or the end of
    # the string, non-greedy so it stops at the first one.
    SENTENCE_END = /\A.+?[.!?](?=\s|\z)/m.freeze

    # jekyll-seo-tag prefers page["description"], falling back to the
    # kramdown excerpt (first paragraph) if unset. Prefer the post/note's
    # subtitle for link-preview descriptions when present, since it's a
    # purpose-written summary rather than whatever the opening paragraph
    # happens to be; otherwise use just the first sentence of that opening
    # paragraph rather than the whole thing.
    def self.apply(doc)
      return unless doc.data["description"].to_s.empty?

      if !doc.data["subtitle"].to_s.empty?
        doc.data["description"] = doc.data["subtitle"]
      elsif (excerpt = doc.data["excerpt"])
        sentence = first_sentence(excerpt.output)
        doc.data["description"] = sentence if sentence
      end
    end

    def self.first_sentence(html)
      text = html.to_s.gsub(%r!<[^>]+>!, "").gsub(/\s+/, " ").strip
      return nil if text.empty?

      match = text.match(SENTENCE_END)
      match ? match[0] : text
    end
  end
end

Jekyll::Hooks.register [:posts, :notes], :pre_render do |doc|
  Jekyll::SeoDescription.apply(doc)
end
