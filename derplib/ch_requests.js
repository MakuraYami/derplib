"use strict";
// Base requires //
var util 		= require('util'),
	http 		= require('http'),
	querystring = require('querystring'),
	fs 			= require('fs'),
	url     	= require('url'),
	parseXMLString = require('xml2js').parseString,
	request = require('request');

var MM = module.parent,
	utils 	= MM.libary.load('utils');

/*

Check if account exists
http://chatango.com/checkname?name=barrykun
Get full profile code
http://barrykun.chatango.com/getfullprofile
Get profile info 
http://st.chatango.com/profileimg/b/a/barrykun/mod1.xml
Get full profile info 
http://st.chatango.com/profileimg/b/a/barrykun/mod2.xml
Background
http://ust.chatango.com/profileimg/b/a/barrykun/msgbg.xml
Full prof css
http://ust.chatango.com/profileimg/b/a/barrykun/custom_profile.css
Check account status
http://chatango.com/namecheckeraccsales?name=barrykun
Check premium status
http://chatango.com/isprem?sid=barrykun
Image thumbnail
http://ust.chatango.com/profileimg/b/a/barrykun/thumb.jpg
Full Image
http://fp.chatango.com/profileimg/b/a/barrykun/full.jpg
Group css (404 if not a group)
http://st.chatango.com/groupinfo/b/0/b0ty/gprofile.xml

*/

exports.profile = function(name, callback){

	var urlpart = name.length == 1 ? (name.substr(0,1)+'/'+name.substr(0,1)+'/'+name) :  (name.substr(0,1)+'/'+name.substr(1,1)+'/'+name);
	
	request('http://st.chatango.com/profileimg/'+urlpart+'/mod1.xml', function (error, response, body) {
		
		if(error || !body){
			callback(false);
			return;
		}
		
		parseXMLString(body, function(err, result){
		
			if(err){
				exports.checkName(name, function(exists){
					if(exists === 1)
						callback("no_profile");
					else
						callback("does_not_exist");
				});
				return;
			}
			
			var user = {
				mini: result.mod.body ? result.mod.body[0] : false,
				age: result.mod.b ? result.mod.b[0] : false,
				bg: result.mod.d ? result.mod.d[0] : false,
				loc: result.mod.l ? result.mod.l[0] : false,
				gender: result.mod.s ? result.mod.s[0] : false,
			};
			if(user.age){
				var year = parseInt(user.age.substr(0,4));
				var month = parseInt(user.age.substr(5,2))-1;
				var day = parseInt(user.age.substr(8,2));
				user.age = Math.round( ( (+new Date/1000) - (+new Date(year, month, day)/1000) ) / ( 60 * 60 * 24 * 365 ) );
			}
			if(user.mini){
				user.mini = decodeURIComponent(user.mini);
			}
			if(user.bg){
				var prem = Math.round( (parseInt(user.bg) - +new Date/1000) / (60 * 60 * 24) );
				user.bg = prem;
			}else{
				user.bg = 0;
			}
			if(user.loc._){
				user.loc = user.loc._;
			}
			
			callback(user);
		});
	});
}

exports.fullProfile = function(name, callback){

	var urlpart = name.length == 1 ? (name.substr(0,1)+'/'+name.substr(0,1)+'/'+name) :  (name.substr(0,1)+'/'+name.substr(1,1)+'/'+name);
	
	request('http://st.chatango.com/profileimg/'+urlpart+'/mod2.xml', function (error, response, body) {
		
		if(error || !body){
			callback(false);
			return;
		}
		
		parseXMLString(body, function(err, result){
		
			if(err){
				exports.checkName(name, function(exists){
					if(exists === 1)
						callback("no_profile");
					else
						callback("does_not_exist");
				});
				return;
			}
			
			if(result.mod.body){
				callback(decodeURIComponent(result.mod.body[0]));
			}
			else{
				callback(false);
			}
		});
	});
	
}


exports.checkName = function(name, callback){
	
	request('http://chatango.com/checkname?name='+name, function (error, response, body) {
		
		if(error || !body){
			callback(false);
			return;
		}
		
		var result = /^answer=(\d)&name=(.*?)$/.exec(body);
		
		if(result)
			callback(parseInt(result[1]));
		else
			callback(false);
	});
	
}

