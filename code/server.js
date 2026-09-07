/*
	server.js
	Main server script - sets up server and controls application protocol
*/

// Imports

//Server Imports && Libraries
import express from "express";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

//Multi-Script Imports
import { Game } from "./Src/game.js";
import { Lobby } from "./Src/lobbies.js";
import { HeuristicPlayer, RealPlayer } from "./Src/player.js";

//Server Setup

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

//serve static ( client ) files
app.use(express.static(path.join(__dirname, "Public")));

//Global State

//Stores all active lobbies on the server
//Each lobby has a unique id and a game instance once started - look at Src/lobbies.js
const games = {}; // { id:Lobby-instance }

//Helper Functions

//Finds a lobby that the player (id) belongs to
const findLobbyById = (id) => Object.values(games).find((l) => l.players.includes(id)) || null;
//Parse command and arguments: e.g. `join(1234) -> cmd=`join`, args=[`1234`]
const splitActionStr = (plr, actionStr) => {
	const [cmd, argStr = ``] = actionStr.split(`(`);
	return {
		cmd,
		args: argStr
			.replace(`)`, ``)
			.split(`,`)
			.map((a) => a.trim())
			.filter(Boolean),
	};
};

//Socket Logic
io.on("connection", (socket) => {
	console.log(`${socket.id} connected`);

	socket.on("game:input", (actionStr) => {
		if (!actionStr) return;

		//Calculates what room this socket is supposed to be in
		let lobby = findLobbyById(socket.id);
		let newLobby = null;
		let targetLobby = newLobby;
		let success = false;
		let result;

		const { cmd, args } = splitActionStr(lobby?.playerMap?.[socket.id] ?? socket.id, actionStr);
		switch (cmd) {
			case `create`:
				newLobby = system.createLobby();
			//Fall through -> join
			case `join`:
				targetLobby = newLobby || games[args?.[0]?.toUpperCase?.()];
				lobby = system.joinLobby(socket, targetLobby, lobby, newLobby?.id || args?.[0]);
				if (!lobby) return;

				output.emit(socket, lobby, `data`, { lobbyId: lobby.id });
				output.broadcast(lobby, `system`, { msg: `${socket.id}: joined` });
				output.broadcast(lobby, `data`, { members: lobby.players });
				break;

			case `leave`:
				system.disconnectSocket(socket);
				output.emit(socket, null, `data`, { lobbyId: null });
				break;

			case `next`:
				result = lobby.game?.nextDeal();
				if (result?.success) {
					output.broadcast(lobby, `system`, result);
					output.start(lobby);
					action.robotLoop(lobby);
				} else output.error(socket, lobby, result?.msg || `Invalid next deal`);
				break;

			case `start`:
				system.startGame(lobby, socket);
				//Output empty scoresheet
				if (lobby?.game?.score) output.broadcast(lobby, `data`, { score: lobby.game.score });
			//Fall through to handle robot player actions
			default: //A player action affecting game
				success = action.play(socket, lobby, cmd, args);
				if (success === true) action.robotLoop(lobby);
		}
	});

	socket.on("disconnect", () => {
		console.log(`${socket.id} disconnected`);
		system.disconnectSocket(socket);
	});
});

//System Functions
const system = {
	/**
	 * Creates a new lobby and add it to the global list
	 *
	 * @returns { Lobby} Reference to the lobby created
	 */
	createLobby: () => {
		//Create Lobby
		const lobby = new Lobby(); //Creates Lobby
		games[lobby.id] = lobby; //Pushes to lobby list

		console.log(`Lobby ${lobby.id}: created`);

		return lobby;
	},

	/**
	 * Joins a lobby if it exists
	 *
	 * @param { Socket} socket The player's socket
	 * @param { Lobby} lobby The Player's chosen lobby id
	 * @returns { Lobby | null} The lobby if there is no error
	 */
	joinLobby: (socket, lobby, oldLobby, id) => {
		if (!lobby) return output.error(socket, lobby, `Lobby ${id} doesn't exist`); //No lobby found
		if (lobby.game) return output.error(socket, lobby, `You can not join an already started game`); //Lobby has started
		if (lobby.players.length > 3) return output.error(socket, lobby, `Lobby ${id} is already full`); //Lobby is full

		//Disconnect player from any prior lobby
		if (oldLobby) system.disconnectSocket(socket); //Disconnect from old lobby

		//Make join code case insensitive
		id = id.toUpperCase();

		//Adds player to lobby
		games[id].players.push(socket.id);
		socket.join(id); //Handles SocketIO's rooms

		console.log(`Lobby ${id}: ${socket.id} joined`);
		return games[id];
	},

	/**
	 * Deletes lobby if it exists and is empty
	 *
	 * @param { Lobby } lobby The lobby to delete
	 * @returns { true|null }
	 */
	deleteLobby: (lobby) => {
		if (lobby.players.length > 0) return false; //Lobby not empty

		//Delete lobby
		delete games[lobby.id];
		console.log(`Lobby ${lobby.id}: deleted`);

		return true;
	},

	/**
	 * Disconnects the socket from their lobby if there is one and deletes it if empty
	 *
	 * @param {Socket} socket The Player's socket connection
	 */
	disconnectSocket: (socket) => {
		const lobby = findLobbyById(socket.id);
		if (!lobby) return;

		//Remove Player
		lobby.players = lobby.players.filter((p) => p != socket.id);
		const seatId = lobby.playerMap[socket.id];
		delete lobby.playerMap[socket.id];

		//Delete empty lobby
		if (system.deleteLobby(lobby)) return;

		output.broadcast(lobby, `system`, { msg: `${socket.id}: left` });
		output.broadcast(lobby, `data`, { members: lobby.players });
		console.log(`Lobby ${lobby.id}: ${socket.id} left`);

		//Replace with bot if mid game
		if (lobby.game && lobby.game.dummy && seatId == lobby.game.dummy) return;
		else if (lobby.game && seatId != undefined) {
			const oldHand = lobby.game.players[seatId].hand;
			const bot = new HeuristicPlayer(seatId, 2, Math.random(), Math.random(), Math.random());
			bot.hand = [...oldHand];

			lobby.game.players[seatId] = bot;
			lobby.game.playable = lobby.game.playable.filter((p) => p !== seatId);

			output.broadcast(lobby, `system`, { msg: `Seat ${seatId + 1} replaced by new bot` });
			action.robotLoop(lobby);
		}
	},

	/**
	 * Starts a lobby if it exists and isn't already started
	 *
	 * @param {Lobby} lobby The lobby to start
	 * @returns {Game | null} Returns the game created if a game can be started
	 */
	startGame: (lobby, socket) => {
		if (!lobby) return output.error(socket, lobby, `You need to be in a lobby`); //Requires a lobby to start a game
		if (lobby.started) return output.error(socket, lobby, `Game already started`); //Game is already started

		//Setup lobby's player map
		lobby.players.forEach((socketId, idx) => (lobby.playerMap[socketId] = idx));
		output.broadcast(lobby, `data`, { playerMap: lobby.playerMap });

		//Start game
		lobby.started = true;
		lobby.game = new Game(lobby.playerMap); //Makes a new game instance

		console.log(`Lobby ${lobby.id}: started`);
		output.broadcast(lobby, `system`, { msg: `Game started`, clear: true });

		//Setup player names and avatars
		lobby.game.newPlayerAvatars();
		output.broadcast(lobby, `data`, { playerAvatars: lobby.game.playerAvatars });

		output.start(lobby);

		return lobby.game;
	},
};

//Action Functions
const action = {
	/**
	 * Gets the action for 0-3 robots' turns and plays them
	 *
	 * @param {Lobby} lobby The robot's lobby
	 */
	robotLoop: async (lobby) => {
		//Repeats for each of the players
		// while(!lobby.game.playable.includes(lobby.game.currentPlayer)) {
		while (!(lobby.game.players[lobby.game.currentPlayer] instanceof RealPlayer)) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			const move = lobby.game.robotAction(); //Get robot's action
			if (!move) break; //No move returned

			const { cmd, args } = splitActionStr(`Robot`, move);
			action.play(null, lobby, cmd, args);
		}
	},

	/**
	 * Plays the player's turn if possible then plays as many robot turns as it can
	 *
	 * @param {Socket | null} socket The player's socket
	 * @param {Lobby} lobby The player's lobby
	 * @param {string} cmd The command the player wants to play
	 * @param {string[]} args The arguments parsed into the command such as suit,pip
	 * @returns { boolean | null} Whether the action was a success or not
	 */
	play: (socket, lobby, cmd, args) => {
		//Validation
		if (cmd == `start`) return true; //Player isn't doing an action when they start
		if (!lobby) return output.error(socket, lobby, `You need to be in a lobby`); //Player needs to be in a lobby
		if (!lobby.started) return output.error(socket, lobby, `You need to start game`); //Player needs to start game

		const playerId = socket ? lobby.playerMap[socket.id] : null;

		if (socket && lobby.game.state == 2 && playerId === lobby.game.dummy) return output.emit(socket, lobby, `error`, null, `Dummy cannot play during this phase`); //Dummy cannot play during this phase
		if (socket && playerId !== lobby.game.currentPlayer && playerId !== lobby.dummyPlayedBy) return output.error(socket, lobby, `Not your turn`); //Not this socket's turn

		//Stores some stuff about the game before the turn
		const prevState = lobby.game.state;
		const prevPlayer = lobby.game.currentPlayer;

		//Process Player Action
		const response = lobby.game.processActionFromNetwork(cmd, args);

		if (response.game) lobby.game = response.game;

		//Send scores
		output.broadcast(lobby, `data`, { score: lobby.game.score, tricksWon: lobby.game.tricksWon });

		//handle phase transition
		const biddingEnded = prevState == 1 && lobby.game.state == 2;
		if (biddingEnded) {
			//Reveal Dummy hand
			output.broadcast(lobby, `data`, {
				dummyPlr: lobby.game.dummy,
				dummyHand: lobby.game.players[lobby.game.dummy].hand,
				currentDeal: lobby.game.currentDeal,
			});
			//Send each player their updated hand
			Object.entries(lobby.playerMap)
				.map(([socketId, playerId]) => [io.sockets.sockets.get(socketId), playerId])
				.filter(([socket]) => socket)
				.forEach(([socket, playerId]) => output.emit(socket, lobby, `data`, { currentHand: lobby.game.players[playerId].hand }));

			//Set dummy handler
			lobby.dummyPlayedBy = (lobby.game.dummy + 2) % 4;
			const humanDummy = lobby.game.playable.includes(lobby.dummyPlayedBy);
			if (humanDummy) {
				//Dummy played by human
				lobby.game.playable.push(lobby.game.dummy);
			}
		}
		const trickTakingEnded = prevState == 2 && lobby.game.state == 3;
		if (trickTakingEnded) {
			output.broadcast(lobby, `data`, {
				handLengths: [0, 0, 0, 0],
				currentTrick: [],
				dummyPlr: null,
			});
		}

		//Output Updates
		if (lobby.game.state == 2) {
			output.broadcast(lobby, `data`, {
				declarer: lobby.game.declarer,
				currentTrick: lobby.game.currentTrick,
				handOwner: prevPlayer,
				cardCount: lobby.game.players[prevPlayer].hand.length,
			});
		}

		//Handle Invalid Action
		if (!response.success) {
			if (socket)
				output.error(socket, lobby, response.msg); //emit error
			else console.error(`error robot move unacceptable: ${response.msg}`); //Error robot messed up
			return false;
		}

		//Broadcast Action Summary
		output.broadcast(lobby, `action`, { bid: response?.bid ?? null, scoreTxt: response?.scoreTxt ?? ``, msg: response.msg, clear: response.clear }); //emit message

		//Output Dummy's hand if it changed
		if (prevPlayer == lobby.game.dummy) output.broadcast(lobby, `data`, { dummyHand: lobby.game.players[lobby.game.dummy].hand });

		//Output Player's hand
		if (socket && lobby.playerMap[socket.id] == prevPlayer) {
			output.emit(socket, lobby, `data`, { currentHand: lobby.game.players[prevPlayer].hand });
		}

		return true;
	},
};

//Server (Socket) output Functions
const output = {
	/**
	 * Broadcasts a message to an entire lobby
	 *
	 * @param {Lobby} lobby The lobby to broadcast to
	 * @param {string} type The type of message to broadcast
	 * @param {JSON} payload The contents to broadcast to the lobby
	 */
	broadcast: (lobby, type, payload) => {
		io.to(lobby.id).emit(`game:update`, {
			type,
			phase: lobby.game?.state ?? -1,
			currentPlayer: lobby.game?.currentPlayer ?? 0,
			payload,
		});
	},

	/**
	 * Sends a secret message to just ths socket containing secret information or an error
	 *
	 * @param {Socket} socket The player's socket connection to emit to
	 * @param {string} type The type of emittion such as error or hand
	 * @param {JSON} [payload={}] The content to be sent. Default is `{}`
	 * @param {string} [errorMsg=``] The error - if there is one. Default is ````
	 */
	emit: (socket, lobby, type, payload = {}, errorMsg = ``) => {
		socket.emit(`game:update`, { type, payload, errorMsg, currentPlayer: lobby?.game?.currentPlayer ?? 0 });
	},

	error: (socket, lobby, msg) => output.emit(socket, lobby, `error`, null, msg),

	start: (lobby) => {
		lobby.game.playable = [...Array(Object.keys(lobby.playerMap).length).keys()];

		let payload = {
			phase: 1,
			handLengths: [13, 13, 13, 13],
			currentTrick: [],
			bid: [null, null, null, null],
			dummyPlr: null,
		};
		//Send each player their data
		for (const [socketId, playerId] of Object.entries(lobby.playerMap)) {
			const playerHand = lobby.game.players[playerId].hand;
			const playerSocket = io.sockets.sockets.get(socketId);
			if (!playerSocket) continue;
			payload.colour = lobby.game.colour[playerId % 2];
			console.log(lobby.game.colour, playerId, payload.colour);
			payload.currentHand = playerHand;
			output.emit(playerSocket, lobby, `data`, payload);
		}
	},
};

//Start Server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`);
});

//Run using npm start or node server.js
//Run on wan by then running npx ngrok http 3000
