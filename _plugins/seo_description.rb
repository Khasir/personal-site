module Jekyll
  module SeoDescription
    # jekyll-seo-tag prefers page["description"], falling back to the
    # kramdown excerpt (first paragraph) if unset. Prefer the post/note's
    # subtitle for link-preview descriptions when present, since it's a
    # purpose-written summary rather than whatever the opening paragraph
    # happens to be.
    def self.apply(doc)
      return unless doc.data["description"].to_s.empty?
      return if doc.data["subtitle"].to_s.empty?

      doc.data["description"] = doc.data["subtitle"]
    end
  end
end

Jekyll::Hooks.register [:posts, :notes], :pre_render do |doc|
  Jekyll::SeoDescription.apply(doc)
end
