'use strict';
///////////////////
// Base requires //
var util 		= require('util'),
	events 		= require('events'),
	url			= require('url'),
	http		= require('http'),
	querystring = require('querystring'),
	_			= require('underscore'),
	colors 		= require('colors');
	
var MM = module.parent,
	socket 	= MM.libary.load('socket'),
	weights = MM.libary.load('weights'),
	utils 	= MM.libary.load('utils'),
	frame 	= MM.libary.load('frame'),
	request = MM.libary.load('request'),
	eventModule = MM.libary.load('eventModule');

/////////////////
// Chatango PM //

function PM(options) {
    events.EventEmitter.call(this);
	
	options = options || {};
	
	this.name = 'PM';
	this.ispm = true;
	this.contacts = {};
	this.blocklist = [];
	this._account = options.account || false;
	this._password = options.password || false;
	this._loggedIn = false;
	this._authid = false;
	this._writeLock = false;
	this._consoleFilter = ['premium', 'msg'];
	this._messages = [];
	this._autoReconnect = options.reconnect || true;
	this._settings = {
		useBackground: true,
		useMedia: false,
		nameColor: 'CFF',
		textSize: '13',
		textColor: 'f00',
		textFont: '9',
	};
	
	var self = this;
	
	eventModule.emit("event", "newpm", this._account, function(settings){
		if(Object.prototype.toString.call(settings) === "[object Object]")
			self._settings = _.extend(self._settings, settings);
		self.login();
	});
	
}

util.inherits(PM, events.EventEmitter);

PM.prototype.login = function(){
	
	var self = this;
	
	this.authenticate(function(result){
		if(result){
			console.log('[PM] Session is authenticated');
			self._authid = result;
			self._sock = new socket.Instance('c1.chatango.com',	5222);
			self._onAuth();
			eventModule.emit("_PMLoggedIn");
		} else {
			console.log('[PM] Session failed to authenticate');
			eventModule.emit("_PMLoginFail");
		}
	});
	
}

PM.prototype.authenticate = function(callback){
	console.log('logging in to account', this._account);
	var auth_re = /auth\.chatango\.com ?= ?([^;]*)/;
	var data = querystring.stringify({user_id: this._account, password: this._password, storecookie: 'on', checkerrors: 'yes'});
	var options = {host: 'chatango.com', port: 80, path: '/login', method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': data.length}};
	var self = this;
	var req = http.request(options, function(res) {
		if (res.headers['set-cookie'][2]) {
			var m = auth_re.exec(res.headers['set-cookie'][2]);
			if (m) return callback(m[1]);
		}
		callback(false);
		res.on('data', function(chunk){ });
		res.on('end', function(){ });
	}).on('error', function(e) {
		callback(false);
	});
	req.write(data);
	req.end();
}

PM.prototype._onAuth = function(){
	
	var self = this;
	
	/////////////////////
	// Socket Handlers //
	
	this._sock.on('onconnect', function() {
		
		self.write(['tlogin', self._authid, '2']);
		
		self._writeLock = true;
		
		eventModule.emit("_PMConnected");
	});
	
	this._sock.on('error', function(exception) {
		console.log(('['+self.name+'] Socket ERROR:').bold.red, exception);
	});
	
	this._sock.on('timeout', function(exception) {
		console.log(('['+self.name+'] Socket TIMEOUT:').bold.red, exception);
	});
	
	this._sock.on('close', function() {
		if(self._autoReconnect){
			console.log(('['+self.name+'] Socket closed, reconnecting').bold.red);
			self._sock.connect();
		}else{
			console.log(('['+self.name+'] Socket closed, reconnect is off').bold.red);
		}
	});
	
	this._sock.on('data', function(data) {
		
		data = data.replace(/[\r\n\0]+$/, "");
		
		var args = data.split(':');
		
		if(self._consoleFilter.indexOf(args[0]) == -1 && self._consoleFilter.indexOf('all') == -1)
			console.log('['+self.name+']', data);
		
		var _frame = frame.parseFramePM(data);
		
		if(_frame && self.listeners('frame_'+_frame.type).length > 0){
			try {
				self.emit('frame_'+_frame.type, _frame);
			}
			catch(e){
				console.log(e.stack);
				//console.log(e.stack.split('\n').slice(0,4).join(''));
			}
		}
			
	});
	
	this._sock.on('write', function(data){
		//if(data) console.log('['+self.name+'][WRITE]', data);
	});
	
	///////////////////////
	// Chatango handlers //
	
	this.on('frame_ok', function(_frame){
		self._writeLock = false;
		
		self._sock.write(['wl']);
		self._sock.write(['settings']);
		self._sock.write(['getpremium']);
		
		/*var idle = true;
		setInterval(function(){
			idle = !idle;
			self.idle(idle);
		},1000);*/
		
		eventModule.emit('event', 'PmInitialised');
	});
	
	this.on('frame_msg', function(_frame){
		// Parse Room
		var req = new request.make(self);
		// Parse Message
		req.parsePMMessage(_frame);
		
		eventModule.emit('event', 'request', req);
	});
	
	this.on('frame_msgoff', function(_frame){
		
		eventModule.emit('event', 'PmOfflineRequest', _frame);
	});
	
	this.on('frame_wl', function(_frame) {
		_.each(_frame.contacts, function(contact){
			self.contacts[contact.name] = utils.parseContact(contact.state, (contact.state == 'off' ? contact.time : contact.idle));
		});
		eventModule.emit('event', 'PmFriendList', _frame.contacts);
	});
	
	this.on('frmae_settings', function(_frame) {
	});
	
	this.on('frame_idleupdate', function(_frame) {
		if(_frame.state == 'on')
			self.contacts[_frame.name] = utils.parseContact('on', 1);
		else
			self.contacts[_frame.name] = utils.parseContact('on', 0);
		
		eventModule.emit('event', 'PmIdleupdate', _frame);
	});
	
	this.on('frame_wloffline', function(_frame){
		self.contacts[_frame.name] = utils.parseContact('off', _frame.time);
		eventModule.emit('event', 'PmContactOffline', _frame);
	});
	
	this.on('frame_wlonline', function(_frame){
		self.contacts[_frame.name] = utils.parseContact('on', 0);
		eventModule.emit('event', 'PmContactOnline', _frame);
	});
	
	this.on('frame_reload_profile', function(_frame){
		eventModule.emit('PmReloadProfile', _frame);
	});
	
	this.on('frame_wladd', function(_frame){
		self.contacts[_frame.name] = utils.parseContact(_frame.state, _frame.time);
		eventModule.emit('PmFriendAdded', _frame);
	});
	
	this.on('frame_connect', function(_frame){
		eventModule.emit('PmChatOpen', _frame);
	});
	
	this.on('frame_show_fw', function(_frame){
		this._writeLock = true;
		setTimeout(function(){
			self._writeLock = false;
		},10 * 1000);
	});
	
	this.on('frame_premium', function(_frame) {
		if(_frame.time > +new Date/1000){
			if(self._settings.useBackground)
				self.write(['msgbg', '1']);
			if(self._settings.useMedia)
				self.write(['msgmedia', '1']);
		}
		eventModule.emit('PmPremium', _frame);
	});
	
}

PM.prototype.idle = function(type){
	if(type === true)
		this._sock.write(['idle', '0']);
	else if(type === false)
		this._sock.write(['idle', '1']);
}

PM.prototype.connectChat = function(name) {
	this.write(['connect', name]);
}

PM.prototype.disconnectChat = function(name) {
	this.write(['disconnect', name]);
}

PM.prototype.disconnect = function() {
	this._sock.disconnect();
}

PM.prototype.reconnect = function(){
	this._sock.disconnect();
}

PM.prototype.write = function(args) {
	if(!this._writeLock)
		this._sock.write(args);
}

PM.prototype.message = function(body, name) {
	
	if(this._writeLock || !name || !body) return;
	
	if(Object.prototype.toString.call(body) == '[object Array]'){
		var output = '';
		for(var i=0; i<body.length; i++){
			output += '<P>'+this.font()+body[i]+'</g></P>';
		}
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+output+'</m>']);
		console.log('[PM][WRITE]['+name+'] '+body.join('\n'));
	}else{
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+this.font()+body+'</g></m>']);
		console.log('[PM][WRITE]['+name+'] '+body);
	}
};

PM.prototype.font = function(size, color, face) {
	size = size || this._settings.textSize;
	color = color || this._settings.textColor;
	face = face || this._settings.textFont;
	return '<g x'+size+'s'+color+'="'+face+'">';
}

PM.prototype.updateProfile = function(fields){
	
	return; // Experimental
	
	fields = fields || {};
	
	var data = querystring.stringify({
		dir: "checked",
		checkerrors: "yes",
		uns: "1",
		//full_profile: " ",
		line: fields.mini || "Hi.",
		email: '',
		location: '',
		gender: '',
		age: '',
	});
	var options = {hostname: this._account+'.chatango.com', path: '/updateprofile?flash&d&pic&s='+this._authid, method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': data.length}};
	var req = http.request(options, function(res) {
		console.log('STATUS: ' + res.statusCode);
		res.setEncoding('utf8');
		var result = "";
		res.on('data', function(chunk){ result += chunk; });
		res.on('end', function(){
			console.log("result")
			console.log(result);
		});
	}).on('error', function(e) {
		console.log(e);
	});
	req.write(data);
	req.end();
}

//
// Exports
//
exports.PM = PM;
