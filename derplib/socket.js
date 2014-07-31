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
	
	if(this._socket._events.connect){
		this._socket.connect(this._port, this._host);
	}else{
		this._socket.connect(this._port, this._host, function() {
			self._connected = true;
			self._writeLock = false;
			
			self._pingTask = setInterval(function() {
				if(self._connected) {
					self.write(['']);
				}
			}, 30000);
			
			self.emit('onconnect');
		});
	}
	
	if(reconnecting) return;
	
	this._socket.on('data', function(data) {
	
		var buffer = data.toString('utf8');
		
		if(buffer.substr(-1) !== '\x00')
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
			var messages = buffer.split('\x00');
			
			_.each(messages, function(message){
				
				message = message.replace(/(\r|\n)/g, '');
				
				if(message !== '')
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

Socket.prototype.setWriteLock = function(bool) {
	this._writeLock = _.isBoolean(bool) && bool;
}

Socket.prototype.write = function(data) {
	
	if(this._connected)
	{
		if(this._firstCommand)
		{
			var terminator = '\x00';
			this._firstCommand = false;
		}
		else
			var terminator = '\r\n\x00';
		
		if(this._writeLock) 
			this._writeBuffer.push(data);
		else
		{
			_.each(this._writeBuffer, function(value){
				this.write(value);
			}.bind(this));
			
			if(data)
				this.emit('write', data.join(':'));
			this._socket.write(data.join(':') + terminator);
		}
	}
}

exports.Instance = Socket;
