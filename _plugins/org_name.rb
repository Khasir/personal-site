module Jekyll
  module OrgName
    NAME = "TfD".freeze
    REPLACEMENT = "T<em>f</em>&nbsp;D".freeze
    SKIP_TAGS = %w[head script style pre code kbd samp textarea template noscript].freeze
    TOKEN = /(<!--.*?-->|<[^>]+>)/m
    TAG_NAME = %r{\A<(/?)([A-Za-z][A-Za-z0-9-]*)}

    def self.apply(html)
      return html unless html.include?(NAME)

      depth = 0
      html.split(TOKEN).each_with_index.map do |part, i|
        if i.odd?
          if (m = TAG_NAME.match(part)) && SKIP_TAGS.include?(m[2].downcase)
            if m[1] == "/"
              depth -= 1 if depth > 0
            elsif !part.end_with?("/>")
              depth += 1
            end
          end
          part
        elsif depth.zero?
          part.gsub(NAME, REPLACEMENT)
        else
          part
        end
      end.join
    end
  end
end

Jekyll::Hooks.register [:pages, :posts, :notes, :interviews], :post_render do |doc|
  doc.output = Jekyll::OrgName.apply(doc.output) if doc.output_ext == ".html"
end
