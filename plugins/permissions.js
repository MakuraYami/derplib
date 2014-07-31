"use strict";
// Require modules
var fs		= require('fs'),
	colors 	= require('colors'),
	_		= require('underscore');

var MM 		= module.parent,
	utils 	= MM.libary.load('utils'),
	db 		= MM.plugin.load('database');

/////////////////
// Permissions //

// Settings
var admins = ['barrykun', 'rawr']; // Users that bypass permission requirement
var roleObject = {
	access: 0,
	inherits: [], // Role names
	nodes: [] // {node: 'name', grant: true}
};

// Varables for permissions, stored in data
db.create('permissions.defaultRole', false);
db.create('permissions.nodes'); // Not used at the moment.
db.create('permissions.roles');
db.create('permissions.cmd');
var perms = db.get('permissions');

/* 
* // Permission Rules //
* A permission stands for an operation
* Permissions can either grant or deny access
* A role has permission objects
* Permissions are divided in (sub-)categories and one permission can grant or deny access to a whole category using [category].*
* A role can inherit permissions from different roles
* A user can be given a role which has set permissions
* A user can be given his own permissions
* A room can create its own roles (todo)
* A room can give roles and permissions to users (testing required)
*/

// Roles 

exports.addRole = function(name, role){
	perms.roles[name] = _.extend(JSON.parse(JSON.stringify(roleObject)), role);
}

exports.addUserRole = function(user, role){
	var _perms = db.get('users.'+user+'.perms');
	if(_perms && !~_.indexOf(_perms.roles, role)) _perms.roles.push(role);
}

exports.addRoomRole = function(room, name, role){
	room.perms.roles[name] = _.extend(JSON.parse(JSON.stringify(roleObject)), role);
}

exports.addRoomUserRole = function(room, user, role){
	db.create('rooms.'+room+'.perms.users.'+user, {roles: [], nodes: []});
	var _perms = db.get('rooms.'+room+'.perms.users.'+user);
	if(_perms && !~_.indexOf(_perms.roles, role)) _perms.roles.push(role);
}

exports.setDefaultRole = function(role){
	if(_.has(perms.roles, role)){
		perms.defaultRole = role;
	}
}

// Nodes

exports.addUserNode = function(user, node, grant){
	grant = grant === false ? grant : true;
	var _perms = db.get('users.'+user+'.perms');
	if(_perms) _perms.nodes.push({node: node, grant: grant});
}

//-e permissions.addRoomUserNode(req.room.name, req.user.name, 'cmd.test.run')
exports.addRoomUserNode = function(room, user, node, grant){
	grant = grant === false ? grant : true;
	db.create('rooms.'+room+'.perms.users.'+user, {roles: [], nodes: [], access: 0});
	var _perms = db.get('rooms.'+room+'.perms.users.'+user);
	if(_perms) _perms.nodes.push({node: node, grant: grant});
}

exports.getRoles = function(){
	return perms.roles;
}

exports.register = function(key, nodes){
	// Possible to store in premissions.nodes
}

// Load roles
if(fs.existsSync('./roles.js')){
	require('./roles.js');
}

exports.request = function(args){
	var req = args[0];
	
	// Data on a user is required
	if(!req.user.data) return;
	
	// Set user data
	if(!_.has(req.user.data, 'perms') && !_.has(perms.roles, perms.defaultRole)) return false;
	if(!_.has(req.user.data, 'perms')) req.user.data.perms = {roles: [perms.defaultRole], nodes: []};
	if(!_.has(req.user.data, 'access')) req.user.data.access = 0;
	// Set room data
	if(!_.has(req.room.data, 'perms')) req.room.data.perms = {users: {},roles:{}};
	
	req.perm = function(node){
		if(!this.user || !this.user.data.perms) return false;
		if(~_.indexOf(admins, req.user.name)) return true;
		if(node.split('.').length !== 3 && node.indexOf('*') === -1) return false; // Invalid node name
		
		var userPerms = this.user.data.perms.nodes;
		var userRoles = this.user.data.perms.roles;
		var accessLevels = [req.user.data.access];
		
		if(_.has(this.room.data.perms.users, this.user.name)){
			// Add room perms for this user
			var roomPerms = this.room.data.perms.users[this.user.name].nodes;
			var roomRoles = this.room.data.perms.users[this.user.name].roles;
			userPerms = userPerms.concat(roomPerms);
			userRoles = userRoles.concat(roomRoles);
			accessLevels.push(this.room.data.perms.users[this.user.name].access);
		}
		// TODO: Make role inherits work on room roles
		userRoles = _getRoleInherits(userRoles);
		
		// Get the nodes from nodename
		var roleNodes = _.reduce(userRoles, function(list, role){
			if(!_.has(perms.roles, role)) return list;
			role = perms.roles[role];
			accessLevels.push(role.access);
			list.push.apply(list, role.nodes);
			return list;
		},[]);
		
		// Add user nodes and role nodes together
		roleNodes = _.flatten([userPerms, roleNodes]);
		
		// Create a lists for granting or not
		roleNodes = _.reduce(roleNodes, function(existing,x){
			var grant = undefined === x.grant ? true : x.grant;
			if(!~_.indexOf(existing.allowed, x.node) && grant === true)
				existing.allowed.push(x.node);
			else if(!~_.indexOf(existing.denied, x.node) && grant === false)
				existing.denied.push(x.node);
			return existing;
		},{allowed:[],denied:[]});
		
		var allowedNodes = _.uniq(roleNodes.allowed);
		var deniedNodes = _.uniq(roleNodes.denied);
		
		var allowed = _.reduce(allowedNodes, function(allowed, perm){
			return allowed || matchNode(node, perm);
		}, false);
		
		var denied = _.reduce(deniedNodes, function(allowed, perm){
			return allowed || matchNode(node, perm);
		}, false);
		
		return ( (allowed === true || Math.max.apply(null,accessLevels) >= req.command.access ) && denied === false);
	}
}

function matchNode(first, second){
	if(first == second) return true;
    
	var firstList = first.split('.');
	var secondList = second.split('.');
	
    //First
    if(firstList[0] == '*' || secondList[0] == '*') return true;
    // Second
    if( firstList.length > 1 && secondList.length > 1 && 
       firstList[0]+firstList[1] == secondList[0]+'*' || 
       firstList[0]+'*' == secondList[0]+secondList[1]) return true;
    // Third
    if( firstList.length > 2 && secondList.length > 2 && 
        firstList[0]+firstList[1]+firstList[2] == secondList[0]+secondList[1]+'*' ||        
        firstList[0]+firstList[1]+'*' == secondList[0]+secondList[1]+secondList[2]) return true;
    return false;
}

var _getRoleInherits = function(roles){
	_.each(roles, function(role){
		if(!perms.roles.hasOwnProperty(role)) return;
		role = perms.roles[role];
		if(role.inherits)
			roles.push.apply(roles,_getRoleInherits(role.inherits));
	});
	return roles;
}
