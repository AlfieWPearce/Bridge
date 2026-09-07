/*
	client.js
	The main client-side script handles inputs, data storage and the communication between scripts
*/

//Global Variables
//Card Display variables
const STATE = Object.freeze({ MENU: 0, LOBBY_CREATE: 1, GAME: 2 });
const SUITS = ["♠️", "♥️", "♦️", "♣️", "NT"];
const DOUBLES = ["", "x", "xx"];

//Info for the game
const app = {
	//This socket id
	socket: io(),
	//The data from the server
	data: resetData(),
	//List of buttons
	buttons: [],
	//The current state of the client
	state: STATE.MENU,
};
//Constants to handle the display of the client
const display = {
	centreDist: [0, 0], //Distance from centre to hands
	cardScalePlayer: 3.5, //Scale of the player's card
	cardScaleOpponent: 2, //Scale of opponent's card
	cardScaleBid: 3, //Scale of the bidding card buttons
	cardSize: [32, 48], //Pixel size of the cards
	cardSizeBid: [8, 15], //Pixel size of the bid buttons
	screen: { cx: 0, cy: 0, size: { w: 0, h: 0 } }, //Size and positions of the screen
	myColour: [0, 0, 0], //Colour of this client's pair
	oppColour: [0, 0, 0], // Colour of this client's opponent's pair
	scoreSheetSize: [150, 350], //Width and height of the scoresheet
	scoreSheetSizeModifier: 0.75, //Size modifer of the scoresheet - when in trick
};
//List of clickable cards - so can iterate through them and check for inputs
let clickableCards = [];
//GFX && SFX
//Tile atlas - loaded in preload
let spriteSheet;
//Music & sounds variables
let music; //Background music
let cardSound; //Card swipe sound
let buttonSound; //UI click sound
let looping = false; //Whether the background music is looping

//Sets-up stored data - takes in id for when it needs to reset say 4 pass bids
function resetData(id = null) {
	return {
		currentDeal: null, //The deal
		currentHand: null, //The client's hand
		currentTrick: [], //The cards played this trick
		tricksWon: [0, 0], //The amount of tricks won by both pairs
		handLengths: [13, 13, 13, 13], //The length of each player's hand
		bid: [null, null, null, null], //The past bids of this round
		declarer: null, //Idx of the declarer
		dummyHand: null, //The dummy's hand
		dummyPlr: null, //Idx of the dummy
		iAmDummy: false, //Whether this player is a dummy
		me: null, //This client's seat idx - not the same as id
		playable: [], //All seats this client can play - theirs and dummy's
		id, //This players id
		lobbyId: null, //The lobby id the client is in
		playerMap: null, //The player map from the server - socket:seat
		playerAvatars: new Array(4).fill({ name: ``, avatar: -1 }), //The players names and avatars
		members: [], //The members in this lobby (list of socket ids)
		phase: -1, //The phase of the game -- auction, trick, score
	};
}

//Suit functions
const suit = {
	//It is necessary to convert from server to client and vice versa because I was stupid in -
	// the ordering of the suits in the server and these didn't match well with what would be in the client.
	//This code translates between the two
	server: [`♠️`, `♥️`, `♦️`, `♣️`, `NT`], //Server list
	client: [`♠️`, `♣️`, `NT`, `♦️`, `♥️`], //Client list
	//Server to ckient index
	toClientSide: (serverIdx) => {
		const serverSuit = suit.server[serverIdx]; //Gets what the server is showing
		return suit.client.indexOf(serverSuit); //Returns index of this for the client's list
	},
	//Client to server index
	toServerSide: (clientIdx) => {
		const clientSuit = suit.client[clientIdx]; //Gets what the client is showing
		return suit.server.indexOf(clientSuit); //Returns index of this for the server's list
	},
};

//Audio Playback
//Plays the UI click sound
const playButtonSound = () => {
	buttonSound.play(0, 1, 1, 0.65);
};
//Plays the card swipe sound
const playCardSwipeSound = () => {
	cardSound.play(0, 1, 1, 0);
};

//Input Handling
//Sends input to the server
const handleInput = (input) => input && app.socket.emit("game:input", input);
//Returns whether the client is hovering over the card - handles rotated rectangles
const isHovering = (mouse, rect) => {
	//Translate mouse to card-centered coords
	const delta = { x: mouse.x - rect.x, y: mouse.y - rect.y };
	//Calculates the trig for the mouse's rotations
	angle = -rect.angle || 0;
	const trigA = { cos: cos(angle), sin: sin(angle) };
	//Calculates the new position of the card
	const local = {
		x: delta.x * trigA.cos - delta.y * trigA.sin, //Rotated x-position
		y: delta.x * trigA.sin - delta.y * trigA.cos, //Rotated y-position
	};
	//Returns if this rotate position is within the rectangles bounds
	return local.x > -rect.w / 2 && local.x < rect.w / 2 && local.y > -rect.h / 2 && local.y < rect.h / 2;
};

//Socket Event Router
app.socket.on("connect", () => {
	//Sets player's stored id to their socket id
	app.data.id = app.socket.id;
	//Logs it to the console
	console.log(`Connected with id: ${app.data.id}`);
});
//Occurs when the server sends a message to the client
app.socket.on("game:update", (message) => {
	//Logs it to the console for debugging
	console.log(`Server message:\n${JSON.stringify(message)}`);
	//Reports a change of game phase
	if (message.phase && message.phase != app.data.phase) {
		app.data.phase = message.phase;
		//Lays out this game
		layoutUI(width, height);
	}

	//The function to run based on the type of message
	const handler = eventHandlers[message.type];
	//Sets the current player if it is specified from the server
	if (message.currentPlayer !== undefined) app.data.currentPlayer = message.currentPlayer;
	//Runds said handler if it exists otherwise just warns the console (some old messages still exist)
	handler ? handler(message.payload || message.errorMsg) : console.warn(`No handler for type: ${message.type}`);
});

//Socket Event Handling
const eventHandlers = {
	//System - something has happened like player joined or other player has left
	// - just needs to be shown to player using the toast animation
	system: ({ msg }) => showSystemMessage(msg) || console.warn(`System notifications not handled!`),
	//Actions - something like a player playing a bid or trick
	action: (payload) => handleAction(payload),
	//Data - there is some data that the player has to update - like their hand
	data: (payload) => handleData(payload),
	//Error - if something goes wrong then show the error msg uwing a toast animation
	error: (msg) => anims.showToast(msg),
};
//Handle system notifications
function showSystemMessage(msg) {
	//If on the lobby creation screen then show the message through a toast
	if (app.state == STATE.LOBBY_CREATE) return anims.showToast(msg, `info`);
	//Otherwise return true - if return false then warns the console eg toast failed
	return true;
}
//Handle data notifications
function handleData(payload) {
	//Lobby State
	if (app.state == STATE.MENU) app.data.lobbyId = ``; //Sets lobby id to nothing if the client is now on the menu
	if (payload.lobbyId && app.state == STATE.MENU) {
		//If on menu then reset the data and join new lobby
		//Gets reset data and set current app.data to it
		Object.assign(app.data, resetData(app.data.id));
		console.log(`Joined lobby ${payload.lobbyId}`);
		//Sets the state to the lobby-creation
		setState(STATE.LOBBY_CREATE);
	} else if (payload.lobbyId === null)
		//Leaving lobby
		//Sets the state to the menu screen
		setState(STATE.MENU);

	//Set hand lengths
	if (payload.cardCount !== undefined) app.data.handLengths[payload.handOwner] = payload.cardCount;

	//Set pair colours
	if (payload.colour === 0 || payload.colour === 1) {
		//If the client is red or black then run
		const red = [130, 41, 41];
		display.myColour = payload.colour == 0 ? 0 : red; //If player colour is 0 then set player's colour to black otherwise set to red
		display.oppColour = payload.colour == 1 ? 0 : red; //If player colour is 1 then set the opp's colour to black otherwise set to red
	}

	//Set all data - including stuff set especially before and afterwards
	Object.entries(payload).forEach(([key, val]) => {
		if (val) app.data[key] = val;
	});

	//Player Mapping
	if (payload.playerMap) {
		//Sets the player's seat id
		app.data.me = app.data.playerMap[app.data.id];
		//Sets the player's playable seats - them and dummy?
		app.data.playable.push(app.data.me);
		//Sets state to the game
		setState(STATE.GAME);
	}

	//Dummy Logic
	if (payload.dummyPlr && payload.dummyPlr != null) {
		//Dummy is 2 seats away (opposite player)
		if (app.data.dummyPlr === (app.data.playerMap[app.data.id] + 2) % 4 && !app.data.playable.includes(app.data.dummyPlr)) app.data.playable.push(app.data.dummyPlr);
		//Client is the dummy
		else if (app.data.dummyPlr === app.data.me) app.data.iAmDummy = true;
	}

	//Current deal
	if (payload.currentDeal) {
		//Sets current deal
		app.data.currentDeal = {
			num: payload.currentDeal.num,
			trump: suit.toClientSide(payload.currentDeal.trump), //Translates the current trump suit to client-side
			doubled: payload.currentDeal.doubled,
		};
	}
}
//Helper function to set state
function setState(newState) {
	//Changes state
	app.state = newState;
	//Setups buttons and layout of the new state
	layoutUI(width, height);
}
//Handle action notifications
function handleAction(payload) {
	//Auction
	if (app.data.phase == 1) {
		//Sets bid
		let plr = (app.data.currentPlayer + 3) % 4; //Finds what player it is
		//If there is a bid that isn't pass or dbl then set current deal to that
		if (typeof payload.bid == `object`) {
			app.data.currentDeal = payload.bid;
		}
		//Set this bid to that message
		app.data.bid[plr] = payload.bid;
	}
}

//UI & Rendering Logic
//UI Functions

//Handles Animations
const anims = {
	//Stores all current toasts
	toasts: [],
	//Colours of the two toast types:
	colours: {
		info: [80, 80, 255],
		error: [255, 100, 100],
	},
	//Creates the toast objects
	showToast: (msg, type = `error`) => {
		//Adds this new toast to the toast array
		anims.toasts.push({
			msg,
			type,
			colour: anims.colours[type] || anims.colours.error,
			time: millis(),
			scale: 0.7,
			yOffset: 40,
			alpha: 0,
		});
		return true;
	},
	//Displays the toast objects
	drawToasts: () => {
		//Calculates current time - animations are based on this
		const now = millis();
		//Sets position to start at this
		const baseY = height - 80;
		//Durations
		const appearTime = 300; //Zoom in over 0.3s
		const stayTime = 1800; //Stay visible for ~2s
		const fadeTime = 500; //fade out
		//Total duration
		const totalLife = appearTime + stayTime + fadeTime;

		//Loops through all toasts
		for (let idx = anims.toasts.length - 1; idx >= 0; idx--) {
			//Gets this toast
			const toast = anims.toasts[idx];
			//Calculates the age of the toast
			const age = now - toast.time;

			//Deletion
			if (age >= totalLife) {
				//Removes from the toasts array and ignore
				anims.toasts.splice(idx, 1);
				continue;
			}

			//Map age to progress stages 0-1
			let appearT = constrain(age / appearTime, 0, 1);
			let fadeT = constrain((age - appearTime - stayTime) / fadeTime, 0, 1);

			//Smooth transitions of size
			toast.scale = age < appearTime ? lerp(0.7, 1, anims.easeOutBack(appearT)) : age < appearTime + stayTime ? 1 : lerp(1, 0.9, anims.easeInOut(fadeT));
			//Transparency
			toast.alpha = age < appearTime ? lerp(0, 255, appearT) : age < appearTime + stayTime ? 255 : lerp(255, 0, fadeT);
			//And y position
			toast.yOffset = age < appearTime ? lerp(40, 0, appearT) : age < appearTime + stayTime ? 0 : lerp(0, 20, fadeT);

			//Draw
			push();
			translate(width / 2, baseY - idx * 70 + toast.yOffset);
			scale(toast.scale);
			noStroke();

			//Sets colour to this toast's type's colour
			const [r, g, b] = toast.colour;
			fill(r, g, b, toast.alpha * 0.9);

			textSize(20);

			//Gets width + padding
			const w = textWidth(toast.msg) + 30;
			//Draws background
			rect(0, 0, w, 60, 12);

			//Draws the message
			fill(200, toast.alpha);
			text(toast.msg, 0, 0);

			pop();
		}
	},
	//Easing Functions - Derrived from Robert Penner's Easing Functions
	//Easeoutback - smoothly overshoots then returns
	easeOutBack: (x) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
	},
	//easeinout - smoothly eases into and then out
	easeInOut: (x) => {
		return x < 0.5 ? 2 * Math.pow(x, 2) : 1 - Math.pow(-2 * x + 2, 2) / 2;
	},
};

//P5.js Functions
//Preload runs before anything
function preload() {
	//Load image file
	spriteSheet = loadImage("/Art/Sprite_Sheet.png");
	//Load audio files
	music = loadSound("/Audio/Music.wav");
	cardSound = loadSound("/Audio/Card.mp3");
	buttonSound = loadSound("/Audio/Button.mp3");
}
//Setup runs after preload
function setup() {
	//Creates canvas
	createCanvas(windowWidth, windowHeight);

	//Sets the distance to centre - for display
	display.centreDist = [width / 3, height / 2.5];

	//Sets base data that'll reign true for all UI
	//Keep pixels
	pixelDensity(2);
	noSmooth();

	//Align things centered
	textAlign(CENTER, CENTER);
	textFont(`Roboto`); //I do like roboto
	rectMode(CENTER, CENTER);
	imageMode(CENTER, CENTER);

	//Sets up the button and UI layout by default
	layoutUI(windowWidth, windowHeight);
}
//Runs every animation frame the same as running requestAnimationFrame(draw)
function draw() {
	//Music
	//If playing game and music not looping
	if (app.state == STATE.GAME && !looping) {
		//Then loop it
		music.loop();
		looping = true;
	}

	//Draw Background
	background(36, 64, 52);

	//Draw State Specific
	switch (app.state) {
		//Menu screen
		case STATE.MENU:
			drawMenu();
			break;
		//Lobby creation screen
		case STATE.LOBBY_CREATE:
			drawLobbyCreate();
			break;
		//Game play screen
		case STATE.GAME:
			drawGame();
			break;
	}

	//Draw Buttons
	app.buttons.forEach((btn) => btn.draw());

	//Draw Toast Animtions
	anims.drawToasts();
}
//INPUTs
//Mobile touch
function touchStarted() {
	click(mouseX, mouseY);
}
//Desktop mouse press & touch is sent here
function mousePressed() {
	click(mouseX, mouseY);
}
//Handles all type of clicks - mouse and touch
function click(x, y) {
	//If not game just checks if any button is pressed
	if (app.state != STATE.GAME) return app.buttons.forEach((btn) => btn.click());

	const isAuction = app.data.phase == 1;
	const isTrick = app.data.phase == 2;
	//Auction 'bid' buttons
	if (isAuction) {
		//Loop through buttons
		for (const btn of bid.buttons) {
			//Continues if not hovering over said button
			if (!isHovering({ x, y }, btn)) continue;
			//Play click sound
			playButtonSound();
			//Checks if said bid is playable
			const currentNum = app.data.currentDeal?.num || 0;
			//If not then show a toast animation to say as such
			if (btn.value <= currentNum) return anims.showToast(`You must bid higher than the current level.`);
			//But if it is then send message to server
			handleInput(`bid(${btn.suit},${btn.value})`);
			return;
		}
	}
	//Trick 'cards' buttons
	if (isTrick) {
		//Loop through cards
		for (const card of clickableCards.reverse()) {
			//Continues if not hovering over said card
			if (!isHovering({ x, y }, card)) continue;
			//Play card sound
			playCardSwipeSound();
			//Send message to server
			handleInput(`trick(${card.suit},${card.pip})`);
			return;
		}
	}
	//Didn't click one of those so check the buttons
	app.buttons.forEach((btn) => btn.click());
}
//p5 windowResize function doesn't like the emulator tool, which I used a lot in testing
//This I also found to be generally more reliable
window.addEventListener(`resize`, () => {
	const [w, h] = [window.innerWidth, window.innerHeight];
	//Changes canavs size
	resizeCanvas(w, h);
	//Sets centre distance
	display.centreDist = [w / 3, h / 3];
	//Resets the buttons' and UI's position
	layoutUI(w, h);
});

//Layout buttons
function layoutUI(newWidth, newHeight) {
	//Set current deal to null if in scrore card - useful for next round's auction
	if (app.state == STATE.GAME && app.data.phase == 3) app.data.currentDeal = null;

	//Setup screen and display variables
	display.screen = {
		size: { w: min(1000, width), h: min(1100, height) },
		cx: width / 2,
		cy: min(1100, height) / 2,
	};
	display.centreDist = [display.screen.size.w / 3, display.screen.size.h / 2.5];

	//Reinitialises the apps button list
	app.buttons = [];

	//Sets if the screen is within certain sizing boundaries
	const narrow = newWidth < 680;
	const short = newHeight < 800 && app.state == STATE.LOBBY_CREATE;

	//Calulates the central position
	const cx = newWidth / 2;
	const cy = short ? 400 : newHeight / 2;

	switch (app.state) {
		//Create menu buttons
		case STATE.MENU:
			app.buttons.push(
				//Create lobby - creats a new lobby
				new Button(`CREATE LOBBY`, narrow ? cx : cx - 165, cy - 60, 300, 60, () => {
					handleInput(`create`);
				}),
				//Join lobby - joins the lobby with the code you write
				new Button(`JOIN LOBBY`, narrow ? cx : cx + 165, narrow ? cy + 20 : cy - 60, 300, 60, () => {
					const id = prompt(`Enter Lobby Code: `, ``);
					handleInput(`join(${id})`);
				}),
				//Settings - does nothing
				new Button(
					`SETTINGS`,
					cx,
					narrow ? cy + 100 : cy + 20,
					225,
					60,
					() => {
						handleInput();
					},
					[200, 200, 200],
					[150, 150, 150]
				)
			);
			break;
		//Create lobby setup buttons
		case STATE.LOBBY_CREATE:
			app.buttons.push(
				//Start starts a game for a lobby
				new Button(`START`, cx, cy - 60, 300, 60, () => {
					handleInput(`start`);
				}),
				//Back exits out of a lobby
				new Button(
					`BACK`,
					cx,
					cy - 15,
					225,
					50,
					() => {
						handleInput(`leave`);
					},
					[200, 200, 200],
					[150, 150, 150]
				)
			);
			break;
		//Create game play buttons
		case STATE.GAME:
			if (app.data.phase == 1) {
				//Auction
				const w = display.cardSizeBid[0] * display.cardScaleBid * 7;
				app.buttons.push(
					//Pass
					new Button(
						`PASS`,
						display.screen.cx,
						display.screen.cy + 100,
						w,
						30,
						() => {
							handleInput(`bid(pass)`);
						},
						[50, 150, 50],
						[25, 100, 25],
						[50, 50, 50]
					),
					//Double / redouble
					new Button(
						`DOUBLE`,
						display.screen.cx,
						display.screen.cy + 140,
						w,
						30,
						() => {
							handleInput(`bid(double)`);
						},
						[150, 50, 50],
						[100, 25, 25],
						[50, 50, 50]
					)
				);
			}
			if (app.data.phase == 3) {
				//Score Sheet
				app.buttons.push(
					//Next deal
					new Button(`NEXT DEAL`, display.screen.cx, display.screen.cy + display.centreDist[1], 300, 60, () => {
						app.data.playable = [app.data.me];
						handleInput(`next`);
					})
				);
			}
			break;
	}
}

//Draw main-menu Screen
function drawMenu() {
	fill(212, 175, 55);

	//Draw Title
	textSize(90);
	text(`BRIDGE`, width / 2, height / 2 - 140);

	//Draw Water Mark
	fill(212, 175, 55);
	textSize(20);
	textAlign(RIGHT, BOTTOM);
	text(`By Alfie W Pearce`, width - 30, height - 10); //30 from far edge for split view overlays
	textAlign(CENTER, CENTER);
}

//Draw lobby set screen
function drawLobbyCreate() {
	fill(212, 175, 55);

	//Draw all members
	textSize(30);
	textAlign(CENTER, TOP);
	text(`MEMBERS:\n${app.data.members.join(`\n`)}`, width / 2, 20);

	//Draw Lobby Id
	let size = 60;
	const txt = `LOBBY: ${app.data.lobbyId.toUpperCase()}`;
	textSize(size);
	//Decreases size until it is less than 90% of the width - limitting to 10
	while (textWidth(txt) > width * 0.9 && size > 10) {
		size -= 2;
		textSize(size);
	}
	textAlign(CENTER, CENTER);
	//Draw said text
	text(txt, width / 2, (height < 800 ? 400 : height / 2) - 140);
}
