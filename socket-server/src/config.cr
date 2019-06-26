class Config
  @@input_endpoint : String = ENV["SS_INPUT_ENDPOINT"] ||= "/in"
  @@admin_endpoint : String = ENV["SS_ADMIN_ENDPOINT"] ||= "/admin"
  @@backlog_size : Int32 = (ENV["SS_BACKLOG_SIZE"] ||= "250").to_i
  @@port : Int32 = (ENV["SS_PORT"] ||= "3000").to_i
  @@history_path : String = ENV["SS_HISTORY_PATH"] ||= "./history/"

  def self.input_endpoint
    @@input_endpoint
  end

  def self.admin_endpoint
    @@admin_endpoint
  end

  def self.backlog_size
    @@backlog_size
  end

  def self.port
    @@port
  end

  def self.history_path
    @@history_path
  end
end
