
import paper from "paper"
import {UserPath, sUserPath, clientToServerPath, serverToClientPath} from "./UserPath";

//*********
//* Setup *
//*********

// Set up paper canvas
const paperView = new paper.PaperScope();
const canvas = <HTMLCanvasElement>document.getElementById('main-canvas');
const canvasHolder = <HTMLDivElement>canvas.parentElement;

// Set initial canvas size before adding paperView
paperView.setup(canvas);

// Track all paths currently in the scene
const paths: UserPath[] = []
let currentPath: UserPath | null

let eraseMode = true;

// Get button inputs
const clearBtn = <HTMLButtonElement>document.getElementById("clear");
const colorInput = <HTMLInputElement>document.getElementById("color-picker");
const widthInput = <HTMLInputElement>document.getElementById("width");
const signOutBtn = <HTMLButtonElement>document.getElementById("sign-out");

const userID = <string>localStorage.getItem("username");
const password = <string>localStorage.getItem("password");

const socket = new WebSocket(`ws://${window.location.host}`);

//**************
//* Networking *
//**************

/**
 * Submit a POST request with a new path to add to the database
 * @param userPath The path to post to the server
 */
function submitPath(userPath: UserPath) {
	const s_UserPath: sUserPath = clientToServerPath(userPath);
	const body = JSON.stringify(s_UserPath);

	socket.send(body);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
socket.addEventListener('message', (event) => {
	if (event.data === 'delete') {
		console.log('recieved delete');
		sleep(1000).then(refreshPaths)
		return;
	}

	const userPath = <sUserPath>JSON.parse(event.data);

	paths.push(serverToClientPath(userPath));
});

function clearUserPaths() {
	const body = JSON.stringify({
		userID: userID,
		password: password
	});

	fetch('/clear', {
		method: 'DELETE',
		headers: {'Content-Type': 'application/json'},
		body: body
	})
		.then(response => response.json())
		.then(paths => replacePaths(paths));
}

function deletePath(userPath: sUserPath) {
	const body = JSON.stringify(userPath);

	fetch('/remove', {
		method: 'DELETE',
		headers: {'Content-Type': 'application/json'},
		body: body
	});
}

function refreshPaths() {
	fetch('/canvas', { method: 'GET' })
		.then(response => response.json())
		.then(json => {
			replacePaths(json);
		});
}

// Get paths at the beginning
refreshPaths();

// Refresh paths every 5 seconds
// let refreshPaused = false;
// setInterval(() => { if (!refreshPaused) refreshPaths() }, 5000);


//*********************
//* Utility Functions *
//*********************

// Boilerplate for a new path with stroke color and width
function initPath(): paper.Path {
	const newPath = new paper.Path();
	newPath.strokeColor = new paper.Color(colorInput.value);
	newPath.strokeWidth = parseInt(widthInput.value);
	newPath.strokeCap = "round";

	// newPath.fullySelected = true

	return newPath;
}

// Convert canvas local position to position in canvas
function getMousePos(x: number, y: number): paper.Point {
	const rect = canvas.getBoundingClientRect();
	const canvasRes = new paper.Point(canvas.width, canvas.height);
	return new paper.Point(x - rect.left - 15, y - rect.top - 15);
}

function replacePaths(newPaths: sUserPath[]) {
	// Clear canvas and replace with updated paths
	paperView.project.clear()
	for (const userPath of newPaths) {
		paths.push(serverToClientPath(userPath));
	}
}

//***********************
//* Handle Mouse Events *
//***********************

// Check for mouse dragging
let leftMouseDown = false;
let middleMouseDown = false;
let rightMouseDown = false;
canvas.addEventListener("mousedown", ev => {
	switch (ev.button) {
		case 0: // Left mouse button
			leftMouseDown = true;

			if (eraseMode)
				break;

			// Init path
			currentPath = { path: initPath(), user: userID };
			paths.push(currentPath);
			currentPath.path.add(getMousePos(ev.x, ev.y));

			// Stop refreshing canvas
			// refreshPaused = true;
			break;
		case 1: // Left mouse button
			middleMouseDown = true;
			break;
		case 2: // Left mouse button
			rightMouseDown = true;
			break;
	}
});
window.addEventListener("mouseup", ev => {
	switch (ev.button) {
		case 0: // Left mouse button

			leftMouseDown = false;

			if (eraseMode)
				break;

			if (currentPath !== null) {
				// Simplify line with fewer points
				currentPath.path.simplify();

				// If the path is empty, remove it immediately (this happens if the user just clicks)
				if (currentPath.path.segments.length <= 1) {
					paths.pop();
					currentPath.path.remove();
				}

				submitPath(currentPath);

				currentPath = null;

				// Resume refreshing canvas
				// refreshPaths();
				// refreshPaused = false;
			}
			break;
		case 1: // Middle mouse button
			middleMouseDown = false;
			break;
		case 2: // Right mouse button
			rightMouseDown = false;
			break;
	}
});

// Draw line when mouse is dragged
canvas.addEventListener("mousemove", ev => {
	if (leftMouseDown) {
		if (eraseMode) {
			const hitResult = paperView.project.hitTest(getMousePos(ev.x, ev.y), {segments: true, stroke: true, tolerance: 5});

			if (hitResult !== null) {
				const pathIndex = paths.findIndex(userPath => userPath.path === hitResult.item);
				const userPath = paths[pathIndex];

				if (userPath !== undefined) {
					deletePath(clientToServerPath(userPath));
					paths.splice(pathIndex, pathIndex);
					userPath.path.remove();
				}
			}

			return;
		}

		currentPath!.path.add(getMousePos(ev.x, ev.y));
	}
});

//***********************
//* Handle Other Events *
//***********************

// Refresh canvas when window focus changes
// window.addEventListener('focus', refreshPaths);

// Clear all User paths
clearBtn.addEventListener('click', clearUserPaths);

// Sign out (redirect to login page)
signOutBtn.addEventListener('click', () => {
	let homeURL = window.location.toString();
	homeURL = homeURL.substring(0, homeURL.length - 4);
	window.location.replace(homeURL);
});
