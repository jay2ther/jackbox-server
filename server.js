const WebSocket = require('ws');

// Start the server on port 8080
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// This object will hold all our active games. 
// It will look like this: { "ABCD": { host: connection, clients: [conn1, conn2] } }
const rooms = {};

// Helper function to generate a random 4-letter code
function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// When ANY device (Godot or a Phone) connects to this server...
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        if (data.action === "host_room") {
            const code = generateRoomCode();
            rooms[code] = { host: ws, clients: [] };
            ws.roomCode = code;
            ws.isHost = true;
            ws.send(JSON.stringify({ action: "room_created", room_code: code }));
            console.log(`Room ${code} created!`);
        }

        if (data.action === "join_room") {
            const code = data.room_code.toUpperCase();
            if (rooms[code]) {
                rooms[code].clients.push(ws);
                ws.roomCode = code;
                ws.isHost = false;
                
                // NEW: Save their name directly to their socket connection
                ws.playerName = data.name; 
                
                ws.send(JSON.stringify({ action: "joined", status: "Success" }));
                rooms[code].host.send(JSON.stringify({ action: "player_joined", name: data.name }));
            } else {
                ws.send(JSON.stringify({ action: "error", message: "Room not found" }));
            }
        }

        if (data.action === "button_press") {
            const code = ws.roomCode;
            if (code && rooms[code] && rooms[code].host) {
                rooms[code].host.send(JSON.stringify({ action: "player_input", payload: data.payload }));
            }
            // NEW: Allow Godot to whisper stats back to a specific phone
        if (data.action === "update_client") {
            const code = ws.roomCode;
            // Make sure the sender is the Godot Host
            if (code && rooms[code] && ws.isHost) {
                // Find the specific phone by their name
                const targetClient = rooms[code].clients.find(c => c.playerName === data.target_name);
                if (targetClient) {
                    // Forward the stats to that specific phone!
                    targetClient.send(JSON.stringify({ 
                        action: "profile_loaded", 
                        currency: data.currency
        }
    });

    // NEW: Handle exactly what happens when someone closes their browser
    ws.on('close', () => {
        if (ws.isHost && ws.roomCode) {
            delete rooms[ws.roomCode];
        } else if (!ws.isHost && ws.roomCode && rooms[ws.roomCode]) {
            // Tell Godot that this specific player vanished
            if (rooms[ws.roomCode].host && ws.playerName) {
                rooms[ws.roomCode].host.send(JSON.stringify({ action: "player_left", name: ws.playerName }));
            }
            // Remove them from the server's active list
            rooms[ws.roomCode].clients = rooms[ws.roomCode].clients.filter(client => client !== ws);
        }
    });
});

console.log(`Traffic Cop Server is awake and listening on port ${PORT}...`);
