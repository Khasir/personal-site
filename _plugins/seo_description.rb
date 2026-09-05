module Jekyll
  module SeoDescription
    # jekyll-seo-tag only reads page["description"], falling back to the
    # kramdown excerpt (opening paragraph) if unset. Let a post/note override
    # that explicitly via a `link_preview` frontmatter field.
    def self.apply(doc)
      return unless doc.data["description"].to_s.empty?
      return if doc.data["link_preview"].to_s.empty?

      doc.data["description"] = doc.data["link_preview"]
    end
  end
end

Jekyll::Hooks.register [:posts, :notes], :pre_render do |doc|
  Jekyll::SeoDescription.apply(doc)
end
