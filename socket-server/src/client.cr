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

  def to_json()
    JSON.build do |json|
      json.object do
        json.field "id", @id
        json.field "messages", @messages.to_a
      end
    end
  end

  def archive
    File.write(Config.history_path + @id.to_s + ".json", self.to_json)
  end

  def self.remove(client)
    client.archive()
    @@store.delete(client.id)
  end

  def self.store
    @@store
  end
end
