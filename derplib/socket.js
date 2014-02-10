'use strict';
var _		= require('underscore'),
	util 	= require('util'),
	events 	= require('events'),
	net 	= require('net'),
	colors 	= require('colors');

// Chatango Socket connection handler, for both Rooms and PM
// Available events: onconnect, data, error, timeout, close, write ( Note: exceptions must be handled! )

function Socket(host, port)
{
	this._host = host;
	this._port = port || 443;
	this._socket = new net.Socket();
	
	this._pingTask = false;
	
	this._connected = false;
	
	this._firstCommand = true;
	this._writeLock = false;
	this._writeBuffer = [];
	this._buffer = '';
	
	this.foobar = false;
	
	this.connect();
}

util.inherits(Socket, events.EventEmitter);

Socket.prototype.connect = function()
{
	if(this._socket._connecting) return;
	
	var self = this;
	
	if(this._socket.destroyed){
		var reconnecting = true;
		console.log('[SOCKET] reconnecting to '+this._host+':'+this._port);
	}else{
		var reconnecting = false;
		console.log('[SOCKET] connecting to '+this._host+':'+this._port);
	}
	
	this._writeLock = true;
	
	this._socket.connect(this._port, this._host, function() {
		self._connected = true;
		self._writeLock = false;
		
		self._pingTask = setInterval(function() {
			if(self._connected) {
				self.write([]);
			}
		}, 30000);
		
		self.emit('onconnect');
	});
	
	if(reconnecting) return;
	
	this._socket.on('data', function(data) {
	
		var buffer = data.toString('utf8');
		
		if(buffer.substr(-3) !== '\r\n\0')
		{
			self._buffer += buffer;
		}
		else
		{
			if(self._buffer != '')
			{
				buffer = self._buffer + buffer;
				self._buffer = '';
			}
			var messages = buffer.split('\r\n\0');
			
			_.each(messages, function(message){
				
				if(message.replace(/(\r|\n)/g, '') != '')
					self.emit('data', message);
				
			});
		}
	
	});
	
	this._socket.on('error', function(exception) {
		self.emit('error', exception);
	});
	
	this._socket.on('timeout', function(exception) {
		self.emit('timeout', exception);
	});
	
	this._socket.on('close', function() {
		self._connected = false;
		self._writeBuffer = [];
		self._writeLock = false;
		self._buffer = '';
		self._firstCommand = true;
		clearInterval(self._pingTask);
		self.emit('close');
	});
	
}

Socket.prototype.disconnect = function(){
	this._socket.destroy();
}

Socket.prototype.reconnect = function(){
	this.disconnect();
	this.connect();
}

Socket.prototype.setWriteLock = function(bool) {
	this._writeLock = _.isBoolean(bool) && bool;
}

Socket.prototype.write = function(data) {
	
	if(this._connected)
	{
		if(this._firstCommand)
		{
			var terminator = '\0';
			this._firstCommand = false;
		}
		else
			var terminator = '\r\n\0';
		
		if(this._writeLock) 
			this._writeBuffer.push(data);
		else
		{
			_.each(this._writeBuffer, function(value){
				this.write(value);
			});
			
			if(data)
				this.emit('write', data.join(':'));
			this._socket.write(data.join(':') + terminator);
		}
	}
}

exports.Instance = Socket;
