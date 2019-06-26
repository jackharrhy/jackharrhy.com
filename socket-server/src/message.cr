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
