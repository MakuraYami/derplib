'use strict';
var fs 		= require('fs');
var MM = module.parent;
	


exports.walkdir = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          exports.walkdir(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};



exports.html_encode = function(str) {
    return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

exports.html_decode = function(value){
    return String(value)
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

exports.html_remove = function(msg){
	var li = msg.split('<');
	if(li.length == 1){
		return li[0];
	}else{
		var ret = [li[0]];
		for(var data in li){
			li[data] = li[data].split('>', 2);
			if(li[data][1] != '\r\n\u0000')
				ret.push(li[data][1]);
		}
		return ret.join('');
	}
}

//
// Internal functions
//

exports.parseContact = function(state, time){
	time = parseInt(time);
	var contact = {state: false, time: false};
	if(state == 'on' && time == 0){
		//ONLINE
		return {state: 'online', time: Math.round(+new Date/1000)};
	}
	else if(state == 'on' && time > 0){
		//IDLE
		return {state: 'idle', time: Math.round(+new Date/1000) - (time * 60)};
	}
	else if(state == 'off'){
		//OFF
		return {state: 'off', time: time};
	}
	return false;
}

exports.genUid = function() {
	var min = Math.pow(10, 15);
	var max = Math.pow(10, 16);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.getAnonId = function(n,ssid) { //n is from message body, ssid is user_id
	//example: 5454/16766087 = anon1431
	if(!n || !ssid) return false;
	var id = '';
	for(var i=0; i<4; i++){
		var a = parseInt(n.substr(i, 1)) + parseInt(ssid.substr(i+4, 1));
		id += String(a>9 ? a-10 : a);
	}
	return id;
}


