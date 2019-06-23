require "kemal"
require "json"
require "uuid"
require "uuid/json"

input_endpoint = ENV["SS_INPUT_ENDPOINT"] ||= "/in"
admin_endpoint = ENV["SS_ADMIN_ENDPOINT"] ||= "/admin"
backlog_size = (ENV["SS_BACKLOG_SIZE"] ||= "250").to_i
port = (ENV["SS_PORT"] ||= "3000").to_i

puts "socket-server starting"

class Message
  def self.new(type : String, message : String)
    JSON.build do |json|
      json.object do
        json.field "type", type
        json.field "message", message
      end
    end
  end
end

class Client
  @@store = Hash(UUID, Client).new
  @@messages_size = 50

  property websocket : HTTP::WebSocket
  property id
  property messages : Deque(String)

  def initialize(@websocket)
    @id = UUID.random
    @messages = Deque.new([] of String)
    @@store[@id] = self
  end

  def send(type : String, message : String)
    m = Message.new(type, message)
    @websocket.send m
  end

  def new_message(message : String)
    self.send("self", message)

    @messages.push message
    if @messages.size > @@messages_size
      messages.shift
    end
  end

  def self.remove(client)
    @@store.delete(client.id)
  end

  def self.store
    @@store
  end
end

messages = Deque.new([] of String)
inputs = [] of HTTP::WebSocket

get "/" do
  previous_sent_messages = ""
  messages.each do |m|
    previous_sent_messages += m
  end
  previous_sent_messages
end

get admin_endpoint do
  clients_state = Hash(UUID, Array(String)).new
  Client.store.each_value do |client|
    clients_state[client.id] = [] of String
    client.messages.each do |message|
      clients_state[client.id].push message
    end
  end
  clients_state.to_json
end

class AdminMessage
  JSON.mapping(
    to: UUID,
    message: String,
  )
end

post admin_endpoint do |env|
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

ws admin_endpoint do |socket|
  puts "Socket connected to #{admin_endpoint}: #{socket}"

  socket.on_close do |_|
    inputs.delete(socket)
    puts "Closing Socket: #{socket}"
  end
end

ws input_endpoint do |socket|
  puts "Socket connected to #{input_endpoint}: #{socket}"
  inputs.push socket

  socket.on_message do |raw_message|
    message = raw_message.chomp + "\n"

    puts "New message from Socket on #{input_endpoint}: #{socket} - #{message}"
    messages.push message

    if messages.size > backlog_size
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

Kemal.run(port)
