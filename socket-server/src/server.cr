require "kemal"

input_endpoint= ENV["SS_INPUT_ENDPOINT"] ||= "/in"
backlog_size = (ENV["SS_BACKLOG_SIZE"] ||= "250").to_i
port = (ENV["SS_PORT"] ||= "3000").to_i

puts "socket-server starting"

messages = Deque.new([] of String)
clients = [] of HTTP::WebSocket
inputs = [] of HTTP::WebSocket

ws "/" do |socket|
	puts "Socket connected to /: #{socket}"

	clients.push socket

	previous_sent_messages = ""
	messages.each do |m|
		previous_sent_messages += m
	end
	socket.send previous_sent_messages

	socket.on_close do |_|
		clients.delete(socket)
		puts "Closing Socket: #{socket}"
 	end
end

ws input_endpoint do |socket|
	puts "Socket connected to #{input_endpoint}: #{socket}"

	inputs.push socket

	socket.on_message do |message|
		puts "New message from Socket on #{input_endpoint}: #{socket} - #{message}"
		messages.push message

		if messages.size > backlog_size
			messages.shift
		end

		clients.each do |other_socket|
			other_socket.send message
		end
	end

	socket.on_close do |_|
		inputs.delete(socket)
		puts "Closing Socket: #{socket}"
 	end
end

Kemal.run(port)
