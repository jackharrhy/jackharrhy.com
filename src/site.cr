require "json"
require "http/client"

require "docker"
require "kemal"

require "dotenv"

begin
  Dotenv.load
end

TRAEFIK_HOST = ENV["JACKHARRHY_COM_TRAEFIK_HOST"]

client = Docker::Api::ApiClient.new

def dockerhub_link_from_image(image : String)
  domain = "_"
  parts = image.split "/"
  if parts.size == 2
    domain = "r/#{parts[0]}"
    parts.shift
  end
  name = parts.pop.split(":")[0]
  "https://hub.docker.com/#{domain}/#{name}"
end

def rule_part_to_a_tag(rule_part : String)
  url = "https://"
  host_regex = /Host\(`([\w.]*)`\)/
  path_prefix_regex = /PathPrefix\(`([\w\/-]*)`\)/

  match = host_regex.match rule_part
  url = "#{url}#{match[1]}" if match

  match = path_prefix_regex.match rule_part
  url = "#{url}#{match[1]}" if match

  "<a href=\"#{url}\">#{rule_part}</a>"
end

def traefik_links_from_rule(rule : String)
  display = ""
  postfix_bracket = false

  if rule.starts_with? "("
    postfix_bracket = true
    display = "("
    rule = rule.lchop
    rule = rule.rchop
  end

  rules = rule.split " || "
  rules.each do |rule_part|
    a_tag = rule_part_to_a_tag rule_part
    display = "#{display}#{a_tag} || "
  end
  display = display.chomp " || "
  display = "#{display})" if postfix_bracket

  display
end

get "/" do
  containers = client.containers all: true
  traefik_response = HTTP::Client.get "http://#{TRAEFIK_HOST}:8080/api/http/routers"
  traefik_body = JSON.parse(traefik_response.body).as_a.reject { |i| i["entryPoints"][0] != "websecure"}
  render "src/views/index.ecr"
end

Kemal.config.env = "production"
Kemal.run
