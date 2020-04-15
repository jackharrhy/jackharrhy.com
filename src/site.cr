require "json"
require "http/client"

require "docker"
require "kemal"

client = Docker::Api::ApiClient.new

def dockerhub_link_from_image(image : String)
  domain = "_"
  parts = image.split "/"
  if parts.size == 2
    domain = "r/#{parts[0]}"
    parts.shift
  end
  "https://hub.docker.com/#{domain}/#{parts.pop}"
end

get "/" do
  containers = client.containers all: true
  traefik_response = HTTP::Client.get "http://localhost:8080/api/http/routers"
  traefik_body = JSON.parse(traefik_response.body).as_a.reject { |i| i["entryPoints"][0] != "websecure"}
  render "src/views/index.ecr"
end

Kemal.config.env = "production"
Kemal.run
