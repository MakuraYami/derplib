'use strict';
///////////////////
// Base requires //
var util            = require('util'),
	events        = require('events'),
	url               = require('url'),
	http             = require('http'),
	querystring = require('querystring'),
	_				    = require('underscore'),
	colors		    = require('colors');
	
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
	
	this.ispm = true;
	this.contacts = {};
	this.blocklist = [];
	this._account = options.account || false;
	this._accountLC = this._account ? this._account.toLowerCase() : false;
	this._password = options.password || false;
	this.name = this._accountLC;
	this._loggedIn = false;
	this._authid = false;
	this._writeLock = false;
	this._consoleFilter = ['premium', 'msg'];
	this._messages = [];
	this._sock = false;
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
	
	eventModule.emit("event", "newRoom", this, function(){
		// May not be changed
		self._settings.type = 'pm';
		self._settings.active = true;
		
		self.login();
	});
	
}

util.inherits(PM, events.EventEmitter);

PM.prototype.login = function(){
	
	var self = this;
	
	this.authenticate(function(result){
		if(result){
			console.log('[PM]['+self._account+'] Session is authenticated');
			self._authid = result;
			self._sock = new socket.Instance('c1.chatango.com',	5222);
			self._onAuth();
			eventModule.emit("_PMLoggedIn");
		} else {
			console.log('[PM]['+self._account+'] Session failed to authenticate');
			eventModule.emit("_PMLoginFail");
		}
	});
	
}

PM.prototype.authenticate = function(callback){
	console.log('[PM]['+this._account+'] Logging in..');
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
		console.log(('[PM]['+self._account+'] Socket ERROR:').bold.red, exception);
		if(exception.errno == 'ECONNREFUSED'){
			if(self._sock._port == 5222){
				self._sock._port = 443;
			}else if(self._sock._port == 443){
				self._sock._port = 5222;
			}
		}
	});
	
	this._sock.on('timeout', function(exception) {
		console.log(('[PM]['+self._account+'] Socket TIMEOUT:').bold.red, exception);
	});
	
	this._sock.on('close', function() {
		if(self._autoReconnect){
			console.log(('[PM]['+self._account+'] Socket closed, reconnecting').bold.red);
			self._sock.connect();
		}else{
			console.log(('[PM]['+self._account+'] Socket closed, reconnect is off').bold.red);
		}
	});
	
	this._sock.on('data', function(data) {
		
		data = data.replace(/[\r\n\0]+$/, "");
		
		var args = data.split(':');
		
		if(self._consoleFilter.indexOf(args[0]) == -1 && self._consoleFilter.indexOf('all') == -1)
			console.log('[PM]['+self._account+']', data);
		
		var _frame = frame.parseFramePM(data);
		
		if(_frame && self.listeners('frame_'+_frame.type).length > 0){
			try {
				self.emit('frame_'+_frame.type, _frame);
			}
			catch(e){
				console.log('[PM]['+self._account+'] Error: ', e.stack);
				//console.log(e.stack.split('\n').slice(0,4).join(''));
			}
		}
			
	});
	
	this._sock.on('write', function(data){
		//if(data) console.log('[PM]['+self._account+'][WRITE]', data);
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
	
	this.on('frame_settings', function(_frame) {
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
		var contact = utils.parseContact(_frame.state, _frame.time);
		self.contacts[_frame.name] = contact;
		eventModule.emit('PmFriendAdded', _.extend({name: _frame.name}, contact));
		eventModule.emit('PmFriendAdded-'+_frame.name, _.extend({name: _frame.name}, contact));
	});
	
	this.on('frame_connect', function(_frame){
		var contact = utils.parseContact(_frame.state, _frame.time);
		_frame.time = contact.time;
		_frame.state = contact.state;
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
	if(!this._writeLock){
		this._sock.write(_.isArray(args) ? args : _.toArray(arguments));
	}
}

PM.prototype.message = function(name, body) {
	
	if(this._writeLock || !name || !body) return;
	
	if(_.isArray(body)){
		var output = '';
		for(var i=0; i<body.length; i++){
			output += '<P>'+this.font()+body[i]+'</g></P>';
		}
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+output+'</m>']);
		console.log('[PM]['+this._account+'][WRITE]['+name+'] '+body.join('\n'));
	}else{
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+this.font()+body+'</g></m>']);
		console.log('[PM]['+this._account+'][WRITE]['+name+'] '+body);
	}
};

PM.prototype.font = function(size, color, face) {
	size = size || this._settings.textSize;
	color = color || this._settings.textColor;
	face = face || this._settings.textFont;
	return '<g x'+size+'s'+color+'="'+face+'">';
}

PM.prototype.addFriend = function(name){
	this.write('wladd', name);
}

PM.prototype.userTime = function(user, cb){
	user = String(user).toLowerCase();
	if( this._accountLC == user){
		return utils.parseContact('online',0);
	}
	this.addFriend(user);
	var test = eventModule.once('PmFriendAdded-'+user, function(frame){
		// Remove friend if it wasn't before.
		cb(frame);
	});
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


/*
ch_room.js
Room.prototype.parseFont = function(string) {
	var self = this;
	var all = string.split(string.match(/<font/i));
	all.shift();
	_.each(all, function(text){
		var color = text.match(/color="#(.*?)"/);
		color = color != undefined ? color[1] :self._settings.textColor;
		var size = text.match(/size="(.*?)"/);
		size = size != undefined ? size[1] :self._settings.textSize;
		var face = text.match(/face="(.*?)"/);
		face = face != undefined ? face[1] :self._settings.textFont;
		string = string.replace(/<font(.*?)>/, '<f x'+size+color+'="'+face+'">');
		string = string.replace(/<\/font>/g, '</f>');
	});
	return string;
}

Room.prototype.message = function(body) {
	
	if(this._writeLock || !body) return;
	
	var self = this;
	
	if(_.isArray(body)){
		//Multi-line message
		var output = _.reduce(body, function(output, msg, i){
			return output += self.font() + String(msg) + '</f></p>' + (i == body.length-1 ? '' : '<p>');
		}, '');
		
		output = output.replace(/(\n\r|\r\n|\n|\r|\0)/g, '<br/>');
		_.each(output.match(/.{1,2950}/gm), function(msg){
			self.write('bmsg', 'l33t', '<n'+self._settings.nameColor+'/>'+self.parseFont(msg));
		});
	}
	else{
		body = String(body).replace(/(\n\r|\r\n|\n|\r|\0)/g, '<br/>');
		_.each(body.match(/.{1,2950}/gm), function(msg){
			self.write('bmsg', 'l33t', '<n'+self._settings.nameColor+'/>' + self.font() + self.parseFont(msg));
		});
	}
};

ch_pm.js
PM.prototype.message = function(name, body) {
	var self = this;
	if(this._writeLock || !name || !body) return;
	
	if(_.isArray(body)){
		var output = '';
		for(var i=0; i<body.length; i++){
			output += '<P>'+this.font()+body[i]+'</g></P>';
		}
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+self.parseFont(output)+'</m>']);
		console.log('[PM][WRITE]['+name+'] '+body.join('\n'));
	}else{
		this.write(['msg', name, '<n'+this._settings.nameColor+'/><m v="1">'+this.font()+self.parseFont(body)+'</g></m>']);
		console.log('[PM][WRITE]['+name+'] '+body);
	}
};

PM.prototype.parseFont = function(string) {
	var self = this;
	var all = string.split(string.match(/<font/i));
	all.shift();
	_.each(all, function(text){
		var color = text.match(/color="#(.*?)"/);
		color = color != undefined ? color[1] :self._settings.textColor;
		var size = text.match(/size="(.*?)"/);
		size = size != undefined ? size[1] :self._settings.textSize;
		var face = text.match(/face="(.*?)"/);
		face = face != undefined ? face[1] :self._settings.textFont;
		string = string.replace(/<font(.*?)>/, '<g x'+size+'s'+color+'="'+face+'">');
		string = string.replace(/<\/font>/g, '</g>');
	});
	return string;
}
*/