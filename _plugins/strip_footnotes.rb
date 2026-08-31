module Jekyll
  module StripFootnotesFilter
    # Strips kramdown footnote markers like "[^label]" from a string, e.g. for
    # use in plain-text contexts (like a lightbox caption) where the markers
    # can't be rendered as real footnote links.
    def strip_footnote_refs(input)
      input.to_s.gsub(/\[\^[^\]]+\]/, "").gsub(/\s+/, " ").strip
    end
  end
end

Liquid::Template.register_filter(Jekyll::StripFootnotesFilter)
