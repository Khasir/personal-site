# Local-only helper for scripts/encrypt-post.js: renders markdown from
# stdin to HTML on stdout, through the same markdown converter (and
# _config.yml kramdown settings) Jekyll uses for normal posts, so encrypted
# posts render identically. Liquid is not processed.
#
# Run from the repo root: bundle exec ruby scripts/render-markdown.rb
require "jekyll"

# Anything logged at info level would go to stdout and end up in the HTML.
Jekyll.logger.log_level = :error

root = File.expand_path("..", __dir__)
config = Jekyll.configuration(
  "source" => root,
  "destination" => File.join(root, "_site"),
  "quiet" => true
)
site = Jekyll::Site.new(config)
converter = site.find_converter_instance(Jekyll::Converters::Markdown)

markdown = $stdin.binmode.read.force_encoding(Encoding::UTF_8)
$stdout.binmode
$stdout.write(converter.convert(markdown))
