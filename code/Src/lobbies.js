/*
	lobbies.js
	Contains the class for a lobby
	exports { Lobby }
*/

/** Represents a 1-4 player lobby */
class Lobby {
	constructor() {
		//the game class
		this.game = null;
		//the list of player sockets
		this.players = [];
		//the map for player sockets to seat ids
		this.playerMap = {};
		//whom the dummy is played by
		this.dummyPlayedBy = -1;
		//the lobby's unique id
		this.id = Math.random().toString(36).slice(2, 7).toUpperCase();
		//whether the game is started
		this.started = false;
	}
}

export { Lobby };
