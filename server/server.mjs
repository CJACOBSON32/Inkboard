import express from "express";
import * as mongodb from "mongodb";
import { promises as fs } from "fs";
import morgan from "morgan";
import sha256 from 'crypto-js/sha256.js';
import path, { dirname } from "path";
import { fileURLToPath } from 'url';
import http from "http";
import { WebSocketServer } from "ws";
import EventEmitter from "events";
import { v4 as uuidv4 } from 'uuid';
const port = '3000';
// get mongodb credentials from mongodb.config.json
const credentials = JSON.parse(await fs.readFile('./mongodb.config.json', 'utf-8'));
const uri = "mongodb+srv://" + credentials.username + ':' + credentials.password + '@' + credentials.host;
// Setup static express
const app = express();
// Middleware
app.use(morgan('tiny')); // Logging
app.use(express.static('src', { index: "login.html" })); // Login page
app.use(express.json()); // Json parsing
// *******************
// * Websocket stuff *
// *******************
const serverEvents = new EventEmitter();
const server = http.createServer(app);
const wss = new WebSocketServer({ server: server });
wss.on("connection", (ws) => {
    const clientID = uuidv4();
    console.log(`Client ${clientID} Connected`);
    serverEvents.on('newPath', (ev) => {
        if (ev.id !== clientID) {
            ws.send(JSON.stringify(ev.path));
        }
    });
    serverEvents.on('delete', (id) => {
        if (id !== clientID)
            ws.send('delete');
    });
    ws.on("message", (message) => {
        if (message === "delete") {
            serverEvents.emit('delete', clientID);
            console.log("Delete event received");
            return;
        }
        const newPath = JSON.parse(message);
        serverEvents.emit('newPath', { id: clientID, path: newPath });
        canvasCollection?.insertOne(newPath);
    });
    ws.on("close", (event) => {
        console.log(`Client ${clientID} disconnected`);
    });
});
// Setup client and connection
// @ts-ignore
const client = new mongodb.MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
let canvasCollection = null;
let userCollection = null;
app.get('/home', (req, res) => {
    res.sendFile(path.join(dirname(fileURLToPath(import.meta.url)), "../src/index.html"));
});
// Login from post request
app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const hashed = sha256(password).toString();
    userCollection?.findOne({ userID: username })
        .then(doc => {
        if (doc === null) { // Create a new account
            userCollection?.insertOne({ userID: username, password: hashed });
            res.redirect('/home');
        }
        else if (doc.password === hashed) {
            res.redirect('/home');
        }
        else {
            res.status(401).send({ error: "Wrong password" });
        }
    });
});
// Connect to Paths database
client.connect()
    .then(() => {
    return client.db('Canvas').collection('Paths');
})
    .then(_collection => {
    canvasCollection = _collection;
    return _collection.find({}).toArray();
})
    .then(() => console.log("Connected to mongodb paths"));
// Connect to User database
client.connect()
    .then(() => {
    return client.db('Canvas').collection('Users');
})
    .then(_collection => {
    userCollection = _collection;
    return _collection.find({}).toArray();
})
    .then(() => console.log("Connected to mongodb Users"));
// route to get all docs
app.get('/canvas', (req, res) => {
    canvasCollection?.find({}).toArray()
        .then(paths => {
        res.json(paths);
    });
});
// Route push a new line to the server
app.post('/draw', (req, res) => {
    const newPath = req.body;
    // Push to MongoDB
    canvasCollection?.insertOne(newPath)
        .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return canvasCollection?.find({}).toArray();
    })
        .then(paths => {
        res.end(JSON.stringify(paths));
    });
});
// Delete all lines associated with user
app.delete('/clear', (req, res) => {
    const auth = req.body;
    serverEvents.emit('delete');
    // Push to MongoDB
    canvasCollection?.deleteMany({ user: auth.userID })
        .then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        canvasCollection?.find({}).toArray()
            .then(paths => res.end(JSON.stringify(paths)));
    });
});
app.delete('/remove', (req, res) => {
    const query = req.body;
    serverEvents.emit('delete');
    // Push to MongoDB
    canvasCollection?.deleteOne(query);
});
server.listen(process.env.PORT || port, () => {
    console.log(`Listening on port ${process.env.PORT || port}`);
});
// app.listen( process.env.PORT || port );
// console.log(`Listening on port ${process.env.PORT || port}`);
