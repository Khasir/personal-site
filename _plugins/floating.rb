module Jekyll
  # A floating note in the left margin (on desktop) or on top of the screen (on mobile).
  # Footnotes and encrypted posts not supported.
  #
  #   {% floating title="A *note* in the margin" text="Optional smaller line." %}
  #   First paragraph of the section.
  #
  #   Last paragraph of the section.
  #   {% endfloating %}
  #
  # Params:
  #   title - required, inline markdown
  #   text  - optional, inline markdown
  class FloatingBlock < Liquid::Block
    ATTR = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/

    def initialize(tag_name, markup, tokens)
      super
      @attrs = {}
      markup.scan(ATTR) { |key, dq, sq, bare| @attrs[key] = dq || sq || bare }
      title = @attrs["title"]
      raise Liquid::SyntaxError, "floating: missing title=\"...\"" if title.nil? || title.strip.empty?
    end

    def render(context)
      inner = super
      text = @attrs["text"]

      html = +%(<div class="floating-section" markdown="1">\n)
      html << %(<aside class="floating-note"><div class="floating-inner">)
      html << %(<p class="floating-title" markdown="span">#{@attrs["title"]}</p>)
      html << %(<p class="floating-text" markdown="span">#{text}</p>) if text && !text.strip.empty?
      html << %(</div></aside>\n\n#{inner.strip}\n\n</div>\n)
    end
  end
end

Liquid::Template.register_tag("floating", Jekyll::FloatingBlock)
