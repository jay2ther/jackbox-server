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
    
    // When the server receives a message from a connected device...
    ws.on('message', (message) => {
        let data;
        try { 
            // Translate the text string back into a JSON object
            data = JSON.parse(message); 
        } catch (e) { 
            console.log("Received garbage data, ignoring.");
            return; 
        }

        // ==========================================
        // SCENARIO 1: GODOT WANTS TO HOST A GAME
        // ==========================================
        if (data.action === "host_room") {
            const code = generateRoomCode();
            rooms[code] = { host: ws, clients: [] };
            ws.roomCode = code; // Tag this connection so we know it's a host
            ws.isHost = true;
            
            // Send the code back to Godot so it can display it on the TV
            ws.send(JSON.stringify({ action: "room_created", room_code: code }));
            console.log(`Room ${code} created by a Host!`);
        }

        // ==========================================
        // SCENARIO 2: A PHONE WANTS TO JOIN A GAME
        // ==========================================
        if (data.action === "join_room") {
            const code = data.room_code.toUpperCase();
            
            // Check if the 4-letter code actually exists
            if (rooms[code]) {
                rooms[code].clients.push(ws); // Add phone to the room
                ws.roomCode = code;
                ws.isHost = false;
                
                // Tell the phone it was successful
                ws.send(JSON.stringify({ action: "joined", status: "Success" }));

                // Tap Godot on the shoulder and tell it someone joined
                rooms[code].host.send(JSON.stringify({
                    action: "player_joined",
                    name: data.name
                }));
                console.log(`${data.name} joined room ${code}`);
            } else {
                // Code doesn't exist!
                ws.send(JSON.stringify({ action: "error", message: "Room not found" }));
            }
        }

        // ==========================================
        // SCENARIO 3: A PHONE PRESSES A BUTTON
        // ==========================================
        if (data.action === "button_press") {
            const code = ws.roomCode; // Find out which room this phone belongs to
            
            // If the room exists and the Host is still connected...
            if (code && rooms[code] && rooms[code].host) {
                // Blindly forward the payload straight to Godot!
                rooms[code].host.send(JSON.stringify({
                    action: "player_input",
                    payload: data.payload
                }));
            }
        }
    });

    // Cleanup: If a device disconnects, check if it was the Host. 
    // If Godot crashes or closes, destroy the room.
    ws.on('close', () => {
        if (ws.isHost && ws.roomCode) {
            console.log(`Host disconnected. Room ${ws.roomCode} destroyed.`);
            delete rooms[ws.roomCode];
        }
    });
});

console.log(`Traffic Cop Server is awake and listening on port ${PORT}...`);
