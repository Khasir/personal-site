module Jekyll
  # Wraps a set of `figure.html` includes in a square thumbnail grid, whose
  # images the lightbox steps through with prev/next (assets/js/lightbox.js).
  #
  #   {% gallery caption="Optional caption for the whole set" columns=3 %}
  #   {% include figure.html src="/content/images/a.jpg" alt="..." caption="Shown in the lightbox" %}
  #   {% include figure.html src="/content/images/b.jpg" alt="..." %}
  #   {% endgallery %}
  #
  # Params:
  #   caption - optional, inline markdown shown under the grid (footnotes work,
  #             same as figure.html). Per-image captions are hidden in the grid
  #             and only shown in the lightbox, so keep footnotes out of those.
  #   columns - optional, 1-6 (default 3). Narrow screens use at most 2.
  class GalleryBlock < Liquid::Block
    ATTR = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/

    def initialize(tag_name, markup, tokens)
      super
      @attrs = {}
      markup.scan(ATTR) { |key, dq, sq, bare| @attrs[key] = dq || sq || bare }
    end

    def render(context)
      inner = super
      columns = @attrs["columns"].to_i
      style = (1..6).cover?(columns) ? %( style="--gallery-cols: #{columns}; --gallery-cols-narrow: #{[columns, 2].min}") : ""
      caption = @attrs["caption"]

      # Plain HTML with no markdown="1": kramdown leaves the inner figures'
      # markup alone but still honours their (and our) markdown="span"
      # captions, just as for a standalone figure.html.
      html = +%(<figure class="gallery"#{style}>\n<div class="gallery-grid">\n#{inner.strip}\n</div>\n)
      html << %(<figcaption markdown="span">#{caption}</figcaption>\n) if caption && !caption.strip.empty?
      html << "</figure>"
    end
  end
end

Liquid::Template.register_tag("gallery", Jekyll::GalleryBlock)
