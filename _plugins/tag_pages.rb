module Jekyll
  # Generates one page per tag at /tags/:tag/, listing every non-hidden
  # post/note that carries that tag. Reads its front matter/body straight
  # from _layouts/tag.html via read_yaml (see https://jekyllrb.com/docs/plugins/generators/).
  class TagPage < Page
    def initialize(site, tag, slug, entries)
      @site = site
      @base = site.source
      @dir = File.join("tags", slug)
      @name = "index.html"

      process(@name)
      read_yaml(File.join(site.source, "_layouts"), "tag.html")

      data["title"] = tag
      data["tag"] = tag
      data["entries"] = entries
      data["permalink"] = "/tags/#{slug}/"
    end
  end

  class TagPageGenerator < Generator
    safe true
    priority :low

    def generate(site)
      tagged = Hash.new { |h, k| h[k] = [] }

      (site.posts.docs + site.collections["notes"].docs).each do |doc|
        next if doc.data["hidden"]

        Array(doc.data["tags"]).each { |tag| tagged[tag] << doc }
      end

      tagged.each do |tag, docs|
        slug = Utils.slugify(tag)
        sorted = docs.sort_by { |doc| (doc.data["post_date"] || doc.date).to_s }.reverse
        site.pages << TagPage.new(site, tag, slug, sorted)
      end
    end
  end
end
