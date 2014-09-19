'use strict';
var util 	= require('util'),
	crypto 	= require('crypto'),
	fs 		= require('fs'),
	request = require('request');

var MM = module.parent;
	
var crypto_algorithm = 'aes-256-cbc';
var crypto_key 	= '05f4PP1rL4JPff4PljY3G4ytZxRN662f'; // If you want to use encryption, change this
var crypto_iv 	= 'T9terqJ0NlCk7OwV'; // And this

exports.encrypt = function(text){
	var cipher = crypto.createCipheriv(crypto_algorithm, crypto_key, crypto_iv);
	return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

exports.decrypt = function(text){
	var decipher = crypto.createDecipheriv(crypto_algorithm, crypto_key, crypto_iv);
	return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
}

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

exports.urlUnzip = function(url, cb){
	var gunzip = require("zlib").createGunzip();    
	var buffer = [];
	request(url).pipe(gunzip);
	gunzip.on('data', function(data) {
		buffer.push(data.toString())
	}).on("end", function() {
		cb(buffer.join(''));
	}).on("error", function(e) {
		console.log(e);
		cb(false);
	});
}

//utilities.format('someone %action another person %method.', {method: 'on the head', action: 'hit'});
exports.format = function(string, args){
	if(!string) return false;
	var original_string = string;
	var sarr = [];
	for(var arg in args){
		var keyword = '%'+arg;
		var location = original_string.indexOf(keyword);
		if(location != -1){
			sarr.push([location, args[arg]]);
			var type = typeof args[arg];
			var sign = (type == 'string' ? '%s' : (type == 'number' ? '%d' : '%s'));
			string = string.replace(keyword, sign);
		}
	}
	sarr.sort(function(a,b){
		return a[0] - b[0];
	});
	var arr = [];
	for(var i=0; i<sarr.length; i++){
		arr.push(sarr[i][1]);
	}
	arr.unshift(string);
	return util.format.apply(this, arr);
}

exports.randomString = function(length){
	if(!length) length = 10;
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

exports.dateToString = function(timestamp, format){
	format = (format || 'readable');
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	var date = new Date(timestamp * 1000);
	
	var day = (String(date.getDate()).length == 1 ? '0'+date.getDate() : date.getDate());
	var month = months[date.getMonth()];
	var month_num = (String(date.getMonth() + 1).length == 1 ? '0'+(date.getMonth() + 1) : (date.getMonth() + 1));
	var year = date.getFullYear();
	var hour = date.getHours();
	var minutes = date.getMinutes();
	var seconds = date.getSeconds();
	
	switch(format){
		
		case 'readable':
			return day+' '+month+' '+year;
		break;
		
		case 'hour_mins_seconds':
			return hour+':'+minutes+':'+seconds;
		break;
		
		case 'DDMMYYYY':
		default:
			return day +''+ month_num +''+year;
		break;
	}
	
}

exports.secondsToString = function(seconds, depth) {
    function numberEnding (number) { //todo: replace with a wiser code
        return (number > 1) ? 's' : '';
    }
	
    var temp = seconds;
	var result = [];
	depth = depth || 2;
	
    var years = Math.floor(temp / 31536000);
    if (years) {
        result.push(years + ' year' + numberEnding(years));
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
        result.push(days + ' day' + numberEnding(days));
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
		result.push(hours + ' hour' + numberEnding(hours));
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
		result.push(minutes + ' minute' + numberEnding(minutes));
    }
    var seconds = temp % 60;
    if (seconds) {
        result.push(seconds + ' second' + numberEnding(seconds));
    }
    result = result.slice(0,depth);
    return result.length == 1 ? result[0] : result.slice(0,result.length-1).join(' ')+' and '+result[result.length-1];
}
/* OLD 
exports.secondsToString = function(seconds, depth) {
	console.log('seconds to string', seconds);
    function numberEnding (number) { //todo: replace with a wiser code
        return (number > 1) ? 's' : '';
    }
	
    var temp = seconds;
	var string = '';
	depth = (depth || 2);
	var current_depth = 0;
	
    var years = Math.floor(temp / 31536000);
    if (years) {
		current_depth++;
        string += years + ' year' + numberEnding(years);
		if(depth <= current_depth) return string;
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
		current_depth++;
		var last = (depth <= current_depth);
        string += (string?' ':'') + (last?'and ':'') + days + ' day' + numberEnding(days);
		if(depth <= current_depth) return string;
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
		current_depth++;
		var last = (depth <= current_depth);
        string += (string?' ':'') + (last?'and ':'') + hours + ' hour' + numberEnding(hours);
		if(depth <= current_depth) return string;
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
		current_depth++;
		var last = (depth <= current_depth);
        string += (string?' ':'') + (last?'and ':'') + minutes + ' minute' + numberEnding(minutes);
		if(depth <= current_depth) return string;
    }
    var seconds = temp % 60;
    if (seconds) {
        string += (string?' and ':'') + seconds + ' second' + numberEnding(seconds);
		return string;
    }
	if(string) return string;
    else return 'less then a second'; //'just now' //or other string you like;
}*/


// Base valiable types prototypes //

// Array //

exports.array_shuffle = function(o){
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

exports.array_random = function(array){
	return array[Math.floor(Math.random() * array.length)];
}

// Object //
exports.obj_clone = function(array){
    var oldState = history.state;
    history.replaceState(array);
    var clonedObj = history.state;
    history.replaceState(oldState);
    return clonedObj;

}

exports.obj_size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/*	obj_sort required format:
	 { 'key': 5, 'key2': 10}
	output:
	 [ ['key2', 10], ['key', 5] ]
*/
exports.obj_sort = function(obj){
	var sort_array = [];
	for(var k in obj){
		sort_array.push([k, obj[k]]);
	}
	sort_array.sort(function(a,b){
		return b[1] - a[1];
	});
	return sort_array;
}

exports.obj_deepExtend = function(destination, source) {
  for (var property in source) {
    if (source[property] && source[property].constructor &&
     source[property].constructor === Object) {
      destination[property] = destination[property] || {};
      exports.obj_deepExtend(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
  return destination;
};

// Number //
exports.number_random = function(min, max){
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.number_tofixed = function(num, length){
	var len = '1';
	for(var i=0; i<length; i++) len += '0';
	return parseFloat(Math.round(num * parseInt(len)) / parseInt(len)).toFixed(length);
}

// String //
exports.string_lowerUperFirst = function(str){
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

exports.string_random = function(length, possible){
	length = length || 10;
	possible = possible || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var text = '';

	for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// ------------ end --------------- // 


exports.parseUrl = function(url){
	var hostname = url.split('/').splice(2,1).join('/');
	var path = '/'+url.split('/').splice(3).join('/');
	var domain = url.split('/').splice(2,1)[0].split('.').splice(-2).join('.');
	//var domain = url.split('/')[0].split('.').slice(-2).join('.');
}


//arr1: new Array('&nbsp;', '&iexcl;', '&cent;', '&pound;', '&curren;', '&yen;', '&brvbar;', '&sect;', '&uml;', '&copy;', '&ordf;', '&laquo;', '&not;', '&shy;', '&reg;', '&macr;', '&deg;', '&plusmn;', '&sup2;', '&sup3;', '&acute;', '&micro;', '&para;', '&middot;', '&cedil;', '&sup1;', '&ordm;', '&raquo;', '&frac14;', '&frac12;', '&frac34;', '&iquest;', '&Agrave;', '&Aacute;', '&Acirc;', '&Atilde;', '&Auml;', '&Aring;', '&Aelig;', '&Ccedil;', '&Egrave;', '&Eacute;', '&Ecirc;', '&Euml;', '&Igrave;', '&Iacute;', '&Icirc;', '&Iuml;', '&ETH;', '&Ntilde;', '&Ograve;', '&Oacute;', '&Ocirc;', '&Otilde;', '&Ouml;', '&times;', '&Oslash;', '&Ugrave;', '&Uacute;', '&Ucirc;', '&Uuml;', '&Yacute;', '&THORN;', '&szlig;', '&agrave;', '&aacute;', '&acirc;', '&atilde;', '&auml;', '&aring;', '&aelig;', '&ccedil;', '&egrave;', '&eacute;', '&ecirc;', '&euml;', '&igrave;', '&iacute;', '&icirc;', '&iuml;', '&eth;', '&ntilde;', '&ograve;', '&oacute;', '&ocirc;', '&otilde;', '&ouml;', '&divide;', '&Oslash;', '&ugrave;', '&uacute;', '&ucirc;', '&uuml;', '&yacute;', '&thorn;', '&yuml;', '&quot;', '&amp;', '&lt;', '&gt;', '&oelig;', '&oelig;', '&scaron;', '&scaron;', '&yuml;', '&circ;', '&tilde;', '&ensp;', '&emsp;', '&thinsp;', '&zwnj;', '&zwj;', '&lrm;', '&rlm;', '&ndash;', '&mdash;', '&lsquo;', '&rsquo;', '&sbquo;', '&ldquo;', '&rdquo;', '&bdquo;', '&dagger;', '&dagger;', '&permil;', '&lsaquo;', '&rsaquo;', '&euro;', '&fnof;', '&alpha;', '&beta;', '&gamma;', '&delta;', '&epsilon;', '&zeta;', '&eta;', '&theta;', '&iota;', '&kappa;', '&lambda;', '&mu;', '&nu;', '&xi;', '&omicron;', '&pi;', '&rho;', '&sigma;', '&tau;', '&upsilon;', '&phi;', '&chi;', '&psi;', '&omega;', '&alpha;', '&beta;', '&gamma;', '&delta;', '&epsilon;', '&zeta;', '&eta;', '&theta;', '&iota;', '&kappa;', '&lambda;', '&mu;', '&nu;', '&xi;', '&omicron;', '&pi;', '&rho;', '&sigmaf;', '&sigma;', '&tau;', '&upsilon;', '&phi;', '&chi;', '&psi;', '&omega;', '&thetasym;', '&upsih;', '&piv;', '&bull;', '&hellip;', '&prime;', '&prime;', '&oline;', '&frasl;', '&weierp;', '&image;', '&real;', '&trade;', '&alefsym;', '&larr;', '&uarr;', '&rarr;', '&darr;', '&harr;', '&crarr;', '&larr;', '&uarr;', '&rarr;', '&darr;', '&harr;', '&forall;', '&part;', '&exist;', '&empty;', '&nabla;', '&isin;', '&notin;', '&ni;', '&prod;', '&sum;', '&minus;', '&lowast;', '&radic;', '&prop;', '&infin;', '&ang;', '&and;', '&or;', '&cap;', '&cup;', '&int;', '&there4;', '&sim;', '&cong;', '&asymp;', '&ne;', '&equiv;', '&le;', '&ge;', '&sub;', '&sup;', '&nsub;', '&sube;', '&supe;', '&oplus;', '&otimes;', '&perp;', '&sdot;', '&lceil;', '&rceil;', '&lfloor;', '&rfloor;', '&lang;', '&rang;', '&loz;', '&spades;', '&clubs;', '&hearts;', '&diams;'),
//arr2: new Array('&#160;', '&#161;', '&#162;', '&#163;', '&#164;', '&#165;', '&#166;', '&#167;', '&#168;', '&#169;', '&#170;', '&#171;', '&#172;', '&#173;', '&#174;', '&#175;', '&#176;', '&#177;', '&#178;', '&#179;', '&#180;', '&#181;', '&#182;', '&#183;', '&#184;', '&#185;', '&#186;', '&#187;', '&#188;', '&#189;', '&#190;', '&#191;', '&#192;', '&#193;', '&#194;', '&#195;', '&#196;', '&#197;', '&#198;', '&#199;', '&#200;', '&#201;', '&#202;', '&#203;', '&#204;', '&#205;', '&#206;', '&#207;', '&#208;', '&#209;', '&#210;', '&#211;', '&#212;', '&#213;', '&#214;', '&#215;', '&#216;', '&#217;', '&#218;', '&#219;', '&#220;', '&#221;', '&#222;', '&#223;', '&#224;', '&#225;', '&#226;', '&#227;', '&#228;', '&#229;', '&#230;', '&#231;', '&#232;', '&#233;', '&#234;', '&#235;', '&#236;', '&#237;', '&#238;', '&#239;', '&#240;', '&#241;', '&#242;', '&#243;', '&#244;', '&#245;', '&#246;', '&#247;', '&#248;', '&#249;', '&#250;', '&#251;', '&#252;', '&#253;', '&#254;', '&#255;', '&#34;', '&#38;', '&#60;', '&#62;', '&#338;', '&#339;', '&#352;', '&#353;', '&#376;', '&#710;', '&#732;', '&#8194;', '&#8195;', '&#8201;', '&#8204;', '&#8205;', '&#8206;', '&#8207;', '&#8211;', '&#8212;', '&#8216;', '&#8217;', '&#8218;', '&#8220;', '&#8221;', '&#8222;', '&#8224;', '&#8225;', '&#8240;', '&#8249;', '&#8250;', '&#8364;', '&#402;', '&#913;', '&#914;', '&#915;', '&#916;', '&#917;', '&#918;', '&#919;', '&#920;', '&#921;', '&#922;', '&#923;', '&#924;', '&#925;', '&#926;', '&#927;', '&#928;', '&#929;', '&#931;', '&#932;', '&#933;', '&#934;', '&#935;', '&#936;', '&#937;', '&#945;', '&#946;', '&#947;', '&#948;', '&#949;', '&#950;', '&#951;', '&#952;', '&#953;', '&#954;', '&#955;', '&#956;', '&#957;', '&#958;', '&#959;', '&#960;', '&#961;', '&#962;', '&#963;', '&#964;', '&#965;', '&#966;', '&#967;', '&#968;', '&#969;', '&#977;', '&#978;', '&#982;', '&#8226;', '&#8230;', '&#8242;', '&#8243;', '&#8254;', '&#8260;', '&#8472;', '&#8465;', '&#8476;', '&#8482;', '&#8501;', '&#8592;', '&#8593;', '&#8594;', '&#8595;', '&#8596;', '&#8629;', '&#8656;', '&#8657;', '&#8658;', '&#8659;', '&#8660;', '&#8704;', '&#8706;', '&#8707;', '&#8709;', '&#8711;', '&#8712;', '&#8713;', '&#8715;', '&#8719;', '&#8721;', '&#8722;', '&#8727;', '&#8730;', '&#8733;', '&#8734;', '&#8736;', '&#8743;', '&#8744;', '&#8745;', '&#8746;', '&#8747;', '&#8756;', '&#8764;', '&#8773;', '&#8776;', '&#8800;', '&#8801;', '&#8804;', '&#8805;', '&#8834;', '&#8835;', '&#8836;', '&#8838;', '&#8839;', '&#8853;', '&#8855;', '&#8869;', '&#8901;', '&#8968;', '&#8969;', '&#8970;', '&#8971;', '&#9001;', '&#9002;', '&#9674;', '&#9824;', '&#9827;', '&#9829;', '&#9830;'),

exports.chmsg_clean = function(string){
	var name = /<n(.*?)\/>/g.exec(string);
	name = name ? name[1] : false;
	var font = /<f(.*?)\/>/g.exec(string);
	font = font ? font[1] : false
	string = exports.html_decode(exports.html_remove(string));
	return {text: string, name: name, font: font};
}

exports.html_view = function(str) {
    return String(str)
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

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
	if(state == 'online' && time == 0){
		//ONLINE
		return {state: 'online', time: Math.round(new Date/1000)};
	}
	else if(state == 'online' && time > 0){
		//IDLE
		return {state: 'idle', time: Math.round(new Date/1000) - (time * 60)};
	}
	else if(state == 'offline'){
		//OFF
		return {state: 'offline', time: time};
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

exports.getAnonName = function(num, ts) {
	num = String(num).substr(4, 4);
	if(undefined !== ts){
		ts = String(ts).split(".")[0];
		ts = ts.substr(ts.length - 4);
	}else{
		ts = ts || 3452;
	}
	var id = "";
	for(var i = 0; i < num.length; i++){
		var part1 = Number(num.substr(i, 1));
		var part2 = Number(ts.substr(i, 1));
		var part3 = String(part1 + part2);
		id = id + part3.substr(part3.length - 1);
	}
	return "_anon" + id;
}


/*
 def aid(self, n, uid):
 '''Generate Anon ID number'''
 try:
 if (int(n) == 0) or (len(n) < 4): n = "3452"
 except ValueError: n = "3452"
 if n != "3452": n = str(int(n))[-4:]
 v1, v5 = 0, ""
 for i in range(0, len(n)): v5 += str(int(n[i:][:1])+int(str(uid)[4:][:4][i:][:1]))[len(str(int(n[i:][:1])+int(str(uid)[4:][:4][i:][:1]))) - 1:]
 return v5
*/


exports.choose_channel = function(channel) {
	return Math.floor(65536*Math.floor(Math.random()))+Math.floor(exports.number_random(0,255)+Math.floor(256*(channel !== 0 ? Math.pow(2,channel)/2 : 0)));
}

exports.find_channel = function(channel) {
	var channels = {
		0: {name: 'no color', numbers: [0,255]},
		1: {name: 'Vivid red', numbers: [256,511]},
		2: {name: 'Vivid orange', numbers: [512,767]},
		3: {name: 'Moderate lime green', numbers: [1024,1279]},
		4: {name: 'Bright blue', numbers: [2048,2303]},
		5: {name: 'Strong blue', numbers: [4096,4351]},
		6: {name: 'Dark moderate violet', numbers: [8192,8447]},
		7: {name: 'Vivid pink', numbers: [16384,16639]},
		8: {name: 'mods only', numbers: [32768,33023]}
	}
	for(var i = 0; i < Object.keys(channels).length; i++){
		if(channels[i].numbers[0] <= channel && channels[i].numbers[1] >= channel || channels[i].name == channel){
			return [i, channels[i].name];
		}
	}
}
