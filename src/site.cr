require "docker"
require "kemal"

client = Docker::Api::ApiClient.new

get "/" do
  containers = client.containers all: true
  render "src/views/index.ecr"
end

Kemal.config.env = "production"
Kemal.run
