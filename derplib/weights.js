// Weights.js by the awesome Lumirayz

//
// Requires
//
var _      = require("underscore"),
	crypto = require("crypto");

//
// External Data
//
//var _chatangoTagserver = require("./weights_data.js")._chatangoTagserver;
var _chatangoTagserver = {"sw": {"sv10": 110, "sv12": 116, "w12": 75, "sv8": 101, "sv6": 104, "sv4": 110, "sv2": 95}, "ex": {"b55279b3166dd5d30767d68b50c333ab": 21, "0a249c2a3a3dcb7e40dcfac36bec194f": 21, "3ae9453fa1557dc71316701777c5ee42": 51, "ebcd66fd5b868f249c1952af02a91cb3": 5, "4913527f3dd834ec1bb3e1eb886b6d62": 56, "7a067398784395c6208091bc6c3f3aac": 22, "fe8d11abb9c391d5f2494d48bb89221b": 8, "2d14c18e510a550f0d13eac7685ba496": 8, "3e772eba0dfbf48d47b4c02d5a3beac9": 56, "ec580e6cbdc2977e09e01eb6a6c62218": 69, "082baeccd5eabe581cba35bd777b93ef": 56, "e21569f6966d79cfc1b911681182f71f": 34, "97e8202d603c6771ae8a648f9bb50e9d": 54, "0b18ed3fb935c9607cb01cc537ec854a": 10, "20e46ddc5e273713109edf7623d89e7a": 22, "72432e25656d6b7dab98148fbd411435": 70, "bb02562ba45ca77e62538e6c5db7c8ae": 10, "d78524504941b97ec555ef43c4fd9d3c": 21, "2db735f3815eec18b4326bed35337441": 56, "63ff05c1d26064b8fe609e40d6693126": 56, "246894b6a72e704e8e88afc67e8c7ea9": 20, "e0d3ff2ad4d2bedc7603159cb79501d7": 67, "2b2e3e5ff1550560502ddd282c025996": 27, "028a31683e35c51862adedc316f9d07b": 51, "726a56c70721704493191f8b93fe94a3": 21}, "sm": [["5", "w12"], ["6", "w12"], ["7", "w12"], ["8", "w12"], ["16", "w12"], ["17", "w12"], ["18", "w12"], ["9", "sv2"], ["11", "sv2"], ["12", "sv2"], ["13", "sv2"], ["14", "sv2"], ["15", "sv2"], ["19", "sv4"], ["23", "sv4"], ["24", "sv4"], ["25", "sv4"], ["26", "sv4"], ["28", "sv6"], ["29", "sv6"], ["30", "sv6"], ["31", "sv6"], ["32", "sv6"], ["33", "sv6"], ["35", "sv8"], ["36", "sv8"], ["37", "sv8"], ["38", "sv8"], ["39", "sv8"], ["40", "sv8"], ["41", "sv8"], ["42", "sv8"], ["43", "sv8"], ["44", "sv8"], ["45", "sv8"], ["46", "sv8"], ["47", "sv8"], ["48", "sv8"], ["49", "sv8"], ["50", "sv8"], ["52", "sv10"], ["53", "sv10"], ["55", "sv10"], ["57", "sv10"], ["58", "sv10"], ["59", "sv10"], ["60", "sv10"], ["61", "sv10"], ["62", "sv10"], ["63", "sv10"], ["64", "sv10"], ["65", "sv10"], ["66", "sv10"], ["68", "sv2"], ["71", "sv12"], ["72", "sv12"], ["73", "sv12"], ["74", "sv12"], ["75", "sv12"], ["76", "sv12"], ["77", "sv12"], ["78", "sv12"], ["79", "sv12"], ["80", "sv12"], ["81", "sv12"], ["82", "sv12"], ["83", "sv12"], ["84", "sv12"]]};

//
// Preprocess
//
var weights = _.map(_chatangoTagserver.sm, function(p) {
	return [p[0], _chatangoTagserver.sw[p[1]]];
});

//
// getServerId, getServerHost
//
function getServerId(room) {
	room = room.toLowerCase();
	var roomMd5 = crypto.createHash("md5").update(room).digest("hex");
	if(_chatangoTagserver.ex.hasOwnProperty(roomMd5)) {
		// If the room has a server directly assigned, return that one.
		return _chatangoTagserver.ex[roomMd5];
	}
	else {
		// If it doesn't, calculate the server using a weighted choice
		// algorithm which uses a few characters from the room name to
		// get a number from 0 to 1.
		var
			_room             = room.replace(/-_/g, "q"),
			firstNumberString = _room.substring(0, 5),
			lastNumberString  = _room.substring(6, 6 + Math.min(3, _room.length - 5)),
			firstNumber       = parseInt(firstNumberString, 36),
			lastNumber;
		if(lastNumberString.length > 0) {
			lastNumber = Math.max(1000, parseInt(lastNumberString, 36));
		}
		else {
			lastNumber = 1000;
		}
		// Use this number to do a weighted choice over all the
		// servers.
		var
			relDiff = (firstNumber % lastNumber) / lastNumber,
			maxDiff = _.reduce(weights, function(acc, next) {
				return acc + next[1];
			}, 0),
			accum   = 0;
		for(var i = 0; i < weights.length; i++) {
			var
				currentWeight = weights[i][1] / maxDiff,
				nextWeight    = accum + currentWeight;
			if(nextWeight >= relDiff) {
				// BOOYAH, got you.
				return weights[i][0];
			}
			accum = nextWeight;
		}
		// Should not happen.
		return null;
	}
}

function getServerHost(room) {
	return "s" + getServerId(room) + ".chatango.com";
}

//
// Exports
//
exports.getServerId = getServerId;
exports.getServerHost = getServerHost;