require "kemal"
require "json"
require "uuid"
require "uuid/json"

require "./config"
require "./client"
require "./message"

if !File.directory?(Config.history_path)
  Dir.mkdir(Config.history_path)
end

puts "socket-server starting"

messages = Deque.new([] of String)
inputs = [] of HTTP::WebSocket

get "/" do
  previous_sent_messages = ""
  messages.each do |m|
    previous_sent_messages += m
  end
  previous_sent_messages
end

get Config.admin_endpoint do
  clients_state = Hash(UUID, Array(String)).new
  Client.store.each_value do |client|
    clients_state[client.id] = client.messages.to_a
  end
  clients_state.to_json
end

class AdminMessage
  JSON.mapping(
    to: UUID,
    message: String,
  )
end

post Config.admin_endpoint do |env|
  begin
    body = env.request.body.not_nil!.gets_to_end
    admin_message = AdminMessage.from_json body

    to = Client.store[admin_message.to]
    to.send("message", admin_message.message)
    env.response.status_code = 201
  rescue ex
    env.response.status_code = 400
    next ex.message
  end
end

ws "/" do |socket|
  puts "Socket connected to /: #{socket}"
  client = Client.new socket

  previous_sent_messages = ""
  messages.each do |m|
    previous_sent_messages += m
  end
  client.send("log", previous_sent_messages)

  socket.on_message do |message|
    client.new_message message
  end

  socket.on_close do |_|
    Client.remove client
    puts "Closing Socket: #{socket}"
  end
end

ws Config.admin_endpoint do |socket|
  puts "Socket connected to #{Config.admin_endpoint}: #{socket}"

  socket.on_close do |_|
    inputs.delete(socket)
    puts "Closing Socket: #{socket}"
  end
end

ws Config.input_endpoint do |socket|
  puts "Socket connected to #{Config.input_endpoint}: #{socket}"
  inputs.push socket

  socket.on_message do |raw_message|
    message = raw_message.chomp + "\n"

    puts "New message from Socket on #{Config.input_endpoint}: #{socket} - #{message}"
    messages.push message

    if messages.size > Config.backlog_size
      messages.shift
    end

    Client.store.each_value do |client|
      client.send("log", message)
    end
  end

  socket.on_close do |_|
    inputs.delete(socket)
    puts "Closing Socket: #{socket}"
  end
end

Kemal.run(Config.port)
