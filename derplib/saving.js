"use strict";
var zlib 	= require('zlib'),
	fs 		= require('fs'),
	Q 		= require('q'),
	_ 			= require('underscore');

function File(_path){
	this.path = _path;
	this.data;
	this._actions = [];
	this.errorContinue = false
}

File.prototype.load = function(_path){
	this._actions.push(["_load", _path]);
	return this;
}

File.prototype._load = function(_path){
	
	if(_path) this.path = _path;
	
	var self = this;
	var deferred = Q.defer();
	
	fs.exists(this.path, function(exists){
	
		if(!exists){
			self.data = false;
			self.errorContinue = true;
			deferred.reject("No data found to load");
			return;
		}
		
		var chunks = [], buffLen = 0, reader = fs.createReadStream(self.path);
		reader.on("error", function(err){
			deferred.reject(err);
		});
		reader.on("data", function(chunk){
			chunks.push(chunk);
			buffLen += chunk.length;
		});
		reader.on("end", function(){
			var result = new Buffer(buffLen),
				lastFreeIndex = 0,
				buffer;
			while (buffer = chunks.shift()) {
				buffer.copy(result, lastFreeIndex);
				lastFreeIndex += buffer.length;
			}
			self.data = result;
			deferred.resolve(true);
		});
		
	});
	
	return deferred.promise;
}

File.prototype.save = function(_arg){
	this._actions.push(["_save", _.isString(_arg) ? _arg : false]);
	this._run(_.isFunction(_arg) ? _arg : false);
}

File.prototype._save = function(_path){
	
	if(_path) this.path = _path;

	var deferred = Q.defer();
	
	if(!this.data)
		deferred.reject("No data found to save");
	else
	{
		var writer = fs.createWriteStream(this.path);
			writer.write(this.data);
			writer.end("");
			writer.on('error', function(err){
				deferred.reject(err);
			});
			writer.on('finish', function(){
				deferred.resolve(true);
			});
	}
	
	return deferred.promise;
}

File.prototype.zip = function(){
	this._actions.push(["_zip"]);
	return this;
}

File.prototype._zip = function(){
	
	var deferred = Q.defer();
	var self = this; 
	
	if(!this.data)
		deferred.reject("No data found to zip");
	else
	{
		zlib.gzip(new Buffer(this.data, 'utf8'), function (err, result) {
			if(err){
				deferred.reject(err);
			}
			else{
				self.path += '.gz';
				self.data = result;
				deferred.resolve(true);
			}
		});
	}
	
	return deferred.promise;
}

File.prototype.unzip = function(){
	this._actions.push(["_unzip"]);
	this.path += '.gz';
	return this;
}

File.prototype._unzip = function(){
	
	var deferred = Q.defer();
	var self = this; 
	
	if(!this.data){
		self.errorContinue = true;
		deferred.reject("No data found to unzip", true);
	}
	else
	{
		zlib.gunzip(this.data, function (err, result) {
			if(err){
				deferred.reject(err);
			}
			else{
				self.data = result.toString('utf8');
				if(self.path.substr(-3) == ".gz") self.path = self.path.substr(0,self.path.length-3);
				deferred.resolve(true);
			}
		});
	}
	
	return deferred.promise;
}

File.prototype.put = function(_data){
	this._actions.push(["_put", _data]);
	return this;
}

File.prototype._put = function(_data){
	var self = this;
	return Q.fcall(function(){
		self.data = JSON.stringify(_data);
	});
}

File.prototype.get = function(cb){
	var self = this;
	this._run(function(){
		cb(JSON.parse(self.data.toString('utf8')));
	});
}

File.prototype._run = function(cb){
	
	var self = this;
	
	function next(){
		var action = self._actions.shift();
		
		var p = self[action.shift()].apply(self, action);
		
		p.done(function(){
			if(self._actions.length > 0) next();
			else if(cb) cb();
		},function(err, cont){
			console.log("ERROR", err);
			if(self.errorContinue){
				self.errorContinue = false;
				if(self._actions.length > 0) next();
				else if(cb) cb();
			}
		});
	}
	next();
}

exports.file = File;
